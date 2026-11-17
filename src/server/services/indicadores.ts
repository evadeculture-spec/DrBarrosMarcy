/**
 * Indicadores do Dashboard. Cada cartão e a lista que o explica são
 * calculados pela MESMA função (mesmo filtro, escritório, utilizador e regra
 * de datas, em Europe/Lisbon): o número do cartão é sempre o comprimento da lista.
 */
import { withTenant, type Tx } from "../db";
import { diaLisboa, diferencaDias, formatarData } from "../domain/datas";
import { ESTADO_ROTULO, type Estado } from "../domain/estados";
import type { Ctx } from "./comum";

export const CHAVES_INDICADORES = [
  "ativos",
  "prazos_hoje",
  "prazos_vencidos",
  "documentos_em_falta",
  "parados",
  "pagamentos",
  "tarefas_minhas",
] as const;
export type ChaveIndicador = (typeof CHAVES_INDICADORES)[number];

export const MOTIVOS_BLOQUEIO = {
  aguarda_documentos_cliente: "A aguardar documentos do cliente",
  aguarda_entidade_externa: "A aguardar entidade externa",
  aguarda_pagamento: "A aguardar pagamento",
  aguarda_revisao_interna: "A aguardar revisão interna",
  aguarda_decisao_cliente: "A aguardar decisão do cliente",
  outro: "Outro motivo",
} as const;
export type MotivoBloqueio = keyof typeof MOTIVOS_BLOQUEIO;
export const MOTIVOS_MANUAIS = Object.keys(MOTIVOS_BLOQUEIO).filter(
  (k) => k !== "aguarda_documentos_cliente",
) as Exclude<MotivoBloqueio, "aguarda_documentos_cliente">[];

export interface DefinicaoIndicador {
  titulo: string;
  definicao: string;
  href: string;
}

export const INDICADORES: Record<ChaveIndicador, DefinicaoIndicador> = {
  ativos: {
    titulo: "Processos ativos",
    definicao: "Processos do escritório que ainda não estão concluídos.",
    href: "/indicadores/ativos",
  },
  prazos_hoje: {
    titulo: "Prazos hoje",
    definicao: "Prazos confirmados por um solicitador que terminam hoje (hora de Lisboa), em processos não concluídos. Prazos por confirmar não contam.",
    href: "/indicadores/prazos_hoje",
  },
  prazos_vencidos: {
    titulo: "Prazos vencidos",
    definicao: "Prazos confirmados com data anterior a hoje (hora de Lisboa), em processos não concluídos. Prazos por confirmar não contam.",
    href: "/indicadores/prazos_vencidos",
  },
  documentos_em_falta: {
    titulo: "Documentos em falta",
    definicao: "Documentos obrigatórios em falta ou rejeitados, em processos não concluídos. Cada documento conta uma vez.",
    href: "/documentos",
  },
  parados: {
    titulo: "Processos parados",
    definicao: "Processos não concluídos com bloqueio explícito (motivo e data de revisão) ou à espera do cliente com documentos obrigatórios em falta.",
    href: "/indicadores/parados",
  },
  pagamentos: {
    titulo: "Pagamentos pendentes",
    definicao: "Processos com valor previsto registado e valor pago inferior ao previsto.",
    href: "/indicadores/pagamentos",
  },
  tarefas_minhas: {
    titulo: "Tarefas atribuídas a mim",
    definicao: "Tarefas abertas atribuídas a si.",
    href: "/tarefas?filtro=minhas",
  },
};

export interface LinhaIndicador {
  id: string;
  href: string;
  titulo: string;
  detalhe: string;
  /** Texto curto de urgência ou valor (sempre acompanhado de texto). */
  etiqueta?: string;
  tom?: "perigo" | "aviso" | "neutro";
  grupo?: string;
}

// ---------------------------------------------------------------------------
// Consultas (uma por indicador)
// ---------------------------------------------------------------------------

const euros = (v: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v);

/** Expressão SQL partilhada: processo bloqueado (explícito ou derivado). */
export const SQL_BLOQUEIO = `
  m.state <> 'concluido' and (
    m.bloqueio_motivo is not null
    or (m.state in ('a_aguardar_cliente', 'envio_falhado', 'a_aguardar_aprovacao')
        and exists (select 1 from matter_items i
                    where i.matter_id = m.id and i.required and i.status in ('em_falta', 'rejeitado'))))`;

async function ativos(tx: Tx): Promise<LinhaIndicador[]> {
  const r = await tx<{ id: string; reference: string; client_name: string; title: string; state: Estado; responsible_name: string }[]>`
    select m.id, m.reference, c.name as client_name, m.title, m.state, u.name as responsible_name
    from matters m join clients c on c.id = m.client_id join users u on u.id = m.responsible_id
    where m.state <> 'concluido'
    order by m.state_since, m.id`;
  return r.map((m) => ({
    id: m.id,
    href: `/processos/${m.id}`,
    titulo: `${m.reference} · ${m.client_name}`,
    detalhe: `${m.title} · ${m.responsible_name}`,
    etiqueta: ESTADO_ROTULO[m.state],
    tom: "neutro" as const,
  }));
}

async function prazos(tx: Tx, hoje: string, tipo: "hoje" | "vencidos"): Promise<LinhaIndicador[]> {
  const r = await tx<{ id: string; matter_id: string; reference: string; client_name: string; label: string; due_on: string; responsible_name: string }[]>`
    select d.id, d.matter_id, m.reference, c.name as client_name, d.label, d.due_on, u.name as responsible_name
    from deadlines d join matters m on m.id = d.matter_id join clients c on c.id = m.client_id
    join users u on u.id = m.responsible_id
    where d.status = 'confirmado' and m.state <> 'concluido'
      and ((${tipo} = 'hoje' and d.due_on = ${hoje}::date) or (${tipo} = 'vencidos' and d.due_on < ${hoje}::date))
    order by d.due_on, d.id`;
  return r.map((d) => {
    const dias = diferencaDias(d.due_on, hoje);
    return {
      id: d.id,
      href: `/processos/${d.matter_id}?separador=prazos`,
      titulo: `${d.label} · ${d.reference}`,
      detalhe: `${d.client_name} · ${d.responsible_name} · ${formatarData(d.due_on)}`,
      etiqueta: dias === 0 ? "Termina hoje" : `Vencido há ${dias} dia${dias === 1 ? "" : "s"}`,
      tom: "perigo" as const,
    };
  });
}

export async function documentosEmFaltaTx(tx: Tx): Promise<LinhaIndicador[]> {
  const r = await tx<{ id: string; matter_id: string; reference: string; client_name: string; label: string; status: string; responsible_name: string; state: Estado }[]>`
    select i.id, i.matter_id, m.reference, c.name as client_name, i.label, i.status,
           u.name as responsible_name, m.state
    from matter_items i join matters m on m.id = i.matter_id join clients c on c.id = m.client_id
    join users u on u.id = m.responsible_id
    where i.required and i.status in ('em_falta', 'rejeitado') and m.state <> 'concluido'
    order by m.year desc, m.number desc, i.position, i.id`;
  return r.map((i) => ({
    id: i.id,
    href: `/processos/${i.matter_id}`,
    titulo: i.label,
    detalhe: `${i.reference} · ${i.client_name} · ${i.responsible_name}`,
    etiqueta: i.status === "rejeitado" ? "Rejeitado" : "Em falta",
    tom: i.status === "rejeitado" ? ("perigo" as const) : ("aviso" as const),
    grupo: i.matter_id,
  }));
}

async function parados(tx: Tx, hoje: string): Promise<LinhaIndicador[]> {
  const r = await tx<{ id: string; reference: string; client_name: string; responsible_name: string; motivo: MotivoBloqueio; revisao: string | null; nota: string | null }[]>`
    select m.id, m.reference, c.name as client_name, u.name as responsible_name,
           coalesce(m.bloqueio_motivo, 'aguarda_documentos_cliente') as motivo,
           coalesce(m.bloqueio_revisao, m.follow_up_on) as revisao, m.bloqueio_nota as nota
    from matters m join clients c on c.id = m.client_id join users u on u.id = m.responsible_id
    where ${tx.unsafe(SQL_BLOQUEIO)}
    order by coalesce(m.bloqueio_revisao, m.follow_up_on) nulls first, m.id`;
  return r.map((m) => ({
    id: m.id,
    href: `/processos/${m.id}`,
    titulo: `${m.reference} · ${m.client_name}`,
    detalhe: `${MOTIVOS_BLOQUEIO[m.motivo]}${m.nota ? ` — ${m.nota}` : ""} · ${m.responsible_name} · revisão ${m.revisao ? formatarData(m.revisao) : "por marcar"}`,
    etiqueta: !m.revisao ? "Sem data de revisão" : m.revisao <= hoje ? "Rever hoje" : `Rever a ${formatarData(m.revisao).slice(0, 5)}`,
    tom: !m.revisao || m.revisao <= hoje ? ("aviso" as const) : ("neutro" as const),
    grupo: m.motivo,
  }));
}

async function pagamentos(tx: Tx): Promise<LinhaIndicador[]> {
  const r = await tx<{ id: string; reference: string; client_name: string; valor_previsto: string; valor_pago: string; state: Estado }[]>`
    select m.id, m.reference, c.name as client_name, m.valor_previsto, m.valor_pago, m.state
    from matters m join clients c on c.id = m.client_id
    where m.valor_previsto is not null and m.valor_pago < m.valor_previsto
    order by (m.valor_previsto - m.valor_pago) desc, m.id`;
  return r.map((m) => {
    const emFalta = Number(m.valor_previsto) - Number(m.valor_pago);
    return {
      id: m.id,
      href: `/processos/${m.id}?separador=pagamento`,
      titulo: `${m.reference} · ${m.client_name}`,
      detalhe: `Previsto ${euros(Number(m.valor_previsto))} · pago ${euros(Number(m.valor_pago))} · ${ESTADO_ROTULO[m.state]}`,
      etiqueta: `Falta ${euros(emFalta)}`,
      tom: "aviso" as const,
    };
  });
}

async function tarefasMinhas(tx: Tx, ctx: Ctx, hoje: string): Promise<LinhaIndicador[]> {
  const r = await tx<{ id: string; title: string; due_on: string | null; matter_id: string | null; reference: string | null; client_name: string | null }[]>`
    select t.id, t.title, t.due_on, t.matter_id, m.reference, c.name as client_name
    from tasks t left join matters m on m.id = t.matter_id left join clients c on c.id = m.client_id
    where t.status = 'aberta' and t.assignee_id = ${ctx.userId}
    order by t.status, t.due_on nulls last, t.created_at, t.id`;
  return r.map((t) => ({
    id: t.id,
    href: t.matter_id ? `/processos/${t.matter_id}?separador=tarefas` : "/tarefas",
    titulo: t.title,
    detalhe: t.reference ? `${t.reference} · ${t.client_name}` : "Sem processo",
    etiqueta: !t.due_on ? "Sem data" : t.due_on < hoje ? "Atrasada" : t.due_on === hoje ? "Para hoje" : formatarData(t.due_on).slice(0, 5),
    tom: t.due_on && t.due_on <= hoje ? ("perigo" as const) : ("neutro" as const),
  }));
}

async function calcular(tx: Tx, ctx: Ctx, chave: ChaveIndicador, hoje: string): Promise<LinhaIndicador[]> {
  switch (chave) {
    case "ativos":
      return ativos(tx);
    case "prazos_hoje":
      return prazos(tx, hoje, "hoje");
    case "prazos_vencidos":
      return prazos(tx, hoje, "vencidos");
    case "documentos_em_falta":
      return documentosEmFaltaTx(tx);
    case "parados":
      return parados(tx, hoje);
    case "pagamentos":
      return pagamentos(tx);
    case "tarefas_minhas":
      return tarefasMinhas(tx, ctx, hoje);
  }
}

export function eChaveIndicador(v: string): v is ChaveIndicador {
  return (CHAVES_INDICADORES as readonly string[]).includes(v);
}

export async function indicador(
  ctx: Ctx,
  chave: ChaveIndicador,
  hoje: string = diaLisboa(),
): Promise<DefinicaoIndicador & { chave: ChaveIndicador; total: number; linhas: LinhaIndicador[] }> {
  const linhas = await withTenant(ctx, (tx) => calcular(tx, ctx, chave, hoje));
  return { chave, ...INDICADORES[chave], total: linhas.length, linhas };
}

/** Os sete cartões: total = comprimento da lista do mesmo indicador. */
export async function resumoIndicadores(ctx: Ctx, hoje: string = diaLisboa()) {
  return withTenant(ctx, async (tx) => {
    const out = {} as Record<ChaveIndicador, { total: number; linhas: LinhaIndicador[] }>;
    for (const k of CHAVES_INDICADORES) {
      const linhas = await calcular(tx, ctx, k, hoje);
      out[k] = { total: linhas.length, linhas };
    }
    return out;
  });
}
