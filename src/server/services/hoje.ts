/**
 * Prazos e vista «Hoje».
 */
import { withTenant } from "../db";
import { diaLisboa } from "../domain/datas";
import type { Estado } from "../domain/estados";
import { calcularHoje, type PrazoHoje, type ProcessoHoje, type VistaHoje } from "../domain/hoje";
import { ErroNegocio, exigir, exigirUuid, registarEvento, type Ctx } from "./comum";

export async function criarPrazo(ctx: Ctx, matterId: string, label: string, dueOn: string) {
  exigirUuid(matterId, "Processo");
  const nome = label.trim();
  if (!nome) throw new ErroNegocio("Descreva o prazo.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) throw new ErroNegocio("Data do prazo inválida.");
  return withTenant(ctx, async (tx) => {
    const [m] = await tx`select 1 from matters where id = ${matterId}`;
    if (!m) throw new ErroNegocio("Processo não encontrado.", "nao_encontrado");
    const [d] = await tx<{ id: string }[]>`
      insert into deadlines (organization_id, matter_id, label, due_on, created_by)
      values (${ctx.orgId}, ${matterId}, ${nome.slice(0, 200)}, ${dueOn}, ${ctx.userId})
      returning id`;
    await registarEvento(tx, ctx, {
      matterId,
      kind: "prazo",
      summary: `Prazo indicado: «${nome}» a ${dueOn.split("-").reverse().join("/")} (por confirmar).`,
      data: { prazoId: d.id },
    });
    return d;
  });
}

export async function confirmarPrazo(ctx: Ctx, prazoId: string) {
  exigirUuid(prazoId, "Prazo");
  exigir(ctx, "confirmar_prazo");
  await withTenant(ctx, async (tx) => {
    const [d] = await tx<{ matter_id: string; label: string; status: string; due_on: string }[]>`
      select matter_id, label, status, due_on from deadlines where id = ${prazoId} for update`;
    if (!d) throw new ErroNegocio("Prazo não encontrado.", "nao_encontrado");
    if (d.status === "confirmado") return;
    await tx`
      update deadlines set status = 'confirmado', confirmed_by = ${ctx.userId}, confirmed_at = now()
      where id = ${prazoId}`;
    await registarEvento(tx, ctx, {
      matterId: d.matter_id,
      kind: "prazo",
      summary: `Prazo confirmado: «${d.label}» a ${d.due_on.split("-").reverse().join("/")}.`,
      data: { prazoId },
    });
  });
}

export async function removerPrazoPorConfirmar(ctx: Ctx, prazoId: string) {
  exigirUuid(prazoId, "Prazo");
  await withTenant(ctx, async (tx) => {
    const [d] = await tx<{ matter_id: string; label: string; status: string }[]>`
      select matter_id, label, status from deadlines where id = ${prazoId} for update`;
    if (!d) throw new ErroNegocio("Prazo não encontrado.", "nao_encontrado");
    if (d.status === "confirmado") {
      throw new ErroNegocio("Um prazo confirmado não pode ser removido.");
    }
    await tx`delete from deadlines where id = ${prazoId}`;
    await registarEvento(tx, ctx, {
      matterId: d.matter_id,
      kind: "prazo",
      summary: `Prazo por confirmar removido: «${d.label}».`,
    });
  });
}

export async function vistaHoje(ctx: Ctx, hoje: string = diaLisboa()): Promise<VistaHoje> {
  return withTenant(ctx, async (tx) => {
    const processos = await tx<{
      id: string; reference: string; state: Estado; state_since: Date;
      follow_up_on: string | null; responsible_id: string; responsible_name: string;
      client_name: string; falta: number; total: number;
    }[]>`
      select m.id, m.reference, m.state, m.state_since, m.follow_up_on, m.responsible_id,
             u.name as responsible_name, c.name as client_name,
             count(i.*) filter (where i.required and i.status in ('em_falta','rejeitado'))::int as falta,
             count(i.*) filter (where i.required)::int as total
      from matters m
      join users u on u.id = m.responsible_id
      join clients c on c.id = m.client_id
      left join matter_items i on i.matter_id = m.id
      where m.state <> 'concluido'
      group by m.id, u.name, c.name`;
    const emails = await tx<{
      id: string; from_name: string | null; from_email: string | null; subject: string;
      received_at: Date; anexos: number;
    }[]>`
      select e.id, e.from_name, e.from_email, e.subject, e.received_at,
             count(a.*)::int as anexos
      from inbox_messages e left join attachments a on a.inbox_message_id = e.id
      where e.archived_at is null
      group by e.id
      having count(a.*) filter (where a.matter_id is null) > 0 or count(a.*) = 0`;
    const prazos = await tx<{
      id: string; matter_id: string; reference: string; client_name: string;
      label: string; due_on: string; status: "por_confirmar" | "confirmado";
    }[]>`
      select d.id, d.matter_id, m.reference, c.name as client_name, d.label, d.due_on, d.status
      from deadlines d join matters m on m.id = d.matter_id
      join clients c on c.id = m.client_id
      where m.state <> 'concluido'`;

    return calcularHoje({
      hoje,
      processos: processos.map<ProcessoHoje>((p) => ({
        id: p.id,
        reference: p.reference,
        estado: p.state,
        stateSince: new Date(p.state_since).toISOString(),
        followUpOn: p.follow_up_on,
        responsavelId: p.responsible_id,
        responsavelNome: p.responsible_name,
        clienteNome: p.client_name,
        falta: p.falta,
        totalObrigatorios: p.total,
      })),
      emails: emails.map((e) => ({
        id: e.id,
        remetente: e.from_name ?? e.from_email ?? "remetente desconhecido",
        assunto: e.subject,
        anexos: e.anexos,
        recebidoEm: new Date(e.received_at).toISOString(),
      })),
      prazos: prazos.map<PrazoHoje>((d) => ({
        id: d.id,
        matterId: d.matter_id,
        reference: d.reference,
        clienteNome: d.client_name,
        label: d.label,
        dueOn: d.due_on,
        status: d.status,
      })),
    });
  });
}
