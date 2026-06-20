/**
 * Tipos de domínio do SolicitaFlow.
 *
 * NOTA DE SEGURANÇA / RGPD:
 * Estes tipos representam dados que, em produção, conterão informação
 * pessoal sensível (NIF, morada, documentos de identificação). Cada
 * entidade inclui `organizationId` para permitir, no futuro, separação de
 * dados por escritório (multi-tenant) e aplicação de Supabase Row Level
 * Security (RLS). Ver `src/lib/security.ts`.
 */

export type ID = string;

// ---------------------------------------------------------------------------
// Utilizadores / Escritório
// ---------------------------------------------------------------------------

export type UserRole = "admin" | "solicitador" | "assistente";

export interface User {
  id: ID;
  organizationId: ID;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
  /** Cor de avatar (token Tailwind opcional) */
  color?: string;
}

export interface Organization {
  id: ID;
  name: string;
  nif: string;
  address: string;
  city: string;
  email: string;
  phone: string;
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export type ClientKind = "particular" | "empresa";

export interface Client {
  id: ID;
  organizationId: ID;
  name: string;
  kind: ClientKind;
  email: string;
  phone: string;
  address: string;
  nif: string;
  country: string;
  notes?: string;
  createdAt: string; // ISO date
}

// ---------------------------------------------------------------------------
// Processos (Matters)
// ---------------------------------------------------------------------------

export type MatterType =
  | "nif"
  | "procuracao"
  | "registo_predial"
  | "heranca"
  | "escritura"
  | "arrendamento"
  | "certidao"
  | "outro";

export type MatterStatus =
  | "novo"
  | "aguarda_documentos"
  | "em_preparacao"
  | "aguarda_assinatura"
  | "submetido"
  | "aguarda_entidade"
  | "concluido"
  | "faturado"
  | "arquivado";

export type Priority = "baixa" | "media" | "alta" | "urgente";

export type PaymentStatus = "pendente" | "parcial" | "pago";

/** Razões pelas quais um processo pode estar parado. */
export type StalledReason =
  | "aguarda_documentos_cliente"
  | "aguarda_entidade_externa"
  | "aguarda_pagamento"
  | "aguarda_revisao_interna"
  | "sem_proxima_acao";

export interface Matter {
  id: ID;
  organizationId: ID;
  /** ID interno legível, ex. "PRC-2026-014" */
  reference: string;
  clientId: ID;
  type: MatterType;
  status: MatterStatus;
  assigneeId: ID;
  priority: Priority;
  nextAction: string | null;
  dueDate: string | null; // ISO date
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  fee: number; // honorários previstos em EUR
  paymentStatus: PaymentStatus;
  quickNotes?: string;
  /** Documentos/itens da checklist deste processo */
  checklist: ChecklistItem[];
  /** Motivo de bloqueio, se o processo estiver parado */
  stalledReason?: StalledReason | null;
}

// ---------------------------------------------------------------------------
// Checklist / Documentos
// ---------------------------------------------------------------------------

export type ChecklistStatus = "pendente" | "recebido" | "validado" | "rejeitado";

export interface ChecklistItem {
  id: ID;
  label: string;
  status: ChecklistStatus;
  /** Marca itens obrigatórios para concluir o processo */
  required: boolean;
}

export type DocumentStatus = "pendente" | "recebido" | "validado" | "rejeitado";

export interface MatterDocument {
  id: ID;
  matterId: ID;
  name: string;
  type: string;
  status: DocumentStatus;
  uploadedAt: string | null; // ISO date
  uploadedBy?: ID;
  /** URL do ficheiro — mock por agora; ligar a Supabase Storage no futuro */
  fileUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Tarefas
// ---------------------------------------------------------------------------

export type TaskStatus =
  | "por_fazer"
  | "em_curso"
  | "aguarda_cliente"
  | "aguarda_entidade"
  | "concluida";

export interface Task {
  id: ID;
  organizationId: ID;
  matterId: ID | null;
  title: string;
  assigneeId: ID;
  dueDate: string | null; // ISO date
  status: TaskStatus;
  priority: Priority;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Timeline / Histórico
// ---------------------------------------------------------------------------

export type TimelineEventType =
  | "nota"
  | "chamada"
  | "email"
  | "documento"
  | "estado"
  | "prazo";

export interface TimelineEvent {
  id: ID;
  matterId: ID;
  type: TimelineEventType;
  authorId: ID;
  message: string;
  createdAt: string; // ISO date-time
}

// ---------------------------------------------------------------------------
// Templates de email
// ---------------------------------------------------------------------------

export type EmailTemplateKey =
  | "pedido_documentos"
  | "confirmacao_rececao"
  | "pedido_assinatura"
  | "pedido_pagamento"
  | "processo_concluido";

export interface EmailTemplate {
  id: ID;
  key: EmailTemplateKey;
  name: string;
  subject: string;
  body: string;
  /** Variáveis suportadas, ex. ["NOME", "RESPONSAVEL"] */
  variables: string[];
}
