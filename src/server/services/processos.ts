/**
 * Processos: criar, listar, ficha, estados, lista documental, seguimento.
 */
import { z } from "zod";
import { withTenant, type Tx } from "../db";
import { diaLisboa } from "../domain/datas";
import { acoesManuais, isEstado, type Estado } from "../domain/estados";
import { calcularFaixa, contarItens, type EstadoItem, type Faixa } from "../domain/faixa";
import type { Papel } from "../domain/papeis";
import {
  bloquearProcesso,
  ErroNegocio,
  exigirUuid,
  mudarEstadoManual,
  mudarEstadoSistema,
  registarEvento,
  type Ctx,
} from "./comum";

export const ESTADO_ITEM_ROTULO: Record<EstadoItem, string> = {
  em_falta: "Em falta",
  recebido: "Recebido",
  conferido: "Conferido",
  rejeitado: "Rejeitado",
};

export const ESTADOS_ITEM = ["em_falta", "recebido", "conferido", "rejeitado"] as const;

// ---------------------------------------------------------------------------
// Listas de apoio
// ---------------------------------------------------------------------------

export interface UtilizadorResumo {
  id: string;
  name: string;
  role: Papel;
  active: boolean;
}

export async function listarUtilizadores(ctx: Ctx): Promise<UtilizadorResumo[]> {
  return withTenant(ctx, (tx) => tx<UtilizadorResumo[]>`
    select id, name, role, active from users order by name`);
}

export interface TipoResumo {
  id: string;
  key: string;
  name: string;
}

export async function listarTipos(ctx: Ctx): Promise<TipoResumo[]> {
  return withTenant(ctx, (tx) => tx<TipoResumo[]>`
    select id, key, name from matter_types order by position, name`);
}

export interface ClienteResumo {
  id: string;
  name: string;
  email: string | null;
}

export async function listarClientes(ctx: Ctx): Promise<ClienteResumo[]> {
  return withTenant(ctx, (tx) => tx<ClienteResumo[]>`
    select id, name, email from clients order by name`);
}

// ---------------------------------------------------------------------------
// Criar processo
// ---------------------------------------------------------------------------

export const NovoProcessoSchema = z
  .object({
    clienteId: z.string().uuid().optional().nullable(),
    novoCliente: z
      .object({
        nome: z.string().trim().min(1, "Indique o nome do cliente.").max(200),
        email: z.string().trim().email("Email inválido.").or(z.literal("")).optional(),
        telefone: z.string().trim().max(40).optional(),
      })
      .optional()
      .nullable(),
    tipoId: z.string().uuid("Escolha o tipo de processo."),
    titulo: z.string().trim().max(200).optional(),
    responsavelId: z.string().uuid("Escolha o responsável."),
    seguimento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .or(z.literal(""))
      .optional()
      .nullable(),
  })
  .refine((v) => v.clienteId || v.novoCliente, {
    message: "Escolha um cliente ou crie um novo.",
    path: ["clienteId"],
  });

export type NovoProcesso = z.input<typeof NovoProcessoSchema>;

/** Cria o processo dentro de uma transação já aberta. */
export async function criarProcessoTx(
  tx: Tx,
  ctx: Ctx,
  bruto: NovoProcesso,
  estadoInicial: Estado = "por_triar",
): Promise<{ id: string; reference: string }> {
  const input = NovoProcessoSchema.parse(bruto);

  let clienteId = input.clienteId ?? null;
  let clienteNome: string;
  if (clienteId) {
    const [c] = await tx<{ name: string }[]>`select name from clients where id = ${clienteId}`;
    if (!c) throw new ErroNegocio("Cliente não encontrado.");
    clienteNome = c.name;
  } else {
    const n = input.novoCliente!;
    const [c] = await tx<{ id: string }[]>`
      insert into clients (organization_id, name, email, phone)
      values (${ctx.orgId}, ${n.nome}, ${n.email || null}, ${n.telefone || null})
      returning id`;
    clienteId = c.id;
    clienteNome = n.nome;
  }

  const [tipo] = await tx<{ id: string; name: string }[]>`
    select id, name from matter_types where id = ${input.tipoId}`;
  if (!tipo) throw new ErroNegocio("Tipo de processo não encontrado.");
  const [resp] = await tx<{ id: string }[]>`
    select id from users where id = ${input.responsavelId} and active`;
  if (!resp) throw new ErroNegocio("Responsável não encontrado.");

  // Numeração sequencial por ano e escritório, sem colisões.
  await tx`select pg_advisory_xact_lock(hashtext(${"num:" + ctx.orgId}))`;
  const ano = Number(diaLisboa().slice(0, 4));
  const [{ proximo }] = await tx<{ proximo: number }[]>`
    select coalesce(max(number), 0) + 1 as proximo from matters where year = ${ano}`;

  const titulo = input.titulo?.trim() || `${tipo.name} — ${clienteNome}`;
  const [m] = await tx<{ id: string; reference: string }[]>`
    insert into matters (organization_id, year, number, client_id, matter_type_id,
                         title, state, responsible_id, follow_up_on)
    values (${ctx.orgId}, ${ano}, ${proximo}, ${clienteId}, ${tipo.id}, ${titulo},
            ${estadoInicial}, ${resp.id}, ${input.seguimento || null})
    returning id, reference`;

  await tx`
    insert into matter_items (organization_id, matter_id, label, required, position)
    select ${ctx.orgId}, ${m.id}, label, required, position
    from document_requirements where matter_type_id = ${tipo.id}`;

  await registarEvento(tx, ctx, {
    matterId: m.id,
    kind: "criado",
    summary: `Processo ${m.reference} criado (${tipo.name}).`,
    data: { tipo: tipo.name, cliente: clienteNome },
  });
  return m;
}

export async function criarProcesso(ctx: Ctx, input: NovoProcesso) {
  return withTenant(ctx, (tx) => criarProcessoTx(tx, ctx, input));
}

// ---------------------------------------------------------------------------
// Listar processos
// ---------------------------------------------------------------------------

export interface LinhaProcesso {
  id: string;
  reference: string;
  title: string;
  state: Estado;
  state_since: string;
  follow_up_on: string | null;
  client_name: string;
  responsible_id: string;
  responsible_name: string;
  type_name: string;
  falta: number;
  total: number;
}

export async function listarProcessos(
  ctx: Ctx,
  filtros: { estado?: string; responsavel?: string; q?: string; incluirConcluidos?: boolean } = {},
): Promise<LinhaProcesso[]> {
  const estado = filtros.estado && isEstado(filtros.estado) ? filtros.estado : null;
  const resp = filtros.responsavel && /^[0-9a-f-]{36}$/.test(filtros.responsavel)
    ? filtros.responsavel
    : null;
  const q = filtros.q?.trim() ? `%${filtros.q.trim().toLowerCase()}%` : null;
  const incluirConcluidos = filtros.incluirConcluidos || estado === "concluido";

  return withTenant(ctx, (tx) => tx<LinhaProcesso[]>`
    select m.id, m.reference, m.title, m.state, m.state_since, m.follow_up_on,
           c.name as client_name, m.responsible_id, u.name as responsible_name,
           t.name as type_name,
           count(i.*) filter (where i.required and i.status in ('em_falta','rejeitado'))::int as falta,
           count(i.*) filter (where i.required)::int as total
    from matters m
    join clients c on c.id = m.client_id
    join users u on u.id = m.responsible_id
    join matter_types t on t.id = m.matter_type_id
    left join matter_items i on i.matter_id = m.id
    where (${estado}::text is null or m.state = ${estado})
      and (${resp}::uuid is null or m.responsible_id = ${resp})
      and (${incluirConcluidos} or m.state <> 'concluido')
      and (${q}::text is null
           or lower(m.reference) like ${q} or lower(m.title) like ${q}
           or lower(c.name) like ${q})
    group by m.id, c.name, u.name, t.name
    order by m.state_since asc
    limit 500`);
}

// ---------------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------------

export interface ItemFicha {
  id: string;
  label: string;
  required: boolean;
  status: EstadoItem;
  position: number;
}

export interface AnexoFicha {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  item_id: string | null;
  created_at: string;
  inbox_message_id: string | null;
}

export interface EventoFicha {
  id: string;
  kind: string;
  summary: string;
  data: Record<string, unknown>;
  created_at: string;
  actor_name: string | null;
}

export interface PrazoFicha {
  id: string;
  label: string;
  due_on: string;
  status: "por_confirmar" | "confirmado";
  confirmed_by_name: string | null;
  confirmed_at: string | null;
}

export interface PedidoFicha {
  id: string;
  status: string;
  to_email: string;
  subject: string;
  body: string;
  item_ids: string[];
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  approved_by_name: string | null;
}

export interface Ficha {
  matter: {
    id: string;
    reference: string;
    title: string;
    state: Estado;
    state_since: string;
    follow_up_on: string | null;
    created_at: string;
    responsible_id: string;
    responsible_name: string;
    type_name: string;
    client: { id: string; name: string; email: string | null; phone: string | null };
  };
  faixa: Faixa;
  itens: ItemFicha[];
  anexos: AnexoFicha[];
  prazos: PrazoFicha[];
  pedidos: PedidoFicha[];
  eventos: EventoFicha[];
  acoes: { para: Estado; rotulo: string }[];
  podeCompletar: boolean;
  posicao: string | null;
}

export async function obterFicha(ctx: Ctx, matterId: string): Promise<Ficha | null> {
  if (!/^[0-9a-f-]{36}$/i.test(matterId)) return null;
  return withTenant(ctx, async (tx) => {
    const [m] = await tx`
      select m.id, m.reference, m.title, m.state, m.state_since, m.follow_up_on,
             m.created_at, m.responsible_id, u.name as responsible_name,
             t.name as type_name,
             c.id as client_id, c.name as client_name, c.email as client_email,
             c.phone as client_phone
      from matters m
      join users u on u.id = m.responsible_id
      join matter_types t on t.id = m.matter_type_id
      join clients c on c.id = m.client_id
      where m.id = ${matterId}`;
    if (!m) return null;

    const itens = await tx<ItemFicha[]>`
      select id, label, required, status, position from matter_items
      where matter_id = ${matterId} order by position, label`;
    const anexos = await tx<AnexoFicha[]>`
      select id, filename, mime_type, size_bytes, sha256, item_id, created_at,
             inbox_message_id
      from attachments where matter_id = ${matterId} order by created_at`;
    const prazos = await tx<PrazoFicha[]>`
      select d.id, d.label, d.due_on, d.status, u.name as confirmed_by_name, d.confirmed_at
      from deadlines d left join users u on u.id = d.confirmed_by
      where d.matter_id = ${matterId} order by d.due_on`;
    const pedidos = await tx<PedidoFicha[]>`
      select r.id, r.status, r.to_email, r.subject, r.body, r.item_ids, r.attempts,
             r.last_error, r.created_at, r.updated_at, r.sent_at,
             u.name as approved_by_name
      from client_requests r left join users u on u.id = r.approved_by
      where r.matter_id = ${matterId} order by r.created_at desc`;
    const eventos = await tx<EventoFicha[]>`
      select e.id, e.kind, e.summary, e.data, e.created_at, u.name as actor_name
      from events e left join users u on u.id = e.actor_id
      where e.matter_id = ${matterId} order by e.created_at desc, e.id`;
    const [pos] = await tx<{ tab: string }[]>`
      select tab from user_positions where user_id = ${ctx.userId} and matter_id = ${matterId}`;

    const estado = m.state as Estado;
    const contagem = contarItens(itens);
    return {
      matter: {
        id: m.id,
        reference: m.reference,
        title: m.title,
        state: estado,
        state_since: m.state_since,
        follow_up_on: m.follow_up_on,
        created_at: m.created_at,
        responsible_id: m.responsible_id,
        responsible_name: m.responsible_name,
        type_name: m.type_name,
        client: {
          id: m.client_id,
          name: m.client_name,
          email: m.client_email,
          phone: m.client_phone,
        },
      },
      faixa: calcularFaixa({
        estado,
        desde: m.state_since,
        responsavel: m.responsible_name,
        cliente: m.client_name,
        itens,
      }),
      itens,
      anexos,
      prazos,
      pedidos,
      eventos,
      acoes: acoesManuais(estado, ctx.papel),
      podeCompletar: contagem.falta === 0 && contagem.porConferir === 0,
      posicao: pos?.tab ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

export async function transicionar(ctx: Ctx, matterId: string, para: string) {
  exigirUuid(matterId, "Processo");
  if (!isEstado(para)) throw new ErroNegocio("Estado desconhecido.");
  return withTenant(ctx, async (tx) => {
    const m = await bloquearProcesso(tx, matterId);
    if (para === "completo") {
      const itens = await tx<{ required: boolean; status: EstadoItem }[]>`
        select required, status from matter_items where matter_id = ${matterId}`;
      const c = contarItens(itens);
      if (c.falta > 0 || c.porConferir > 0) {
        throw new ErroNegocio(
          "Só pode marcar como completo quando todos os documentos obrigatórios estiverem conferidos.",
          "transicao",
        );
      }
    }
    await mudarEstadoManual(tx, ctx, m, para);
  });
}

// ---------------------------------------------------------------------------
// Lista documental
// ---------------------------------------------------------------------------

export async function alterarItemTx(
  tx: Tx,
  ctx: Ctx,
  itemId: string,
  status: EstadoItem,
): Promise<{ anterior: EstadoItem; matterId: string }> {
  const [item] = await tx<{ id: string; matter_id: string; label: string; status: EstadoItem; required: boolean }[]>`
    select id, matter_id, label, status, required from matter_items where id = ${itemId}`;
  if (!item) throw new ErroNegocio("Documento não encontrado.", "nao_encontrado");
  const m = await bloquearProcesso(tx, item.matter_id);
  if (m.state === "concluido") {
    throw new ErroNegocio("Reabra o processo antes de alterar a lista documental.", "transicao");
  }
  if (item.status === status) return { anterior: status, matterId: m.id };

  await tx`update matter_items set status = ${status}, updated_at = now() where id = ${itemId}`;
  await tx`update matters set updated_at = now() where id = ${m.id}`;
  await registarEvento(tx, ctx, {
    matterId: m.id,
    kind: "item",
    summary: `«${item.label}»: ${ESTADO_ITEM_ROTULO[item.status]} → ${ESTADO_ITEM_ROTULO[status]}`,
    data: { itemId, de: item.status, para: status },
  });
  if (m.state === "completo" && item.required && status !== "conferido") {
    await mudarEstadoSistema(tx, ctx, m, "em_conferencia", "documento deixou de estar conferido");
  }
  return { anterior: item.status, matterId: m.id };
}

export async function alterarItem(ctx: Ctx, itemId: string, status: string) {
  exigirUuid(itemId, "Documento");
  if (!(ESTADOS_ITEM as readonly string[]).includes(status)) {
    throw new ErroNegocio("Estado de documento desconhecido.");
  }
  return withTenant(ctx, (tx) => alterarItemTx(tx, ctx, itemId, status as EstadoItem));
}

export async function adicionarItem(
  ctx: Ctx,
  matterId: string,
  label: string,
  required: boolean,
) {
  exigirUuid(matterId, "Processo");
  const nome = label.trim();
  if (!nome || nome.length > 200) throw new ErroNegocio("Indique o nome do documento.");
  return withTenant(ctx, async (tx) => {
    const m = await bloquearProcesso(tx, matterId);
    if (m.state === "concluido") {
      throw new ErroNegocio("Reabra o processo antes de alterar a lista documental.");
    }
    const [{ pos }] = await tx<{ pos: number }[]>`
      select coalesce(max(position), -1) + 1 as pos from matter_items where matter_id = ${matterId}`;
    await tx`
      insert into matter_items (organization_id, matter_id, label, required, position)
      values (${ctx.orgId}, ${matterId}, ${nome}, ${required}, ${pos})`;
    await registarEvento(tx, ctx, {
      matterId,
      kind: "item",
      summary: `Documento acrescentado à lista: «${nome}»${required ? "" : " (opcional)"}`,
    });
    if (m.state === "completo" && required) {
      await mudarEstadoSistema(tx, ctx, m, "em_conferencia", "novo documento obrigatório");
    }
  });
}

// ---------------------------------------------------------------------------
// Seguimento, responsável, retoma
// ---------------------------------------------------------------------------

export async function definirSeguimento(ctx: Ctx, matterId: string, data: string | null) {
  exigirUuid(matterId, "Processo");
  if (data !== null && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new ErroNegocio("Data de seguimento inválida.");
  }
  return withTenant(ctx, async (tx) => {
    const [m] = await tx<{ follow_up_on: string | null }[]>`
      select follow_up_on from matters where id = ${matterId} for update`;
    if (!m) throw new ErroNegocio("Processo não encontrado.", "nao_encontrado");
    if (m.follow_up_on === data) return;
    await tx`update matters set follow_up_on = ${data}, updated_at = now() where id = ${matterId}`;
    await registarEvento(tx, ctx, {
      matterId,
      kind: "seguimento",
      summary: data ? `Seguimento marcado para ${data.split("-").reverse().join("/")}.` : "Seguimento removido.",
      data: { de: m.follow_up_on, para: data },
    });
  });
}

export async function atribuirResponsavel(ctx: Ctx, matterId: string, userId: string) {
  exigirUuid(matterId, "Processo");
  exigirUuid(userId, "Utilizador");
  return withTenant(ctx, async (tx) => {
    const [u] = await tx<{ name: string }[]>`select name from users where id = ${userId} and active`;
    if (!u) throw new ErroNegocio("Utilizador não encontrado.");
    const [m] = await tx<{ responsible_id: string }[]>`
      select responsible_id from matters where id = ${matterId} for update`;
    if (!m) throw new ErroNegocio("Processo não encontrado.", "nao_encontrado");
    if (m.responsible_id === userId) return;
    await tx`update matters set responsible_id = ${userId}, updated_at = now() where id = ${matterId}`;
    await registarEvento(tx, ctx, {
      matterId,
      kind: "responsavel",
      summary: `Responsável passou a ser ${u.name}.`,
      data: { de: m.responsible_id, para: userId },
    });
  });
}

export const SEPARADORES = ["documentos", "pedido", "prazos", "historico"] as const;

export async function guardarPosicao(ctx: Ctx, matterId: string, tab: string) {
  if (!(SEPARADORES as readonly string[]).includes(tab)) return;
  if (!/^[0-9a-f-]{36}$/i.test(matterId)) return;
  await withTenant(ctx, async (tx) => {
    await tx`
      insert into user_positions (organization_id, user_id, matter_id, tab)
      select ${ctx.orgId}, ${ctx.userId}, id, ${tab} from matters where id = ${matterId}
      on conflict (user_id, matter_id) do update set tab = excluded.tab, updated_at = now()`;
  });
}

/** Último processo aberto pelo utilizador (para «continuar onde ficou»). */
export async function ultimoProcesso(ctx: Ctx) {
  return withTenant(ctx, async (tx) => {
    const [r] = await tx<{ id: string; reference: string; title: string }[]>`
      select m.id, m.reference, m.title from user_positions p
      join matters m on m.id = p.matter_id
      where p.user_id = ${ctx.userId}
      order by p.updated_at desc limit 1`;
    return r ?? null;
  });
}
