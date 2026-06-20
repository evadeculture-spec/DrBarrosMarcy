"use client";

/**
 * Store de dados em memória para o MVP.
 *
 * Mantém matters, clientes, tarefas, documentos e timeline em estado React,
 * a partir dos dados mock iniciais. Expõe ações que dão comportamento real
 * aos botões da app (criar processo, alterar estado, marcar checklist, etc.).
 *
 * Em produção, estas ações passam a chamadas à API/Supabase. A forma das
 * ações foi pensada para mapear diretamente para mutações no servidor.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { clients as seedClients } from "@/data/clients";
import { matters as seedMatters } from "@/data/matters";
import { tasks as seedTasks } from "@/data/tasks";
import { documents as seedDocuments } from "@/data/documents";
import { timelineEvents as seedTimeline } from "@/data/timeline";
import { generateChecklist } from "@/lib/checklists";
import { CURRENT_ORG_ID } from "@/lib/security";
import type {
  ChecklistStatus,
  Client,
  Matter,
  MatterDocument,
  MatterStatus,
  Task,
  TaskStatus,
  TimelineEvent,
} from "@/types";

export interface NewMatterInput {
  clientName: string;
  email: string;
  phone: string;
  type: Matter["type"];
  assigneeId: string;
  status: MatterStatus;
  nextAction: string;
  dueDate: string | null;
  notes: string;
  fee: number;
  /** Documentos em falta indicados manualmente (adicionados à checklist) */
  missingDocs?: string[];
}

interface StoreContextValue {
  clients: Client[];
  matters: Matter[];
  tasks: Task[];
  documents: MatterDocument[];
  timeline: TimelineEvent[];
  createMatter: (input: NewMatterInput) => Matter;
  updateMatterStatus: (matterId: string, status: MatterStatus) => void;
  setChecklistItemStatus: (
    matterId: string,
    itemId: string,
    status: ChecklistStatus,
  ) => void;
  setDocumentStatus: (docId: string, status: MatterDocument["status"]) => void;
  addTask: (task: Omit<Task, "id" | "organizationId" | "createdAt">) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  addNote: (matterId: string, authorId: string, message: string) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

let seq = 100;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${seq++}`;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<Client[]>(seedClients);
  const [matters, setMatters] = useState<Matter[]>(seedMatters);
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [documents, setDocuments] = useState<MatterDocument[]>(seedDocuments);
  const [timeline, setTimeline] = useState<TimelineEvent[]>(seedTimeline);

  const today = () => new Date().toISOString().slice(0, 10);
  const now = () => new Date().toISOString();

  const createMatter = useCallback((input: NewMatterInput): Matter => {
    // Cria (ou reutiliza) o cliente pelo email.
    let clientId = "";
    setClients((prev) => {
      const existing = prev.find(
        (c) => c.email.toLowerCase() === input.email.toLowerCase() && input.email,
      );
      if (existing) {
        clientId = existing.id;
        return prev;
      }
      const newClient: Client = {
        id: nextId("cli"),
        organizationId: CURRENT_ORG_ID,
        name: input.clientName,
        kind: "particular",
        email: input.email,
        phone: input.phone,
        address: "",
        nif: "—",
        country: "Portugal",
        createdAt: today(),
      };
      clientId = newClient.id;
      return [newClient, ...prev];
    });

    const checklist = generateChecklist(input.type);
    // Marca como pendentes os documentos em falta indicados manualmente.
    const extraDocs = (input.missingDocs ?? []).map((label) => ({
      id: nextId("chk"),
      label,
      required: true,
      status: "pendente" as const,
    }));

    const refNumber = String(matters.length + 20).padStart(3, "0");
    const matter: Matter = {
      id: nextId("mat"),
      organizationId: CURRENT_ORG_ID,
      reference: `PRC-2026-${refNumber}`,
      clientId,
      type: input.type,
      status: input.status,
      assigneeId: input.assigneeId,
      priority: "media",
      nextAction: input.nextAction || null,
      dueDate: input.dueDate,
      createdAt: today(),
      updatedAt: today(),
      fee: input.fee,
      paymentStatus: "pendente",
      quickNotes: input.notes,
      stalledReason: input.nextAction ? null : "sem_proxima_acao",
      checklist: [...checklist, ...extraDocs],
    };

    setMatters((prev) => [matter, ...prev]);
    setTimeline((prev) => [
      {
        id: nextId("tl"),
        matterId: matter.id,
        type: "estado",
        authorId: input.assigneeId,
        message: "Processo criado.",
        createdAt: now(),
      },
      ...prev,
    ]);
    return matter;
  }, [matters.length]);

  const updateMatterStatus = useCallback(
    (matterId: string, status: MatterStatus) => {
      setMatters((prev) =>
        prev.map((m) =>
          m.id === matterId ? { ...m, status, updatedAt: today() } : m,
        ),
      );
    },
    [],
  );

  const setChecklistItemStatus = useCallback(
    (matterId: string, itemId: string, status: ChecklistStatus) => {
      setMatters((prev) =>
        prev.map((m) =>
          m.id === matterId
            ? {
                ...m,
                updatedAt: today(),
                checklist: m.checklist.map((item) =>
                  item.id === itemId ? { ...item, status } : item,
                ),
              }
            : m,
        ),
      );
    },
    [],
  );

  const setDocumentStatus = useCallback(
    (docId: string, status: MatterDocument["status"]) => {
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status } : d)),
      );
    },
    [],
  );

  const addTask = useCallback(
    (task: Omit<Task, "id" | "organizationId" | "createdAt">) => {
      setTasks((prev) => [
        {
          ...task,
          id: nextId("tsk"),
          organizationId: CURRENT_ORG_ID,
          createdAt: today(),
        },
        ...prev,
      ]);
    },
    [],
  );

  const updateTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t)),
    );
  }, []);

  const addNote = useCallback(
    (matterId: string, authorId: string, message: string) => {
      setTimeline((prev) => [
        {
          id: nextId("tl"),
          matterId,
          type: "nota",
          authorId,
          message,
          createdAt: now(),
        },
        ...prev,
      ]);
    },
    [],
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      clients,
      matters,
      tasks,
      documents,
      timeline,
      createMatter,
      updateMatterStatus,
      setChecklistItemStatus,
      setDocumentStatus,
      addTask,
      updateTaskStatus,
      addNote,
    }),
    [
      clients,
      matters,
      tasks,
      documents,
      timeline,
      createMatter,
      updateMatterStatus,
      setChecklistItemStatus,
      setDocumentStatus,
      addTask,
      updateTaskStatus,
      addNote,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore deve ser usado dentro de StoreProvider");
  return ctx;
}
