/**
 * Rótulos e metadados de apresentação para os enums de domínio.
 * Centralizar aqui evita duplicação de strings e cores pela app.
 */
import type {
  ChecklistStatus,
  ClientKind,
  DocumentStatus,
  MatterStatus,
  MatterType,
  PaymentStatus,
  Priority,
  StalledReason,
  TaskStatus,
  TimelineEventType,
} from "@/types";

export interface OptionMeta {
  value: string;
  label: string;
  /** Classes Tailwind para badge (fundo + texto) */
  badge?: string;
  dot?: string;
}

// --- Tipos de processo --------------------------------------------------

export const MATTER_TYPES: Record<MatterType, OptionMeta> = {
  nif: { value: "nif", label: "Pedido de NIF" },
  procuracao: { value: "procuracao", label: "Procuração" },
  registo_predial: { value: "registo_predial", label: "Registo Predial" },
  heranca: { value: "heranca", label: "Herança" },
  escritura: { value: "escritura", label: "Escritura" },
  arrendamento: { value: "arrendamento", label: "Arrendamento" },
  certidao: { value: "certidao", label: "Certidão" },
  outro: { value: "outro", label: "Outro" },
};

export const MATTER_TYPE_OPTIONS = Object.values(MATTER_TYPES);

// --- Estados de processo ------------------------------------------------

export const MATTER_STATUS: Record<MatterStatus, OptionMeta> = {
  novo: {
    value: "novo",
    label: "Novo pedido",
    badge: "bg-blue-50 text-blue-700 border border-blue-200",
    dot: "bg-blue-500",
  },
  aguarda_documentos: {
    value: "aguarda_documentos",
    label: "A aguardar documentos",
    badge: "bg-amber-50 text-warning border border-amber-200",
    dot: "bg-warning",
  },
  em_preparacao: {
    value: "em_preparacao",
    label: "Em preparação",
    badge: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    dot: "bg-indigo-500",
  },
  aguarda_assinatura: {
    value: "aguarda_assinatura",
    label: "A aguardar assinatura",
    badge: "bg-purple-50 text-purple-700 border border-purple-200",
    dot: "bg-purple-500",
  },
  submetido: {
    value: "submetido",
    label: "Submetido",
    badge: "bg-cyan-50 text-cyan-700 border border-cyan-200",
    dot: "bg-cyan-500",
  },
  aguarda_entidade: {
    value: "aguarda_entidade",
    label: "A aguardar entidade externa",
    badge: "bg-orange-50 text-orange-700 border border-orange-200",
    dot: "bg-orange-500",
  },
  concluido: {
    value: "concluido",
    label: "Concluído",
    badge: "bg-green-50 text-success border border-green-200",
    dot: "bg-success",
  },
  faturado: {
    value: "faturado",
    label: "Faturado",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    dot: "bg-emerald-600",
  },
  arquivado: {
    value: "arquivado",
    label: "Arquivado",
    badge: "bg-gray-100 text-muted border border-border",
    dot: "bg-gray-400",
  },
};

export const MATTER_STATUS_OPTIONS = Object.values(MATTER_STATUS);

/** Ordem das colunas no kanban/pipeline. */
export const KANBAN_COLUMNS: MatterStatus[] = [
  "novo",
  "aguarda_documentos",
  "em_preparacao",
  "aguarda_assinatura",
  "submetido",
  "aguarda_entidade",
  "concluido",
];

// --- Prioridades --------------------------------------------------------

export const PRIORITIES: Record<Priority, OptionMeta> = {
  baixa: {
    value: "baixa",
    label: "Baixa",
    badge: "bg-gray-100 text-muted border border-border",
    dot: "bg-gray-400",
  },
  media: {
    value: "media",
    label: "Média",
    badge: "bg-blue-50 text-blue-700 border border-blue-200",
    dot: "bg-blue-500",
  },
  alta: {
    value: "alta",
    label: "Alta",
    badge: "bg-amber-50 text-warning border border-amber-200",
    dot: "bg-warning",
  },
  urgente: {
    value: "urgente",
    label: "Urgente",
    badge: "bg-red-50 text-danger border border-red-200",
    dot: "bg-danger",
  },
};

export const PRIORITY_OPTIONS = Object.values(PRIORITIES);
export const PRIORITY_ORDER: Priority[] = ["urgente", "alta", "media", "baixa"];

// --- Estado de pagamento ------------------------------------------------

export const PAYMENT_STATUS: Record<PaymentStatus, OptionMeta> = {
  pendente: {
    value: "pendente",
    label: "Pendente",
    badge: "bg-red-50 text-danger border border-red-200",
  },
  parcial: {
    value: "parcial",
    label: "Parcial",
    badge: "bg-amber-50 text-warning border border-amber-200",
  },
  pago: {
    value: "pago",
    label: "Pago",
    badge: "bg-green-50 text-success border border-green-200",
  },
};

// --- Checklist / Documentos ---------------------------------------------

export const CHECKLIST_STATUS: Record<ChecklistStatus, OptionMeta> = {
  pendente: {
    value: "pendente",
    label: "Pendente",
    badge: "bg-gray-100 text-muted border border-border",
    dot: "bg-gray-300",
  },
  recebido: {
    value: "recebido",
    label: "Recebido",
    badge: "bg-blue-50 text-blue-700 border border-blue-200",
    dot: "bg-blue-500",
  },
  validado: {
    value: "validado",
    label: "Validado",
    badge: "bg-green-50 text-success border border-green-200",
    dot: "bg-success",
  },
  rejeitado: {
    value: "rejeitado",
    label: "Rejeitado",
    badge: "bg-red-50 text-danger border border-red-200",
    dot: "bg-danger",
  },
};

export const DOCUMENT_STATUS: Record<DocumentStatus, OptionMeta> =
  CHECKLIST_STATUS;

// --- Tarefas ------------------------------------------------------------

export const TASK_STATUS: Record<TaskStatus, OptionMeta> = {
  por_fazer: {
    value: "por_fazer",
    label: "Por fazer",
    badge: "bg-gray-100 text-muted border border-border",
    dot: "bg-gray-400",
  },
  em_curso: {
    value: "em_curso",
    label: "Em curso",
    badge: "bg-blue-50 text-blue-700 border border-blue-200",
    dot: "bg-blue-500",
  },
  aguarda_cliente: {
    value: "aguarda_cliente",
    label: "A aguardar cliente",
    badge: "bg-amber-50 text-warning border border-amber-200",
    dot: "bg-warning",
  },
  aguarda_entidade: {
    value: "aguarda_entidade",
    label: "A aguardar entidade externa",
    badge: "bg-orange-50 text-orange-700 border border-orange-200",
    dot: "bg-orange-500",
  },
  concluida: {
    value: "concluida",
    label: "Concluída",
    badge: "bg-green-50 text-success border border-green-200",
    dot: "bg-success",
  },
};

export const TASK_STATUS_OPTIONS = Object.values(TASK_STATUS);

// --- Motivos de processo parado -----------------------------------------

export const STALLED_REASONS: Record<
  StalledReason,
  OptionMeta & { description: string }
> = {
  aguarda_documentos_cliente: {
    value: "aguarda_documentos_cliente",
    label: "A aguardar documentos do cliente",
    description: "Falta o cliente enviar documentação.",
    dot: "bg-warning",
  },
  aguarda_entidade_externa: {
    value: "aguarda_entidade_externa",
    label: "A aguardar entidade externa",
    description: "Pendente de resposta de conservatória, AT ou notário.",
    dot: "bg-orange-500",
  },
  aguarda_pagamento: {
    value: "aguarda_pagamento",
    label: "A aguardar pagamento",
    description: "Falta liquidar honorários ou taxas.",
    dot: "bg-danger",
  },
  aguarda_revisao_interna: {
    value: "aguarda_revisao_interna",
    label: "A aguardar revisão interna",
    description: "Precisa de revisão por um colega do escritório.",
    dot: "bg-indigo-500",
  },
  sem_proxima_acao: {
    value: "sem_proxima_acao",
    label: "Sem próxima ação definida",
    description: "Ninguém definiu o próximo passo deste processo.",
    dot: "bg-gray-400",
  },
};

export const STALLED_REASON_OPTIONS = Object.values(STALLED_REASONS);

// --- Timeline -----------------------------------------------------------

export const TIMELINE_EVENT: Record<
  TimelineEventType,
  { label: string; icon: string; color: string }
> = {
  nota: { label: "Nota interna", icon: "MessageSquare", color: "text-bordeaux" },
  chamada: { label: "Chamada", icon: "Phone", color: "text-indigo-600" },
  email: { label: "Email", icon: "Mail", color: "text-cyan-600" },
  documento: { label: "Documento", icon: "FileText", color: "text-blue-600" },
  estado: { label: "Alteração de estado", icon: "ArrowRightLeft", color: "text-purple-600" },
  prazo: { label: "Prazo", icon: "CalendarClock", color: "text-warning" },
};

// --- Clientes -----------------------------------------------------------

export const CLIENT_KIND: Record<ClientKind, OptionMeta> = {
  particular: {
    value: "particular",
    label: "Particular",
    badge: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  empresa: {
    value: "empresa",
    label: "Empresa",
    badge: "bg-purple-50 text-purple-700 border border-purple-200",
  },
};
