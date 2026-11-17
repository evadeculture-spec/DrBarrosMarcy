/**
 * Triagem: emails carregados à mão, anexos, associar e mover com «Anular».
 *
 * Associar e mover guardam no histórico uma fotografia «antes» e «depois»
 * de tudo o que tocam (anexo, itens, estado dos processos). «Anular» repõe
 * a fotografia «antes» — só se nada tiver mudado entretanto.
 */
import { createHash } from "node:crypto";
import { normalizar as normalizarTexto } from "./clientes";
import { withTenant, type Tx } from "../db";
import { ESTADO_ROTULO, type Estado } from "../domain/estados";
import type { EstadoItem } from "../domain/faixa";
import { fecharRevisaoSeConcluida, garantirRevisao } from "./tarefas";
import {
  bloquearProcesso,
  ErroNegocio,
  exigirUuid,
  mudarEstadoSistema,
  registarEvento,
  type Ctx,
  type MatterLock,
} from "./comum";

export const LIMITE_FICHEIRO = 15 * 1024 * 1024;
export const LIMITE_TOTAL = 25 * 1024 * 1024;
export const MAX_FICHEIROS = 20;

const TIPOS_ACEITES = [
  /^application\/pdf$/,
  /^image\/(png|jpeg|gif|webp|heic|heif|tiff)$/,
  /^text\/plain$/,
  /^application\/msword$/,
  /^application\/vnd\.openxmlformats-officedocument\./,
  /^application\/vnd\.oasis\.opendocument\./,
  /^application\/vnd\.ms-excel$/,
];

export interface FicheiroNovo {
  filename: string;
  mimeType: string;
  content: Buffer;
}

export function sha256(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function limparNome(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? "ficheiro";
  // eslint-disable-next-line no-control-regex
  const limpo = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255);
  return limpo || "ficheiro";
}

function validarFicheiros(ficheiros: FicheiroNovo[]) {
  if (ficheiros.length > MAX_FICHEIROS) {
    throw new ErroNegocio(`No máximo ${MAX_FICHEIROS} ficheiros de cada vez.`);
  }
  let total = 0;
  for (const f of ficheiros) {
    if (f.content.length > LIMITE_FICHEIRO) {
      throw new ErroNegocio(`«${limparNome(f.filename)}» excede 15 MB.`);
    }
    if (!TIPOS_ACEITES.some((r) => r.test(f.mimeType))) {
      throw new ErroNegocio(
        `«${limparNome(f.filename)}»: tipo de ficheiro não aceite (${f.mimeType || "desconhecido"}).`,
      );
    }
    total += f.content.length;
  }
  if (total > LIMITE_TOTAL) throw new ErroNegocio("O total dos ficheiros excede 25 MB.");
}

async function inserirAnexo(
  tx: Tx,
  ctx: Ctx,
  f: FicheiroNovo,
  inboxMessageId: string | null,
): Promise<string> {
  const [a] = await tx<{ id: string }[]>`
    insert into attachments (organization_id, inbox_message_id, filename, mime_type,
                             size_bytes, sha256, created_by)
    values (${ctx.orgId}, ${inboxMessageId}, ${limparNome(f.filename)}, ${f.mimeType},
            ${f.content.length}, ${sha256(f.content)}, ${ctx.userId})
    returning id`;
  await tx`
    insert into attachment_blobs (attachment_id, organization_id, content)
    values (${a.id}, ${ctx.orgId}, ${f.content})`;
  return a.id;
}

// ---------------------------------------------------------------------------
// Caixa de entrada
// ---------------------------------------------------------------------------

export interface NovoEmail {
  remetenteNome?: string;
  remetenteEmail?: string;
  assunto?: string;
  corpo?: string;
  recebidoEm?: string | null;
  /** Como chegou: email, entregue em mão, correio ou outro. */
  origem?: string | null;
  ficheiros: FicheiroNovo[];
}

export const ORIGENS = {
  email: "Email",
  entregue_em_mao: "Entregue em mão",
  correio: "Correio",
  outro: "Outro",
} as const;

export async function carregarEmail(ctx: Ctx, e: NovoEmail): Promise<{ id: string; anexos: string[] }> {
  validarFicheiros(e.ficheiros);
  const nome = e.remetenteNome?.trim() || null;
  const email = e.remetenteEmail?.trim().toLowerCase() || null;
  if (!nome && !email) throw new ErroNegocio("Indique o remetente (nome ou email).");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ErroNegocio("Email do remetente inválido.");
  }
  if (!e.assunto?.trim() && !e.corpo?.trim() && e.ficheiros.length === 0) {
    throw new ErroNegocio("O email está vazio: indique assunto, texto ou anexos.");
  }
  const origem = e.origem && e.origem in ORIGENS ? e.origem : "email";
  const recebido = e.recebidoEm && !Number.isNaN(Date.parse(e.recebidoEm))
    ? new Date(e.recebidoEm)
    : new Date();

  return withTenant(ctx, async (tx) => {
    const [m] = await tx<{ id: string }[]>`
      insert into inbox_messages (organization_id, from_name, from_email, subject, body,
                                  received_at, created_by, origem)
      values (${ctx.orgId}, ${nome}, ${email}, ${e.assunto?.trim() ?? ""},
              ${e.corpo ?? ""}, ${recebido}, ${ctx.userId}, ${origem})
      returning id`;
    const anexos: string[] = [];
    for (const f of e.ficheiros) anexos.push(await inserirAnexo(tx, ctx, f, m.id));
    await registarEvento(tx, ctx, {
      matterId: null,
      kind: "email_carregado",
      summary: `Email de ${nome ?? email} carregado na triagem (${anexos.length} anexos).`,
      data: { inboxMessageId: m.id },
    });
    return { id: m.id, anexos };
  });
}

export interface AnexoCaixa {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  matter_id: string | null;
  matter_reference: string | null;
  item_label: string | null;
  /** Sugestão (heurística, sem IA) de processo e documento; a pessoa confirma. */
  sugestao: { matterId: string; reference: string; cliente: string; itemId: string | null; itemLabel: string | null } | null;
}

export interface EmailCaixa {
  id: string;
  origem: keyof typeof ORIGENS;
  from_name: string | null;
  from_email: string | null;
  subject: string;
  body: string;
  received_at: string;
  archived_at: string | null;
  anexos: AnexoCaixa[];
  /** Processos sugeridos pelo email do remetente (só sugestão). */
  sugestoes: { id: string; reference: string; title: string }[];
}

export async function listarCaixa(
  ctx: Ctx,
  opcoes: { arquivados?: boolean } = {},
): Promise<EmailCaixa[]> {
  return withTenant(ctx, async (tx) => {
    const emails = await tx<Omit<EmailCaixa, "anexos" | "sugestoes">[]>`
      select id, from_name, from_email, subject, body, received_at, archived_at, origem
      from inbox_messages
      where (${opcoes.arquivados ?? false} and archived_at is not null)
         or (not ${opcoes.arquivados ?? false} and archived_at is null)
      order by received_at asc
      limit 200`;
    if (emails.length === 0) return [];
    const ids = emails.map((e) => e.id);
    const anexos = await tx<(Omit<AnexoCaixa, "sugestao"> & { inbox_message_id: string })[]>`
      select a.id, a.filename, a.mime_type, a.size_bytes, a.matter_id, a.inbox_message_id,
             m.reference as matter_reference, i.label as item_label
      from attachments a
      left join matters m on m.id = a.matter_id
      left join matter_items i on i.id = a.item_id
      where a.inbox_message_id = any(${ids}::uuid[])
      order by a.created_at`;
    const remetentes = emails.map((e) => e.from_email).filter(Boolean) as string[];
    const sugestoes = remetentes.length
      ? await tx<{ id: string; reference: string; title: string; email: string }[]>`
          select m.id, m.reference, m.title, lower(c.email) as email
          from matters m join clients c on c.id = m.client_id
          where lower(c.email) = any(${remetentes}::text[]) and m.state <> 'concluido'
          order by m.state_since`
      : [];
    // Candidatos para sugestão: processos ativos, clientes e documentos em falta.
    const candidatos = await tx<{ id: string; reference: string; client_name: string; email: string | null; item_id: string | null; label: string | null }[]>`
      select m.id, m.reference, c.name as client_name, lower(c.email) as email, i.id as item_id, i.label
      from matters m join clients c on c.id = m.client_id
      left join matter_items i on i.matter_id = m.id and i.status in ('em_falta', 'rejeitado')
      where m.state <> 'concluido'`;
    const sugerir = (filename: string, remetente: string | null): AnexoCaixa["sugestao"] => {
      const nome = normalizarTexto(filename.replace(/\.[a-z0-9]+$/i, "").replace(/[_\-.]+/g, " "));
      const palavras = new Set(nome.split(/\s+/).filter((w) => w.length > 2));
      // 1. Nome do cliente no nome do ficheiro tem precedência sobre o remetente.
      let porNome = candidatos.filter((c) => {
        const partes = normalizarTexto(c.client_name).split(/\s+/).filter((w) => w.length > 2);
        return partes.length >= 2 && partes.every((w) => palavras.has(w));
      });
      if (porNome.length === 0 && remetente) porNome = candidatos.filter((c) => c.email === remetente);
      if (porNome.length === 0) return null;
      // Pontuação por processo: palavras do documento em falta presentes no nome do ficheiro.
      const melhorPorProcesso = new Map<string, { pontos: number; linha: (typeof porNome)[number] }>();
      for (const l of porNome) {
        let pontos = 0;
        if (l.label) {
          const ws = normalizarTexto(l.label).split(/\s+/).filter((w) => w.length > 3);
          pontos = ws.filter((w) => palavras.has(w)).length;
        }
        const atual = melhorPorProcesso.get(l.id);
        if (!atual || pontos > atual.pontos) melhorPorProcesso.set(l.id, { pontos, linha: l });
      }
      const ordenados = [...melhorPorProcesso.values()].sort((a, b) => b.pontos - a.pontos);
      let escolhido: (typeof ordenados)[number] | undefined;
      if (ordenados.length === 1) escolhido = ordenados[0];
      else if (ordenados[0].pontos > 0 && ordenados[0].pontos > ordenados[1].pontos) escolhido = ordenados[0];
      if (!escolhido) return null; // ambíguo: decide a pessoa
      const base = escolhido.linha;
      return {
        matterId: base.id,
        reference: base.reference,
        cliente: base.client_name,
        itemId: escolhido.pontos >= 1 ? base.item_id : null,
        itemLabel: escolhido.pontos >= 1 ? base.label : null,
      };
    };
    return emails.map((e) => ({
      ...e,
      anexos: anexos
        .filter((a) => a.inbox_message_id === e.id)
        .map((a) => ({ ...a, sugestao: a.matter_id ? null : sugerir(a.filename, e.from_email) })),
      sugestoes: sugestoes
        .filter((s) => e.from_email && s.email === e.from_email)
        .map(({ id, reference, title }) => ({ id, reference, title })),
    }));
  });
}

export async function arquivarEmail(ctx: Ctx, id: string, arquivar: boolean) {
  exigirUuid(id, "Email");
  await withTenant(ctx, async (tx) => {
    const r = await tx`
      update inbox_messages set archived_at = ${arquivar ? new Date() : null}
      where id = ${id} returning id`;
    if (r.length === 0) throw new ErroNegocio("Email não encontrado.", "nao_encontrado");
  });
}

// ---------------------------------------------------------------------------
// Fotografias para «Anular»
// ---------------------------------------------------------------------------

interface Fotografia {
  anexo: { id: string; matter_id: string | null; item_id: string | null };
  itens: { id: string; status: EstadoItem; updated_at: string }[];
  processos: { id: string; state: Estado; state_since: string; updated_at: string }[];
}

async function fotografar(
  tx: Tx,
  anexoId: string,
  itemIds: string[],
  matterIds: string[],
): Promise<Fotografia> {
  const [anexo] = await tx<Fotografia["anexo"][]>`
    select id, matter_id, item_id from attachments where id = ${anexoId}`;
  const ids = [...new Set(itemIds)];
  const itens = ids.length
    ? await tx<Fotografia["itens"]>`
        select id, status, updated_at::text as updated_at
        from matter_items where id = any(${ids}::uuid[]) order by id`
    : [];
  const processos = matterIds.length
    ? await tx<Fotografia["processos"]>`
        select id, state, state_since::text as state_since, updated_at::text as updated_at
        from matters where id = any(${matterIds}::uuid[]) order by id`
    : [];
  // Os instantes vão como texto com precisão total para a reposição ser exata.
  return { anexo, itens: [...itens], processos: [...processos] };
}

/** Serialização com chaves ordenadas: o jsonb não preserva a ordem das chaves. */
function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

function iguais(a: Fotografia, b: Fotografia): boolean {
  return canonico(a) === canonico(b);
}

/** Efeitos de um documento entrar num processo (item e estado). */
async function aoEntrarDocumento(
  tx: Tx,
  ctx: Ctx,
  m: MatterLock,
  itemId: string | null,
  motivo: string,
) {
  let itemObrigatorio = false;
  if (itemId) {
    const [item] = await tx<{ status: EstadoItem; required: boolean }[]>`
      select status, required from matter_items where id = ${itemId} and matter_id = ${m.id}`;
    if (!item) throw new ErroNegocio("O documento escolhido não pertence a este processo.");
    itemObrigatorio = item.required;
    if (item.status === "em_falta" || item.status === "rejeitado") {
      await tx`update matter_items set status = 'recebido', updated_at = now() where id = ${itemId}`;
    }
    if (item.status !== "conferido") await garantirRevisao(tx, ctx, m.id, motivo);
  }
  if (m.state === "por_triar") {
    await mudarEstadoSistema(tx, ctx, m, "em_conferencia", motivo);
  } else if (m.state === "a_aguardar_cliente") {
    await mudarEstadoSistema(tx, ctx, m, "resposta_por_conferir", motivo);
  } else if (m.state === "completo" && itemObrigatorio) {
    await mudarEstadoSistema(tx, ctx, m, "em_conferencia", motivo);
  }
}

/** Efeitos de um documento sair de um processo. */
async function aoSairDocumento(
  tx: Tx,
  ctx: Ctx,
  m: MatterLock,
  anexoId: string,
  itemId: string | null,
) {
  if (!itemId) return;
  const [outros] = await tx<{ n: number }[]>`
    select count(*)::int as n from attachments where item_id = ${itemId} and id <> ${anexoId}`;
  if (outros.n > 0) return;
  const [item] = await tx<{ status: EstadoItem; required: boolean }[]>`
    select status, required from matter_items where id = ${itemId}`;
  if (item && item.status !== "em_falta") {
    await tx`update matter_items set status = 'em_falta', updated_at = now() where id = ${itemId}`;
    if (m.state === "completo" && item.required) {
      await mudarEstadoSistema(tx, ctx, m, "em_conferencia", "documento retirado");
    }
  }
}

async function bloquearAnexo(tx: Tx, anexoId: string) {
  const [a] = await tx<{ id: string; filename: string; matter_id: string | null; item_id: string | null }[]>`
    select id, filename, matter_id, item_id from attachments where id = ${anexoId} for update`;
  if (!a) throw new ErroNegocio("Anexo não encontrado.", "nao_encontrado");
  return a;
}

// ---------------------------------------------------------------------------
// Associar
// ---------------------------------------------------------------------------

export async function associarAnexoTx(
  tx: Tx,
  ctx: Ctx,
  anexoId: string,
  matterId: string,
  itemId: string | null,
): Promise<{ eventoId: string }> {
  const a = await bloquearAnexo(tx, anexoId);
  if (a.matter_id) {
    throw new ErroNegocio("Este anexo já está num processo. Use «Mover».");
  }
  const m = await bloquearProcesso(tx, matterId);
  if (m.state === "concluido") {
    throw new ErroNegocio(`O processo ${m.reference} está concluído. Reabra-o primeiro.`);
  }
  if (itemId) {
    const [ok] = await tx`select 1 from matter_items where id = ${itemId} and matter_id = ${matterId}`;
    if (!ok) throw new ErroNegocio("O documento escolhido não pertence a este processo.");
  }
  const itens = itemId ? [itemId] : [];
  const antes = await fotografar(tx, anexoId, itens, [matterId]);

  await tx`update attachments set matter_id = ${matterId}, item_id = ${itemId} where id = ${anexoId}`;
  await aoEntrarDocumento(tx, ctx, m, itemId, "documento recebido");

  const depois = await fotografar(tx, anexoId, itens, [matterId]);
  const itemLabel = itemId
    ? (await tx<{ label: string }[]>`select label from matter_items where id = ${itemId}`)[0].label
    : null;
  const eventoId = await registarEvento(tx, ctx, {
    matterId,
    kind: "anexo_associado",
    summary: `Anexo «${a.filename}» associado${itemLabel ? ` a «${itemLabel}»` : ""}.`,
    data: { anexoId, antes, depois },
  });
  return { eventoId };
}

export async function associarAnexo(
  ctx: Ctx,
  anexoId: string,
  matterId: string,
  itemId: string | null,
) {
  exigirUuid(anexoId, "Anexo");
  exigirUuid(matterId, "Processo");
  if (itemId) exigirUuid(itemId, "Documento");
  return withTenant(ctx, (tx) => associarAnexoTx(tx, ctx, anexoId, matterId, itemId));
}

/** Carregar um ficheiro diretamente na ficha de um processo. */
export async function carregarNoProcesso(
  ctx: Ctx,
  matterId: string,
  itemId: string | null,
  f: FicheiroNovo,
) {
  exigirUuid(matterId, "Processo");
  if (itemId) exigirUuid(itemId, "Documento");
  validarFicheiros([f]);
  return withTenant(ctx, async (tx) => {
    const anexoId = await inserirAnexo(tx, ctx, f, null);
    return associarAnexoTx(tx, ctx, anexoId, matterId, itemId);
  });
}

// ---------------------------------------------------------------------------
// Mover
// ---------------------------------------------------------------------------

export async function moverAnexo(
  ctx: Ctx,
  anexoId: string,
  destinoId: string,
  itemDestinoId: string | null,
): Promise<{ eventoId: string }> {
  exigirUuid(anexoId, "Anexo");
  exigirUuid(destinoId, "Processo");
  if (itemDestinoId) exigirUuid(itemDestinoId, "Documento");
  return withTenant(ctx, async (tx) => {
    const a = await bloquearAnexo(tx, anexoId);
    if (!a.matter_id) throw new ErroNegocio("Este anexo ainda não está em nenhum processo.");
    const origemId = a.matter_id;
    if (origemId === destinoId) throw new ErroNegocio("O anexo já está neste processo.");

    // Bloquear sempre pela mesma ordem evita bloqueios mútuos.
    const [primeiro, segundo] = [origemId, destinoId].sort();
    const p1 = await bloquearProcesso(tx, primeiro);
    const p2 = await bloquearProcesso(tx, segundo);
    const origem = p1.id === origemId ? p1 : p2;
    const destino = p1.id === destinoId ? p1 : p2;
    for (const p of [origem, destino]) {
      if (p.state === "concluido") {
        throw new ErroNegocio(`O processo ${p.reference} está concluído. Reabra-o primeiro.`);
      }
    }
    if (itemDestinoId) {
      const [ok] = await tx`select 1 from matter_items where id = ${itemDestinoId} and matter_id = ${destinoId}`;
      if (!ok) throw new ErroNegocio("O documento escolhido não pertence ao processo de destino.");
    }

    const itens = [a.item_id, itemDestinoId].filter(Boolean) as string[];
    const processos = [origemId, destinoId];
    const antes = await fotografar(tx, anexoId, itens, processos);

    await tx`update attachments set matter_id = ${destinoId}, item_id = ${itemDestinoId} where id = ${anexoId}`;
    await aoSairDocumento(tx, ctx, origem, anexoId, a.item_id);
    await fecharRevisaoSeConcluida(tx, ctx, origemId);
    await aoEntrarDocumento(tx, ctx, destino, itemDestinoId, "documento movido de outro processo");

    const depois = await fotografar(tx, anexoId, itens, processos);
    const data = {
      anexoId,
      origem: { id: origemId, reference: origem.reference },
      destino: { id: destinoId, reference: destino.reference },
      antes,
      depois,
    };
    const eventoId = await registarEvento(tx, ctx, {
      matterId: origemId,
      kind: "anexo_movido",
      summary: `Anexo «${a.filename}» movido para ${destino.reference}.`,
      data,
    });
    await registarEvento(tx, ctx, {
      matterId: destinoId,
      kind: "anexo_recebido",
      summary: `Anexo «${a.filename}» movido de ${origem.reference}.`,
      data: { anexoId, origem: data.origem, destino: data.destino, operacao: eventoId },
    });
    return { eventoId };
  });
}

// ---------------------------------------------------------------------------
// Anular
// ---------------------------------------------------------------------------

export async function anularOperacao(ctx: Ctx, eventoId: string): Promise<void> {
  exigirUuid(eventoId, "Operação");
  await withTenant(ctx, async (tx) => {
    const [ev] = await tx<{ id: string; kind: string; data: { anexoId: string; antes: Fotografia; depois: Fotografia } }[]>`
      select id, kind, data from events where id = ${eventoId}`;
    if (!ev || !["anexo_associado", "anexo_movido"].includes(ev.kind)) {
      throw new ErroNegocio("Não há nada para anular.", "nao_encontrado");
    }
    const [ja] = await tx`
      select 1 from events where kind = 'anulado' and data->>'anula' = ${eventoId}`;
    if (ja) throw new ErroNegocio("Esta operação já foi anulada.");

    const { antes, depois, anexoId } = ev.data;
    const processos = antes.processos.map((p) => p.id).sort();
    const locks: MatterLock[] = [];
    for (const id of processos) locks.push(await bloquearProcesso(tx, id));
    await bloquearAnexo(tx, anexoId);

    const agora = await fotografar(tx, anexoId, antes.itens.map((i) => i.id), processos);
    if (!iguais(agora, depois)) {
      throw new ErroNegocio(
        "Entretanto houve alterações a estes documentos ou processos; já não é possível anular.",
        "conflito",
      );
    }

    await tx`
      update attachments set matter_id = ${antes.anexo.matter_id}, item_id = ${antes.anexo.item_id}
      where id = ${anexoId}`;
    for (const i of antes.itens) {
      await tx`
        update matter_items set status = ${i.status}, updated_at = ${i.updated_at}::text::timestamptz
        where id = ${i.id}`;
    }
    for (const p of antes.processos) {
      await tx`
        update matters set state = ${p.state}, state_since = ${p.state_since}::text::timestamptz,
                           updated_at = ${p.updated_at}::text::timestamptz
        where id = ${p.id}`;
    }
    for (const p of antes.processos) await fecharRevisaoSeConcluida(tx, ctx, p.id);
    for (const p of antes.processos) {
      const estadoAntes = p.state;
      const estadoDepois = depois.processos.find((d) => d.id === p.id)?.state;
      await registarEvento(tx, ctx, {
        matterId: p.id,
        kind: "anulado",
        summary:
          `Anulado: ${ev.kind === "anexo_movido" ? "movimento" : "associação"} de anexo` +
          (estadoDepois && estadoDepois !== estadoAntes
            ? ` (estado reposto: ${ESTADO_ROTULO[estadoAntes]})`
            : "") +
          ".",
        data: { anula: eventoId },
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Descarregar
// ---------------------------------------------------------------------------

export async function lerAnexo(ctx: Ctx, anexoId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(anexoId)) return null;
  return withTenant(ctx, async (tx) => {
    const [r] = await tx<{ filename: string; mime_type: string; content: Buffer; sha256: string }[]>`
      select a.filename, a.mime_type, a.sha256, b.content
      from attachments a join attachment_blobs b on b.attachment_id = a.id
      where a.id = ${anexoId}`;
    return r ?? null;
  });
}


/**
 * Demonstração: simula a resposta do cliente com três anexos — até dois
 * documentos em falta deste processo e um que pertence a outro processo.
 * Fica pelo menos um documento obrigatório em falta quando possível.
 */
export async function simularRececao(ctx: Ctx, matterId: string, pdf: (texto: string) => Buffer) {
  exigirUuid(matterId, "Processo");
  const dados = await withTenant(ctx, async (tx) => {
    const [m] = await tx<{ reference: string; client_name: string; client_email: string | null }[]>`
      select m.reference, c.name as client_name, c.email as client_email
      from matters m join clients c on c.id = m.client_id where m.id = ${matterId}`;
    if (!m) throw new ErroNegocio("Processo não encontrado.", "nao_encontrado");
    const emFalta = await tx<{ label: string }[]>`
      select label from matter_items where matter_id = ${matterId} and required
        and status in ('em_falta', 'rejeitado') order by position`;
    const [outro] = await tx<{ client_name: string; label: string }[]>`
      select c.name as client_name, i.label from matters o join clients c on c.id = o.client_id
      join matter_items i on i.matter_id = o.id and i.status = 'em_falta'
      where o.id <> ${matterId} and o.state <> 'concluido' and o.client_id <> (select client_id from matters where id = ${matterId})
      order by o.year desc, o.number desc, i.position limit 1`;
    return { m, emFalta, outro };
  });
  const { m, emFalta, outro } = dados;
  const arquivo = (label: string, cliente: string) =>
    `${label.replace(/[^A-Za-zÀ-ÿ0-9]+/g, "_").replace(/^_|_$/g, "")}_${cliente.replace(/[^A-Za-zÀ-ÿ0-9]+/g, "_")}.pdf`;
  // Deixa um documento obrigatório em falta (se houver mais do que um).
  const enviar = emFalta.slice(0, Math.max(0, Math.min(2, emFalta.length - 1)));
  const ficheiros: FicheiroNovo[] = enviar.map((i) => ({
    filename: arquivo(i.label, m.client_name),
    mimeType: "application/pdf",
    content: pdf(`${i.label} - ${m.client_name} (demonstracao)`),
  }));
  while (ficheiros.length < 2) {
    ficheiros.push({
      filename: `Documento_adicional_${ficheiros.length + 1}_${m.client_name.replace(/\s+/g, "_")}.pdf`,
      mimeType: "application/pdf",
      content: pdf(`Documento adicional - ${m.client_name} (demonstracao)`),
    });
  }
  if (outro) {
    ficheiros.push({
      filename: arquivo(outro.label, outro.client_name),
      mimeType: "application/pdf",
      content: pdf(`${outro.label} - ${outro.client_name} (demonstracao)`),
    });
  }
  return carregarEmail(ctx, {
    remetenteNome: m.client_name,
    remetenteEmail: m.client_email ?? undefined,
    assunto: `Re: Processo ${m.reference} — documentos`,
    corpo: `Bom dia,\n\nEnvio os documentos pedidos.\n\nCumprimentos,\n${m.client_name}`,
    origem: "email",
    ficheiros,
  });
}
