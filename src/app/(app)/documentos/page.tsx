"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileWarning, Mail, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { DocStatusBadge } from "@/components/StatusBadge";
import { EmailTemplatePreview } from "@/components/EmailTemplatePreview";
import { EmptyState } from "@/components/EmptyState";
import { MATTER_TYPES } from "@/lib/constants";
import { getTemplate } from "@/data/templates";
import { clientName } from "@/data/clients";
import { missingDocsRows } from "@/lib/selectors";
import { useStore } from "@/hooks/useStore";
import { timeAgo } from "@/utils/date";
import type { Matter } from "@/types";

export default function DocumentosEmFaltaPage() {
  const { matters } = useStore();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [emailMatter, setEmailMatter] = useState<Matter | null>(null);

  const rows = useMemo(() => {
    const all = missingDocsRows(matters);
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q) {
        const hay = `${clientName(r.matter.clientId)} ${r.label} ${
          r.matter.reference
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [matters, query, statusFilter]);

  const template = getTemplate("pedido_documentos")!;

  return (
    <div>
      <PageHeader
        title="Documentos em falta"
        subtitle="Saiba exatamente quem contactar e gere o email de pedido num clique."
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar por cliente, documento ou processo…"
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:w-48"
        >
          <option value="all">Todos os estados</option>
          <option value="pendente">Pendente</option>
          <option value="rejeitado">Rejeitado</option>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Sem documentos em falta"
          description="Todos os documentos obrigatórios foram recebidos. Excelente!"
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border bg-background/60 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Processo</th>
                <th className="px-4 py-3">Documento em falta</th>
                <th className="px-4 py-3">Em falta desde</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.matter.id}-${r.itemId}`}
                  className="border-b border-border last:border-0 hover:bg-bordeaux/[0.03]"
                >
                  <td className="px-4 py-3 font-medium text-ink">
                    {clientName(r.matter.clientId)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/processos/${r.matter.id}`}
                      className="text-bordeaux hover:underline"
                    >
                      {r.matter.reference}
                    </Link>
                    <span className="block text-xs text-muted">
                      {MATTER_TYPES[r.matter.type].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/80">
                    <span className="inline-flex items-center gap-1.5">
                      <FileWarning className="h-3.5 w-3.5 text-warning" />
                      {r.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{timeAgo(r.since)}</td>
                  <td className="px-4 py-3">
                    {r.status === "rejeitado" ? (
                      <Badge className="border border-red-200 bg-red-50 text-danger">
                        Rejeitado
                      </Badge>
                    ) : (
                      <DocStatusBadge status="pendente" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEmailMatter(r.matter)}
                    >
                      <Mail className="h-4 w-4" />
                      Gerar email
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(emailMatter)}
        onClose={() => setEmailMatter(null)}
        title="Email de pedido de documentos"
        description={
          emailMatter
            ? `Para ${clientName(emailMatter.clientId)} · ${emailMatter.reference}`
            : undefined
        }
        className="sm:max-w-2xl"
      >
        {emailMatter && (
          <EmailTemplatePreview template={template} matter={emailMatter} />
        )}
      </Modal>
    </div>
  );
}
