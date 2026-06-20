/**
 * Funções puras que derivam métricas e listas a partir dos dados do store.
 * Mantê-las puras facilita testes e a futura migração para o servidor.
 */
import type { Matter, MatterDocument, StalledReason, Task } from "@/types";
import { isOverdue, isToday } from "@/utils/date";

const ACTIVE_STATUSES: Matter["status"][] = [
  "novo",
  "aguarda_documentos",
  "em_preparacao",
  "aguarda_assinatura",
  "submetido",
  "aguarda_entidade",
];

export function isActive(matter: Matter): boolean {
  return ACTIVE_STATUSES.includes(matter.status);
}

/** Itens de checklist em falta (pendente ou rejeitado) e obrigatórios. */
export function missingChecklistItems(matter: Matter) {
  return matter.checklist.filter(
    (item) =>
      item.required &&
      (item.status === "pendente" || item.status === "rejeitado"),
  );
}

export function countMissingDocs(matter: Matter): number {
  return missingChecklistItems(matter).length;
}

export interface DashboardStats {
  activeMatters: number;
  dueToday: number;
  overdue: number;
  missingDocs: number;
  stalled: number;
  pendingPayments: number;
  myTasks: number;
}

export function computeDashboardStats(
  matters: Matter[],
  tasks: Task[],
  currentUserId: string,
): DashboardStats {
  const active = matters.filter(isActive);
  return {
    activeMatters: active.length,
    dueToday: active.filter((m) => isToday(m.dueDate)).length,
    overdue: active.filter((m) => isOverdue(m.dueDate)).length,
    missingDocs: active.reduce((sum, m) => sum + countMissingDocs(m), 0),
    stalled: matters.filter((m) => isActive(m) && Boolean(m.stalledReason))
      .length,
    pendingPayments: matters.filter(
      (m) => m.paymentStatus === "pendente" && m.status !== "arquivado",
    ).length,
    myTasks: tasks.filter(
      (t) => t.assigneeId === currentUserId && t.status !== "concluida",
    ).length,
  };
}

/** Agrupa processos parados por motivo. */
export function stalledByReason(
  matters: Matter[],
): Record<StalledReason, Matter[]> {
  const groups: Record<StalledReason, Matter[]> = {
    aguarda_documentos_cliente: [],
    aguarda_entidade_externa: [],
    aguarda_pagamento: [],
    aguarda_revisao_interna: [],
    sem_proxima_acao: [],
  };
  for (const m of matters) {
    if (isActive(m) && m.stalledReason) {
      groups[m.stalledReason].push(m);
    }
  }
  return groups;
}

export interface MissingDocRow {
  matter: Matter;
  itemId: string;
  label: string;
  status: MatterDocument["status"];
  /** Data desde quando está em falta (criação do processo, como aproximação) */
  since: string | null;
}

/** Lista achatada de documentos em falta para a página dedicada. */
export function missingDocsRows(matters: Matter[]): MissingDocRow[] {
  const rows: MissingDocRow[] = [];
  for (const matter of matters) {
    if (!isActive(matter)) continue;
    for (const item of matter.checklist) {
      if (item.status === "pendente" || item.status === "rejeitado") {
        rows.push({
          matter,
          itemId: item.id,
          label: item.label,
          status: item.status === "rejeitado" ? "rejeitado" : "pendente",
          since: matter.createdAt,
        });
      }
    }
  }
  return rows;
}
