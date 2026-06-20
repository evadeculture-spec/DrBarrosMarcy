import type { TimelineEvent } from "@/types";

export const timelineEvents: TimelineEvent[] = [
  // mat-001 — NIF Karolina
  {
    id: "tl-001",
    matterId: "mat-001",
    type: "estado",
    authorId: "user-marcia",
    message: "Processo criado e definido como prioridade urgente.",
    createdAt: "2026-05-28T09:15:00",
  },
  {
    id: "tl-002",
    matterId: "mat-001",
    type: "documento",
    authorId: "user-carolina",
    message: "Recebido passaporte e comprovativo de morada da cliente.",
    createdAt: "2026-06-02T11:40:00",
  },
  {
    id: "tl-003",
    matterId: "mat-001",
    type: "email",
    authorId: "user-marcia",
    message: "Enviado pedido de procuração assinada por email.",
    createdAt: "2026-06-10T16:05:00",
  },
  {
    id: "tl-004",
    matterId: "mat-001",
    type: "nota",
    authorId: "user-marcia",
    message:
      "Márcia adicionou nota: cliente ficou de enviar procuração digitalizada.",
    createdAt: "2026-06-16T10:20:00",
  },
  // mat-004 — Procuração Thompson
  {
    id: "tl-005",
    matterId: "mat-004",
    type: "estado",
    authorId: "user-joao",
    message: "Processo passou para 'A aguardar assinatura'.",
    createdAt: "2026-06-18T14:30:00",
  },
  {
    id: "tl-006",
    matterId: "mat-004",
    type: "chamada",
    authorId: "user-joao",
    message: "Chamada com o cliente para confirmar poderes da procuração.",
    createdAt: "2026-06-17T09:50:00",
  },
  // mat-003 — Herança Bodin
  {
    id: "tl-007",
    matterId: "mat-003",
    type: "prazo",
    authorId: "user-marcia",
    message: "Adicionado prazo de acompanhamento junto do cartório.",
    createdAt: "2026-06-05T08:45:00",
  },
  {
    id: "tl-008",
    matterId: "mat-003",
    type: "documento",
    authorId: "user-marcia",
    message: "Recebida relação de bens e certidões matriciais.",
    createdAt: "2026-05-20T15:10:00",
  },
  // mat-008 — NIF Novák
  {
    id: "tl-009",
    matterId: "mat-008",
    type: "documento",
    authorId: "user-carolina",
    message: "Comprovativo de morada rejeitado: documento ilegível.",
    createdAt: "2026-06-11T17:25:00",
  },
];

export function timelineForMatter(matterId: string): TimelineEvent[] {
  return timelineEvents
    .filter((e) => e.matterId === matterId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}
