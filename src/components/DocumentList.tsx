"use client";

import { Check, Eye, FileText, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocStatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { userName } from "@/data/users";
import { useStore } from "@/hooks/useStore";
import { formatDate } from "@/utils/date";
import type { MatterDocument } from "@/types";

export function DocumentList({ matterId }: { matterId: string }) {
  const { documents, setDocumentStatus } = useStore();
  const docs = documents.filter((d) => d.matterId === matterId);

  if (docs.length === 0) {
    return (
      <EmptyState
        icon={UploadCloud}
        title="Sem documentos carregados"
        description="Os documentos recebidos do cliente aparecerão aqui. No MVP, o upload é simulado."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {docs.map((doc: MatterDocument) => (
        <div
          key={doc.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bordeaux/10 text-bordeaux">
              <FileText className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {doc.name}
              </p>
              <p className="text-xs text-muted">
                {doc.type}
                {doc.uploadedAt
                  ? ` · ${formatDate(doc.uploadedAt)} · ${userName(doc.uploadedBy ?? "")}`
                  : " · por carregar"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DocStatusBadge status={doc.status} />
            {/* SECURITY: em produção abrir via URL assinada do Storage */}
            <Button variant="outline" size="sm" disabled={!doc.uploadedAt}>
              <Eye className="h-4 w-4" />
              Ver
            </Button>
            {doc.status !== "validado" && doc.uploadedAt && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDocumentStatus(doc.id, "validado")}
              >
                <Check className="h-4 w-4" />
                Validar
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
