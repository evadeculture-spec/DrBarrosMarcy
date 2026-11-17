/**
 * Dashboard: Prioridades de hoje, processos parados por motivo e
 * notificações do sino.
 */
import { withTenant } from "../db";
import { diaLisboa, diferencaDias, FUSO } from "../domain/datas";
import { pode } from "../domain/papeis";
import type { Ctx } from "./comum";
import { vistaHoje } from "./hoje";
import { MOTIVOS_BLOQUEIO, resumoIndicadores, type MotivoBloqueio } from "./indicadores";

export interface Prioridade {
  chave: string;
  acao: string;
  processo: string;
  responsavel: string;
  motivo: string;
  tipo: "prazo" | "tarefa" | "acao" | "lembrete" | "triagem";
  urgente: boolean;
  href: string;
}

/** Saudação pela hora de Lisboa. */
export function saudacao(agora: Date = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", hour12: false }).format(agora)) % 24;
  if (h >= 6 && h < 12) return "Bom dia";
  if (h >= 12 && h < 20) return "Boa tarde";
  return "Boa noite";
}

export async function dadosDashboard(ctx: Ctx, hoje: string = diaLisboa()) {
  const [cartoes, vista] = await Promise.all([resumoIndicadores(ctx, hoje), vistaHoje(ctx, hoje)]);

  const prioridades: Prioridade[] = [];
  // 1. Prazos confirmados vencidos ou de hoje (precedência máxima).
  for (const l of [...cartoes.prazos_vencidos.linhas, ...cartoes.prazos_hoje.linhas]) {
    const [acao, ref] = l.titulo.split(" · ");
    const [cliente, responsavel] = l.detalhe.split(" · ");
    prioridades.push({
      chave: `prazo:${l.id}`,
      acao: `Cumprir prazo: ${acao}`,
      processo: `${ref} · ${cliente}`,
      responsavel,
      motivo: l.etiqueta ?? "",
      tipo: "prazo",
      urgente: true,
      href: l.href,
    });
  }
  // 2. Tarefas abertas com data de hoje ou ultrapassada.
  const tarefas = await withTenant(ctx, (tx) => tx<{
    id: string; title: string; due_on: string; matter_id: string | null; reference: string | null;
    client_name: string | null; assignee_name: string;
  }[]>`
    select t.id, t.title, t.due_on, t.matter_id, m.reference, c.name as client_name, u.name as assignee_name
    from tasks t join users u on u.id = t.assignee_id
    left join matters m on m.id = t.matter_id left join clients c on c.id = m.client_id
    where t.status = 'aberta' and t.due_on <= ${hoje}::date
    order by t.due_on, t.id`);
  for (const t of tarefas) {
    const dias = diferencaDias(t.due_on, hoje);
    prioridades.push({
      chave: `tarefa:${t.id}`,
      acao: t.title,
      processo: t.reference ? `${t.reference} · ${t.client_name}` : "Sem processo",
      responsavel: t.assignee_name,
      motivo: dias === 0 ? "Tarefa para hoje" : `Tarefa atrasada ${dias} dia${dias === 1 ? "" : "s"}`,
      tipo: "tarefa",
      urgente: dias > 0,
      href: t.matter_id ? `/processos/${t.matter_id}?separador=tarefas` : "/tarefas?filtro=abertas",
    });
  }
  // 3. Ações da equipa e lembretes internos (seguimento).
  for (const a of vista.acoes) {
    const partes = a.texto.split(" · ");
    if (a.tipo === "email") {
      prioridades.push({
        chave: a.chave, acao: partes[0], processo: partes.slice(1, 3).join(" · "), responsavel: "Equipa",
        motivo: "Documentos recebidos por associar", tipo: "triagem", urgente: false, href: "/documentos?separador=rececao",
      });
      continue;
    }
    const seguimento = a.verbo === "Fazer seguimento com";
    prioridades.push({
      chave: a.chave,
      acao: partes[0],
      processo: `${partes[1]} · ${partes[2]}`,
      responsavel: partes[3] ?? "",
      motivo: seguimento
        ? a.atrasada ? "Lembrete interno ultrapassado" : "Lembrete interno de hoje"
        : a.atrasada ? "Lembrete interno ultrapassado" : "Ação da equipa pendente",
      tipo: seguimento ? "lembrete" : "acao",
      urgente: a.atrasada,
      href: a.href,
    });
  }

  // Processos parados agrupados por motivo.
  const grupos = new Map<MotivoBloqueio, { id: string; titulo: string; detalhe: string; href: string }[]>();
  for (const l of cartoes.parados.linhas) {
    const g = (l.grupo ?? "outro") as MotivoBloqueio;
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g)!.push({ id: l.id, titulo: l.titulo, detalhe: l.detalhe, href: l.href });
  }
  const parados = (Object.keys(MOTIVOS_BLOQUEIO) as MotivoBloqueio[]).map((m) => ({
    motivo: m,
    rotulo: MOTIVOS_BLOQUEIO[m],
    processos: grupos.get(m) ?? [],
  }));

  return {
    cartoes: Object.fromEntries(Object.entries(cartoes).map(([k, v]) => [k, v.total])) as Record<keyof typeof cartoes, number>,
    prioridades,
    parados,
    prazosPorConfirmar: vista.prazosPorConfirmar,
  };
}

export interface Notificacao {
  id: string;
  texto: string;
  href: string;
  tipo: "tarefa" | "prazo" | "rececao" | "aprovacao";
}

/** Notificações do utilizador, calculadas a partir do estado real (sem lista paralela). */
export async function notificacoes(ctx: Ctx, hoje: string = diaLisboa()): Promise<Notificacao[]> {
  return withTenant(ctx, async (tx) => {
    const out: Notificacao[] = [];
    const tarefas = await tx<{ id: string; title: string; due_on: string | null; matter_id: string | null }[]>`
      select id, title, due_on, matter_id from tasks
      where status = 'aberta' and assignee_id = ${ctx.userId} and (due_on is null or due_on <= ${hoje}::date)
      order by due_on nulls last limit 10`;
    for (const t of tarefas) {
      out.push({
        id: `t:${t.id}`,
        texto: `Tarefa${t.due_on && t.due_on < hoje ? " atrasada" : ""}: ${t.title}`,
        href: t.matter_id ? `/processos/${t.matter_id}?separador=tarefas` : "/tarefas",
        tipo: "tarefa",
      });
    }
    const prazos = await tx<{ id: string; label: string; due_on: string; matter_id: string; reference: string }[]>`
      select d.id, d.label, d.due_on, d.matter_id, m.reference from deadlines d
      join matters m on m.id = d.matter_id
      where d.status = 'confirmado' and d.due_on <= ${hoje}::date and m.state <> 'concluido'
        and m.responsible_id = ${ctx.userId}
      order by d.due_on limit 10`;
    for (const d of prazos) {
      out.push({
        id: `d:${d.id}`,
        texto: `${d.due_on < hoje ? "Prazo vencido" : "Prazo hoje"}: ${d.label} (${d.reference})`,
        href: `/processos/${d.matter_id}?separador=prazos`,
        tipo: "prazo",
      });
    }
    const [{ n }] = await tx<{ n: number }[]>`
      select count(*)::int as n from attachments a join inbox_messages e on e.id = a.inbox_message_id
      where a.matter_id is null and e.archived_at is null`;
    if (n > 0) {
      out.push({ id: "rececao", texto: `${n} anexo(s) recebido(s) por associar`, href: "/documentos?separador=rececao", tipo: "rececao" });
    }
    if (pode(ctx.papel, "aprovar_pedido")) {
      const pedidos = await tx<{ matter_id: string; reference: string }[]>`
        select r.matter_id, m.reference from client_requests r join matters m on m.id = r.matter_id
        where r.status = 'a_aguardar_aprovacao' order by r.submitted_at limit 10`;
      for (const p of pedidos) {
        out.push({ id: `a:${p.matter_id}`, texto: `Pedido ao cliente por aprovar (${p.reference})`, href: `/processos/${p.matter_id}?separador=pedido`, tipo: "aprovacao" });
      }
    }
    return out;
  });
}
