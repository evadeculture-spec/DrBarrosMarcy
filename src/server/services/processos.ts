/**
 * Processos: criar, listar, ficha, estados, lista documental, seguimento.
 */
import { z } from "zod";
import { withTenant, type Tx } from "../db";
import { diaLisboa } from "../domain/datas";
import { acoesManuais, isEstado, type Estado } from "../domain/estados";
import { calcularFaixa, contarItens, type EstadoItem, type Faixa } from "../domain/faixa";
import type { Papel } from "../domain/papeis";
import { criarClienteTx, normalizar } from "./clientes";
import { MOTIVOS_BLOQUEIO, MOTIVOS_MANUAIS, SQL_BLOQUEIO, type MotivoBloqueio } from "./indicadores";
import type { Tarefa } from "./tarefas";
import { fecharRevisaoSeConcluida, garantirRevisao } from "./tarefas";
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
  recebido: "Recebido para revisão",
  conferido: "Validado",
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
  reference: string;
  city: string | null;
}

export async function listarClientes(ctx: Ctx): Promise<ClienteResumo[]> {
  return withTenant(ctx, (tx) => tx<ClienteResumo[]>`
    select id, name, email, reference, city from clients order by name, reference, id`);
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
    estadoInicial: z.enum(["por_triar", "em_conferencia"]).optional(),
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
  estadoPorOmissao: Estado = "por_triar",
): Promise<{ id: string; reference: string }> {
  const input = NovoProcessoSchema.parse(bruto);
  const estadoInicial: Estado = input.estadoInicial ?? estadoPorOmissao;

  let clienteId = input.clienteId ?? null;
  let clienteNome: string;
  if (clienteId) {
    const [c] = await tx<{ name: string }[]>`select name from clients where id = ${clienteId}`;
    if (!c) throw new ErroNegocio("Cliente não encontrado.");
    clienteNome = c.name;
  } else {
    const n = input.novoCliente!;
    const c = await criarClienteTx(tx, ctx, { nome: n.nome, email: n.email, telefone: n.telefone });
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
  const q = filtros.q?.trim() ? `%${normalizar(filtros.q.trim()).replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
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
           or sf_normalizar(m.reference || ' ' || m.title) like ${q}
           or c.pesquisa like ${q})
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
    valor_previsto: string | null;
    valor_pago: string;
    bloqueio_motivo: string | null;
    bloqueio_nota: string | null;
    bloqueio_revisao: string | null;
    proxima_acao: string | null;
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
  tarefas: Tarefa[];
  ultimaDecisao: EventoFicha | null;
  bloqueioDerivado: boolean;
}

export async function obterFicha(ctx: Ctx, matterId: string): Promise<Ficha | null> {
  if (!/^[0-9a-f-]{36}$/i.test(matterId)) return null;
  return withTenant(ctx, async (tx) => {
    const [m] = await tx`
      select m.id, m.reference, m.title, m.state, m.state_since, m.follow_up_on,
             m.created_at, m.responsible_id, u.name as responsible_name,
             m.valor_previsto, m.valor_pago, m.bloqueio_motivo, m.bloqueio_nota, m.bloqueio_revisao,
             m.proxima_acao,
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
    const tarefas = await tx<Tarefa[]>`
      select t.id, t.matter_id, null as matter_reference, null as client_name, t.kind, t.title,
             t.assignee_id, u.name as assignee_name, t.due_on, t.status, t.completed_at,
             uc.name as completed_by_name, t.created_at
      from tasks t join users u on u.id = t.assignee_id left join users uc on uc.id = t.completed_by
      where t.matter_id = ${matterId}
      order by t.status, t.due_on nulls last, t.created_at`;
    const [{ derivado }] = await tx<{ derivado: boolean }[]>`
      select (${tx.unsafe(SQL_BLOQUEIO)}) as derivado from matters m where m.id = ${matterId}`;
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
        valor_previsto: m.valor_previsto,
        valor_pago: m.valor_pago,
        bloqueio_motivo: m.bloqueio_motivo,
        bloqueio_nota: m.bloqueio_nota,
        bloqueio_revisao: m.bloqueio_revisao,
        proxima_acao: m.proxima_acao,
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
      tarefas: [...tarefas],
      ultimaDecisao: eventos.find((e) => KINDS_DECISAO.includes(e.kind)) ?? null,
      bloqueioDerivado: derivado && !m.bloqueio_motivo,
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
          "Só pode marcar como completo quando todos os documentos obrigatórios estiverem validados.",
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
    await mudarEstadoSistema(tx, ctx, m, "em_conferencia", "documento deixou de estar validado");
  }
  if (status === "recebido") await garantirRevisao(tx, ctx, m.id, "documento recebido");
  else await fecharRevisaoSeConcluida(tx, ctx, m.id);
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

export const SEPARADORES = ["documentos", "tarefas", "prazos", "pedido", "pagamento", "historico"] as const;

/** Eventos que representam decisões humanas (mostrados como «última decisão»). */
const KINDS_DECISAO = [
  "estado", "item", "anexo_associado", "anexo_movido", "anulado", "pedido_enviado", "pedido_devolvido",
  "pedido_cancelado", "pedido_submetido", "responsavel", "bloqueio", "tarefa", "prazo", "proxima_acao",
];

export async function definirProximaAcao(ctx: Ctx, matterId: string, texto: string | null) {
  exigirUuid(matterId, "Processo");
  const t = texto?.trim() ? texto.trim().slice(0, 300) : null;
  await withTenant(ctx, async (tx) => {
    const [m] = await tx<{ proxima_acao: string | null }[]>`select proxima_acao from matters where id = ${matterId} for update`;
    if (!m) throw new ErroNegocio("Processo não encontrado.", "nao_encontrado");
    if (m.proxima_acao === t) return;
    await tx`update matters set proxima_acao = ${t}, updated_at = now() where id = ${matterId}`;
    await registarEvento(tx, ctx, {
      matterId, kind: "proxima_acao",
      summary: t ? `Próxima ação definida: «${t}».` : "Próxima ação manual removida (volta a ser a sugerida pelo estado).",
    });
  });
}

export async function definirBloqueio(
  ctx: Ctx,
  matterId: string,
  b: { motivo: string; nota?: string | null; revisao: string } | null,
) {
  exigirUuid(matterId, "Processo");
  if (b) {
    if (!(MOTIVOS_MANUAIS as readonly string[]).includes(b.motivo)) throw new ErroNegocio("Escolha o motivo do bloqueio.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.revisao)) throw new ErroNegocio("Indique a data da próxima revisão.");
  }
  await withTenant(ctx, async (tx) => {
    const [m] = await tx<{ bloqueio_motivo: string | null }[]>`select bloqueio_motivo from matters where id = ${matterId} for update`;
    if (!m) throw new ErroNegocio("Processo não encontrado.", "nao_encontrado");
    await tx`
      update matters set bloqueio_motivo = ${b?.motivo ?? null}, bloqueio_nota = ${b?.nota?.trim() || null},
             bloqueio_revisao = ${b?.revisao ?? null}, updated_at = now()
      where id = ${matterId}`;
    await registarEvento(tx, ctx, {
      matterId, kind: "bloqueio",
      summary: b
        ? `Processo parado: ${MOTIVOS_BLOQUEIO[b.motivo as MotivoBloqueio]}${b.nota?.trim() ? ` — ${b.nota.trim()}` : ""}. Revisão a ${b.revisao.split("-").reverse().join("/")}.`
        : "Bloqueio levantado.",
      data: { de: m.bloqueio_motivo, para: b?.motivo ?? null },
    });
  });
}

export async function definirValores(ctx: Ctx, matterId: string, previsto: number | null, pago: number) {
  exigirUuid(matterId, "Processo");
  const ok = (v: number) => Number.isFinite(v) && v >= 0 && v < 10_000_000;
  if ((previsto !== null && !ok(previsto)) || !ok(pago)) throw new ErroNegocio("Valores inválidos.");
  await withTenant(ctx, async (tx) => {
    const [m] = await tx<{ valor_previsto: string | null; valor_pago: string }[]>`
      select valor_previsto, valor_pago from matters where id = ${matterId} for update`;
    if (!m) throw new ErroNegocio("Processo não encontrado.", "nao_encontrado");
    await tx`update matters set valor_previsto = ${previsto}, valor_pago = ${pago}, updated_at = now() where id = ${matterId}`;
    const eur = (v: number | null) => (v === null ? "—" : new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v));
    await registarEvento(tx, ctx, {
      matterId, kind: "pagamento",
      summary: `Valores atualizados: previsto ${eur(previsto)}, pago ${eur(pago)}.`,
      data: { antes: m, depois: { previsto, pago } },
    });
  });
}

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
