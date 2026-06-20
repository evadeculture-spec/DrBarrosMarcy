import type { MatterDocument } from "@/types";

/**
 * Documentos associados a processos. Mock — sem ficheiros reais.
 * SECURITY: em produção, `fileUrl` aponta para Supabase Storage (bucket
 * privado) e é servido através de URL assinada com expiração.
 */
export const documents: MatterDocument[] = [
  {
    id: "doc-001",
    matterId: "mat-001",
    name: "Passaporte_Karolina.pdf",
    type: "Identificação",
    status: "validado",
    uploadedAt: "2026-05-29",
    uploadedBy: "user-carolina",
    fileUrl: null,
  },
  {
    id: "doc-002",
    matterId: "mat-001",
    name: "Comprovativo_morada.pdf",
    type: "Comprovativo de morada",
    status: "recebido",
    uploadedAt: "2026-06-02",
    uploadedBy: "user-carolina",
    fileUrl: null,
  },
  {
    id: "doc-003",
    matterId: "mat-001",
    name: "Procuracao.pdf",
    type: "Procuração",
    status: "pendente",
    uploadedAt: null,
    fileUrl: null,
  },
  {
    id: "doc-004",
    matterId: "mat-002",
    name: "Certidao_permanente.pdf",
    type: "Certidão",
    status: "validado",
    uploadedAt: "2026-05-04",
    uploadedBy: "user-joao",
    fileUrl: null,
  },
  {
    id: "doc-005",
    matterId: "mat-002",
    name: "Caderneta_predial.pdf",
    type: "Caderneta predial",
    status: "recebido",
    uploadedAt: "2026-06-16",
    uploadedBy: "user-joao",
    fileUrl: null,
  },
  {
    id: "doc-006",
    matterId: "mat-003",
    name: "Certidao_obito.pdf",
    type: "Certidão de óbito",
    status: "validado",
    uploadedAt: "2026-04-15",
    uploadedBy: "user-marcia",
    fileUrl: null,
  },
  {
    id: "doc-007",
    matterId: "mat-008",
    name: "Comprovativo_morada_Novak.jpg",
    type: "Comprovativo de morada",
    status: "rejeitado",
    uploadedAt: "2026-06-11",
    uploadedBy: "user-carolina",
    fileUrl: null,
  },
  {
    id: "doc-008",
    matterId: "mat-004",
    name: "Passaporte_Thompson.pdf",
    type: "Identificação",
    status: "validado",
    uploadedAt: "2026-05-16",
    uploadedBy: "user-joao",
    fileUrl: null,
  },
];

export function documentsForMatter(matterId: string): MatterDocument[] {
  return documents.filter((d) => d.matterId === matterId);
}
