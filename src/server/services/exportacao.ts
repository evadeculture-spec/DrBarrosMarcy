/**
 * Exportar e restaurar.
 *
 *  - exportarEscritorio: todos os dados do escritório (sem palavras-passe
 *    nem sessões), com o conteúdo dos anexos.
 *  - exportarProcesso / apagarProcesso / restaurarProcesso: um processo
 *    completo, com anexos verificados por SHA-256 ao restaurar.
 */
import { z } from "zod";
import { withTenant, type Tx } from "../db";
import { ErroNegocio, exigir, exigirUuid, registarEvento, type Ctx } from "./comum";
import { sha256 } from "./triagem";

export const FORMATO_PROCESSO = "solicitaflow.processo";
export const FORMATO_ESCRITORIO = "solicitaflow.escritorio";

type Linha = Record<string, unknown>;

async function anexosComConteudo(tx: Tx, filtro: { matterId?: string }) {
  const rows = filtro.matterId
    ? await tx<Linha[]>`
        select a.*, encode(b.content, 'base64') as conteudo_base64
        from attachments a join attachment_blobs b on b.attachment_id = a.id
        where a.matter_id = ${filtro.matterId} order by a.created_at`
    : await tx<Linha[]>`
        select a.*, encode(b.content, 'base64') as conteudo_base64
        from attachments a join attachment_blobs b on b.attachment_id = a.id
        order by a.created_at`;
  return rows.map((r) => ({ ...r, conteudo_base64: String(r.conteudo_base64).replace(/\n/g, "") }));
}

// ---------------------------------------------------------------------------
// Processo
// ---------------------------------------------------------------------------

export async function exportarProcesso(ctx: Ctx, matterId: string) {
  exigirUuid(matterId, "Processo");
  return withTenant(ctx, async (tx) => {
    const [processo] = await tx<Linha[]>`
      select id, organization_id, year, number, reference, client_id, matter_type_id, title,
             state, state_since, responsible_id, follow_up_on, created_at, updated_at
      from matters where id = ${matterId}`;
    if (!processo) throw new ErroNegocio("Processo não encontrado.", "nao_encontrado");
    const [cliente] = await tx<Linha[]>`select * from clients where id = ${processo.client_id as string}`;
    const [tipo] = await tx<Linha[]>`select key, name from matter_types where id = ${processo.matter_type_id as string}`;
    return {
      formato: FORMATO_PROCESSO,
      versao: 1,
      exportadoEm: new Date().toISOString(),
      organizationId: ctx.orgId,
      processo,
      cliente,
      tipo,
      itens: await tx<Linha[]>`select * from matter_items where matter_id = ${matterId} order by position`,
      anexos: await anexosComConteudo(tx, { matterId }),
      prazos: await tx<Linha[]>`select * from deadlines where matter_id = ${matterId}`,
      pedidos: await tx<Linha[]>`select * from client_requests where matter_id = ${matterId}`,
      mensagensSaida: await tx<Linha[]>`
        select o.* from outbound_messages o join client_requests r on r.id = o.request_id
        where r.matter_id = ${matterId}`,
      tentativas: await tx<Linha[]>`
        select s.* from send_attempts s join client_requests r on r.id = s.request_id
        where r.matter_id = ${matterId}`,
      eventos: await tx<Linha[]>`
        select * from events where matter_id = ${matterId} order by created_at, id`,
    };
  });
}

export type ExportacaoProcesso = Awaited<ReturnType<typeof exportarProcesso>>;

/** Apaga definitivamente um processo (incluindo o histórico). Só administradores. */
export async function apagarProcesso(ctx: Ctx, matterId: string) {
  exigirUuid(matterId, "Processo");
  exigir(ctx, "apagar_processo");
  await withTenant(ctx, async (tx) => {
    const [r] = await tx<{ reference: string | null }[]>`
      select purgar_processo(${matterId}) as reference`;
    if (!r?.reference) throw new ErroNegocio("Processo não encontrado.", "nao_encontrado");
    const m = { reference: r.reference };
    await registarEvento(tx, ctx, {
      matterId: null,
      kind: "processo_apagado",
      summary: `Processo ${m.reference} apagado definitivamente.`,
      data: { matterId, reference: m.reference },
    });
  });
}

const L = z.record(z.string(), z.unknown());
const ExportacaoSchema = z.object({
  formato: z.literal(FORMATO_PROCESSO),
  versao: z.literal(1),
  organizationId: z.string().uuid(),
  processo: L,
  cliente: L,
  tipo: z.object({ key: z.string(), name: z.string() }),
  itens: z.array(L),
  anexos: z.array(L),
  prazos: z.array(L),
  pedidos: z.array(L),
  mensagensSaida: z.array(L),
  tentativas: z.array(L),
  eventos: z.array(L),
});

const s = (v: unknown) => (v === null || v === undefined ? null : String(v));

export async function restaurarProcesso(
  ctx: Ctx,
  dados: unknown,
): Promise<{ id: string; reference: string; anexos: number }> {
  exigir(ctx, "apagar_processo");
  const parsed = ExportacaoSchema.safeParse(dados);
  if (!parsed.success) {
    throw new ErroNegocio("O ficheiro não é uma exportação de processo válida.");
  }
  const e = parsed.data;
  if (e.organizationId !== ctx.orgId) {
    throw new ErroNegocio("Esta exportação pertence a outro escritório.", "proibido");
  }

  // Verificar o conteúdo de todos os anexos antes de escrever o que quer que seja.
  const anexos = e.anexos.map((a): Linha & { conteudo: Buffer } => {
    const conteudo = Buffer.from(String(a.conteudo_base64 ?? ""), "base64");
    if (sha256(conteudo) !== a.sha256) {
      throw new ErroNegocio(`O anexo «${s(a.filename)}» está corrompido (checksum diferente).`);
    }
    return { ...(a as Linha), conteudo };
  });

  return withTenant(ctx, async (tx) => {
    const p = e.processo;
    const [existe] = await tx`select 1 from matters where id = ${s(p.id)}`;
    if (existe) throw new ErroNegocio("Este processo já existe; apague-o antes de restaurar.");

    const utilizadores = new Set(
      (await tx<{ id: string }[]>`select id from users`).map((u) => u.id),
    );
    const userOu = (v: unknown, alternativa: string | null) => {
      const id = s(v);
      return id && utilizadores.has(id) ? id : alternativa;
    };

    const [tipo] = await tx<{ id: string }[]>`select id from matter_types where key = ${e.tipo.key}`;
    if (!tipo) {
      throw new ErroNegocio(`O tipo de processo «${e.tipo.name}» não existe neste escritório.`);
    }

    let clienteId = s(e.cliente.id);
    const [cli] = await tx`select 1 from clients where id = ${clienteId}`;
    if (!cli) {
      const [novo] = await tx<{ id: string }[]>`
        insert into clients (organization_id, name, email, phone, notes, created_at)
        values (${ctx.orgId}, ${s(e.cliente.name) ?? "Cliente"}, ${s(e.cliente.email)},
                ${s(e.cliente.phone)}, ${s(e.cliente.notes)},
                ${s(e.cliente.created_at) ?? new Date().toISOString()})
        returning id`;
      clienteId = novo.id;
    }

    const [taken] = await tx`select 1 from matters where year = ${Number(p.year)} and number = ${Number(p.number)}`;
    if (taken) throw new ErroNegocio(`Já existe outro processo com a referência ${s(p.reference)}.`);

    await tx`
      insert into matters (id, organization_id, year, number, client_id, matter_type_id, title,
                           state, state_since, responsible_id, follow_up_on, created_at, updated_at)
      values (${s(p.id)}, ${ctx.orgId}, ${Number(p.year)}, ${Number(p.number)}, ${clienteId},
              ${tipo.id}, ${s(p.title)}, ${s(p.state)}, ${s(p.state_since)},
              ${userOu(p.responsible_id, ctx.userId)}, ${s(p.follow_up_on)},
              ${s(p.created_at)}, ${s(p.updated_at)})`;

    for (const i of e.itens) {
      await tx`
        insert into matter_items (id, organization_id, matter_id, label, required, position,
                                  status, updated_at)
        values (${s(i.id)}, ${ctx.orgId}, ${s(p.id)}, ${s(i.label)}, ${Boolean(i.required)},
                ${Number(i.position ?? 0)}, ${s(i.status)}, ${s(i.updated_at)})`;
    }
    for (const a of anexos) {
      await tx`
        insert into attachments (id, organization_id, inbox_message_id, matter_id, item_id,
                                 filename, mime_type, size_bytes, sha256, created_by, created_at)
        values (${s(a.id)}, ${ctx.orgId}, null, ${s(p.id)}, ${s(a.item_id)}, ${s(a.filename)},
                ${s(a.mime_type)}, ${a.conteudo.length}, ${s(a.sha256)},
                ${userOu(a.created_by, null)}, ${s(a.created_at)})`;
      await tx`
        insert into attachment_blobs (attachment_id, organization_id, content)
        values (${s(a.id)}, ${ctx.orgId}, ${a.conteudo})`;
    }
    for (const d of e.prazos) {
      const confirmado = d.status === "confirmado";
      const confirmador = confirmado ? userOu(d.confirmed_by, ctx.userId) : null;
      await tx`
        insert into deadlines (id, organization_id, matter_id, label, due_on, status, created_by,
                               confirmed_by, confirmed_at, created_at)
        values (${s(d.id)}, ${ctx.orgId}, ${s(p.id)}, ${s(d.label)}, ${s(d.due_on)}, ${s(d.status)},
                ${userOu(d.created_by, ctx.userId)}, ${confirmador},
                ${confirmado ? s(d.confirmed_at) : null}, ${s(d.created_at)})`;
    }
    for (const r of e.pedidos) {
      await tx`
        insert into client_requests (id, organization_id, matter_id, status, to_email, subject, body,
                                     item_ids, created_by, submitted_at, approved_by, approved_at,
                                     sent_at, attempts, last_error, created_at, updated_at)
        values (${s(r.id)}, ${ctx.orgId}, ${s(p.id)}, ${s(r.status)}, ${s(r.to_email) ?? ""},
                ${s(r.subject) ?? ""}, ${s(r.body) ?? ""},
                ${(Array.isArray(r.item_ids) ? r.item_ids : []).map(String)}::uuid[],
                ${userOu(r.created_by, ctx.userId)}, ${s(r.submitted_at)},
                ${userOu(r.approved_by, null)}, ${s(r.approved_at)}, ${s(r.sent_at)},
                ${Number(r.attempts ?? 0)}, ${s(r.last_error)}, ${s(r.created_at)}, ${s(r.updated_at)})`;
    }
    for (const o of e.mensagensSaida) {
      await tx`
        insert into outbound_messages (id, organization_id, request_id, to_email, subject, body, sent_at)
        values (${s(o.id)}, ${ctx.orgId}, ${s(o.request_id)}, ${s(o.to_email)}, ${s(o.subject)},
                ${s(o.body)}, ${s(o.sent_at)})`;
    }
    for (const t of e.tentativas) {
      await tx`
        insert into send_attempts (id, organization_id, request_id, attempted_at, ok, error)
        values (${s(t.id)}, ${ctx.orgId}, ${s(t.request_id)}, ${s(t.attempted_at)}, ${Boolean(t.ok)},
                ${s(t.error)})`;
    }
    for (const ev of e.eventos) {
      await tx`
        insert into events (id, organization_id, matter_id, actor_id, kind, summary, data, created_at)
        values (${s(ev.id)}, ${ctx.orgId}, ${s(p.id)}, ${s(ev.actor_id)}, ${s(ev.kind)},
                ${s(ev.summary)}, ${tx.json((ev.data ?? {}) as never)}, ${s(ev.created_at)})`;
    }
    await registarEvento(tx, ctx, {
      matterId: s(p.id),
      kind: "restaurado",
      summary: `Processo restaurado a partir de exportação de ${new Date(String(dados && (dados as Linha).exportadoEm)).toLocaleDateString("pt-PT")} (${anexos.length} anexos verificados).`,
    });
    return { id: s(p.id)!, reference: s(p.reference)!, anexos: anexos.length };
  });
}

// ---------------------------------------------------------------------------
// Escritório
// ---------------------------------------------------------------------------

export async function exportarEscritorio(ctx: Ctx) {
  exigir(ctx, "gerir_escritorio");
  return withTenant(ctx, async (tx) => ({
    formato: FORMATO_ESCRITORIO,
    versao: 1,
    exportadoEm: new Date().toISOString(),
    escritorio: (await tx<Linha[]>`select id, slug, name, created_at from organizations`)[0],
    utilizadores: await tx<Linha[]>`
      select id, email, name, role, active, created_at from users order by name`,
    clientes: await tx<Linha[]>`select * from clients order by name`,
    tiposDeProcesso: await tx<Linha[]>`select * from matter_types order by position`,
    listasDocumentais: await tx<Linha[]>`select * from document_requirements order by matter_type_id, position`,
    modelos: await tx<Linha[]>`select * from message_templates order by key`,
    processos: await tx<Linha[]>`
      select id, year, number, reference, client_id, matter_type_id, title, state, state_since,
             responsible_id, follow_up_on, created_at, updated_at
      from matters order by year, number`,
    itens: await tx<Linha[]>`select * from matter_items order by matter_id, position`,
    emails: await tx<Linha[]>`select * from inbox_messages order by received_at`,
    anexos: await anexosComConteudo(tx, {}),
    prazos: await tx<Linha[]>`select * from deadlines order by due_on`,
    pedidos: await tx<Linha[]>`select * from client_requests order by created_at`,
    mensagensSaida: await tx<Linha[]>`select * from outbound_messages order by sent_at`,
    tentativas: await tx<Linha[]>`select * from send_attempts order by attempted_at`,
    historico: await tx<Linha[]>`select * from events order by created_at, id`,
  }));
}
