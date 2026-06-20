"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import {
  ArrowLeft,
  FolderOpen,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProcessCard } from "@/components/ProcessCard";
import { EmptyState } from "@/components/EmptyState";
import { CLIENT_KIND } from "@/lib/constants";
import { useStore } from "@/hooks/useStore";
import { isActive } from "@/lib/selectors";

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const { clients, matters, documents, timeline } = useStore();

  const client = clients.find((c) => c.id === params.id);
  if (!client) return notFound();

  const clientMatters = matters.filter((m) => m.clientId === client.id);
  const matterIds = new Set(clientMatters.map((m) => m.id));
  const clientDocs = documents.filter((d) => matterIds.has(d.matterId));
  // Timeline agregada de todos os processos do cliente.
  const clientTimeline = timeline
    .filter((e) => matterIds.has(e.matterId))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const meta = CLIENT_KIND[client.kind];
  const active = clientMatters.filter(isActive).length;

  return (
    <div>
      <Link
        href="/clientes"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-bordeaux"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar aos clientes
      </Link>

      <PageHeader
        title={client.name}
        subtitle={`${meta.label} · ${client.country}`}
        actions={
          <Badge className={meta.badge}>
            {active} processo{active !== 1 ? "s" : ""} ativo
            {active !== 1 ? "s" : ""}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Processos */}
          <Card>
            <CardHeader>
              <CardTitle>Processos associados</CardTitle>
            </CardHeader>
            <CardContent>
              {clientMatters.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title="Sem processos"
                  description="Este cliente ainda não tem processos."
                  className="border-0 bg-transparent py-6"
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {clientMatters.map((m) => (
                    <ProcessCard key={m.id} matter={m} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Histórico de comunicações */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de comunicações</CardTitle>
            </CardHeader>
            <CardContent>
              {clientTimeline.length === 0 ? (
                <p className="py-4 text-sm text-muted">
                  Sem comunicações registadas.
                </p>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-6">
                  {clientTimeline.slice(0, 8).map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[29px] top-1 h-2 w-2 rounded-full bg-bordeaux ring-4 ring-surface" />
                      <p className="text-sm text-ink">{e.message}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Dados + documentos + notas */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dados principais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="flex items-center gap-2 text-ink">
                <Mail className="h-4 w-4 text-muted" />
                {client.email}
              </p>
              <p className="flex items-center gap-2 text-ink">
                <Phone className="h-4 w-4 text-muted" />
                {client.phone}
              </p>
              <p className="flex items-start gap-2 text-ink">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                {client.address || "—"}
              </p>
              <div className="flex justify-between border-t border-border pt-3">
                <span className="text-muted">NIF</span>
                <span className="text-ink">{client.nif}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">País</span>
                <span className="text-ink">{client.country}</span>
              </div>
            </CardContent>
          </Card>

          {client.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notas internas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-ink/80">{client.notes}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Documentos ({clientDocs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {clientDocs.length === 0 ? (
                <p className="text-sm text-muted">Sem documentos.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {clientDocs.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate text-ink/80">{d.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
