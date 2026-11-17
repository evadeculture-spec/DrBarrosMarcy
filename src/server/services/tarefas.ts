/**
 * Tarefas: manuais e a tarefa de revisão de documentos (uma por processo,
 * reaberta em vez de duplicada quando chega nova documentação).
 */
import { withTenant, type Tx } from "../db";
import { diaLisboa } from "../domain/datas";
import { ErroNegocio, exigirUuid, registarEvento, type Ctx } from "./comum";

export interface Tarefa {
  id: string;
  matter_id: string | null;
  matter_reference: string | null;
  client_name: string | null;
  kind: "manual" | "revisao_documentos";
  title: string;
  assignee_id: string;
  assignee_name: string;
  due_on: string | null;
  status: "aberta" | "concluida";
  completed_at: string | null;
  completed_by_name: string | null;
  created_at: string;
}

export type FiltroTarefas = "minhas" | "abertas" | "concluidas";

/** Mesma regra usada pelo cartão «Tarefas atribuídas a mim» e pela lista. */
export async function listarTarefas(
  ctx: Ctx,
  filtro: FiltroTarefas = "minhas",
  opcoes: { matterId?: string } = {},
): Promise<Tarefa[]> {
  const matterId = opcoes.matterId && /^[0-9a-f-]{36}$/i.test(opcoes.matterId) ? opcoes.matterId : null;
  return withTenant(ctx, (tx) => tx<Tarefa[]>`
    select t.id, t.matter_id, m.reference as matter_reference, c.name as client_name, t.kind,
           t.title, t.assignee_id, u.name as assignee_name, t.due_on, t.status, t.completed_at,
           uc.name as completed_by_name, t.created_at
    from tasks t
    join users u on u.id = t.assignee_id
    left join users uc on uc.id = t.completed_by
    left join matters m on m.id = t.matter_id
    left join clients c on c.id = m.client_id
    where (${matterId}::uuid is null or t.matter_id = ${matterId})
      and (
        (${filtro} = 'minhas' and t.status = 'aberta' and t.assignee_id = ${ctx.userId})
        or (${filtro} = 'abertas' and t.status = 'aberta')
        or (${filtro} = 'concluidas' and t.status = 'concluida'))
    order by t.status, t.due_on nulls last, t.created_at, t.id
    limit 500`);
}

export async function criarTarefa(
  ctx: Ctx,
  input: { matterId?: string | null; titulo: string; responsavelId: string; data?: string | null },
) {
  const titulo = input.titulo.trim();
  if (!titulo) throw new ErroNegocio("Descreva a tarefa.");
  exigirUuid(input.responsavelId, "Responsável");
  if (input.matterId) exigirUuid(input.matterId, "Processo");
  if (input.data && !/^\d{4}-\d{2}-\d{2}$/.test(input.data)) throw new ErroNegocio("Data inválida.");
  return withTenant(ctx, async (tx) => {
    const [u] = await tx<{ name: string }[]>`select name from users where id = ${input.responsavelId} and active`;
    if (!u) throw new ErroNegocio("Responsável não encontrado.");
    if (input.matterId) {
      const [m] = await tx`select 1 from matters where id = ${input.matterId}`;
      if (!m) throw new ErroNegocio("Processo não encontrado.", "nao_encontrado");
    }
    const [t] = await tx<{ id: string }[]>`
      insert into tasks (organization_id, matter_id, title, assignee_id, due_on, created_by)
      values (${ctx.orgId}, ${input.matterId ?? null}, ${titulo.slice(0, 300)}, ${input.responsavelId},
              ${input.data || null}, ${ctx.userId})
      returning id`;
    if (input.matterId) {
      await registarEvento(tx, ctx, {
        matterId: input.matterId,
        kind: "tarefa",
        summary: `Tarefa criada para ${u.name}: «${titulo}».`,
        data: { tarefaId: t.id },
      });
    }
    return t;
  });
}

async function bloquearTarefa(tx: Tx, id: string) {
  const [t] = await tx<{ id: string; matter_id: string | null; title: string; status: string; assignee_id: string }[]>`
    select id, matter_id, title, status, assignee_id from tasks where id = ${id} for update`;
  if (!t) throw new ErroNegocio("Tarefa não encontrada.", "nao_encontrado");
  return t;
}

export async function atribuirTarefa(ctx: Ctx, id: string, userId: string) {
  exigirUuid(id, "Tarefa");
  exigirUuid(userId, "Utilizador");
  await withTenant(ctx, async (tx) => {
    const t = await bloquearTarefa(tx, id);
    const [u] = await tx<{ name: string }[]>`select name from users where id = ${userId} and active`;
    if (!u) throw new ErroNegocio("Utilizador não encontrado.");
    if (t.assignee_id === userId) return;
    await tx`update tasks set assignee_id = ${userId}, updated_at = now() where id = ${id}`;
    if (t.matter_id) {
      await registarEvento(tx, ctx, {
        matterId: t.matter_id,
        kind: "tarefa",
        summary: userId === ctx.userId
          ? `${u.name} assumiu a tarefa «${t.title}».`
          : `Tarefa «${t.title}» atribuída a ${u.name}.`,
        data: { tarefaId: id, de: t.assignee_id, para: userId },
      });
    }
  });
}

export async function concluirTarefa(ctx: Ctx, id: string, concluida = true) {
  exigirUuid(id, "Tarefa");
  await withTenant(ctx, async (tx) => {
    const t = await bloquearTarefa(tx, id);
    const novo = concluida ? "concluida" : "aberta";
    if (t.status === novo) return;
    await tx`
      update tasks set status = ${novo}, completed_by = ${concluida ? ctx.userId : null},
             completed_at = ${concluida ? new Date() : null}, updated_at = now()
      where id = ${id}`;
    if (t.matter_id) {
      await registarEvento(tx, ctx, {
        matterId: t.matter_id,
        kind: "tarefa",
        summary: concluida ? `Tarefa concluída: «${t.title}».` : `Tarefa reaberta: «${t.title}».`,
        data: { tarefaId: id },
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Revisão de documentos
// ---------------------------------------------------------------------------

/**
 * Garante uma tarefa de revisão aberta para o processo: cria-a, ou reabre a
 * existente. Nunca cria uma segunda (índice único na BD).
 */
export async function garantirRevisao(tx: Tx, ctx: Ctx, matterId: string, motivo: string): Promise<void> {
  const [m] = await tx<{ responsible_id: string; reference: string }[]>`
    select responsible_id, reference from matters where id = ${matterId}`;
  const [t] = await tx<{ id: string; status: string }[]>`
    select id, status from tasks where matter_id = ${matterId} and kind = 'revisao_documentos' for update`;
  if (t?.status === "aberta") return;
  if (t) {
    await tx`
      update tasks set status = 'aberta', completed_by = null, completed_at = null,
             due_on = ${diaLisboa()}, updated_at = now()
      where id = ${t.id}`;
    await registarEvento(tx, ctx, {
      matterId,
      kind: "tarefa",
      summary: `Tarefa de revisão reaberta (${motivo}).`,
      data: { tarefaId: t.id },
    });
    return;
  }
  const [n] = await tx<{ id: string }[]>`
    insert into tasks (organization_id, matter_id, kind, title, assignee_id, due_on, created_by)
    values (${ctx.orgId}, ${matterId}, 'revisao_documentos', ${`Rever documentos recebidos (${m.reference})`},
            ${m.responsible_id}, ${diaLisboa()}, ${ctx.userId})
    returning id`;
  await registarEvento(tx, ctx, {
    matterId,
    kind: "tarefa",
    summary: `Tarefa de revisão criada (${motivo}).`,
    data: { tarefaId: n.id },
  });
}

/** Fecha a revisão quando já não há documentos obrigatórios por rever. */
export async function fecharRevisaoSeConcluida(tx: Tx, ctx: Ctx, matterId: string): Promise<void> {
  const [{ n }] = await tx<{ n: number }[]>`
    select count(*)::int as n from matter_items where matter_id = ${matterId} and status = 'recebido'`;
  if (n > 0) return;
  const r = await tx<{ id: string }[]>`
    update tasks set status = 'concluida', completed_by = ${ctx.userId}, completed_at = now(), updated_at = now()
    where matter_id = ${matterId} and kind = 'revisao_documentos' and status = 'aberta'
    returning id`;
  if (r.length) {
    await registarEvento(tx, ctx, {
      matterId,
      kind: "tarefa",
      summary: "Revisão concluída: não há documentos recebidos por rever.",
      data: { tarefaId: r[0].id },
    });
  }
}
