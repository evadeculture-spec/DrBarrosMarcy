"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Mail, Phone, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { CLIENT_KIND } from "@/lib/constants";
import { isActive } from "@/lib/selectors";
import { useStore } from "@/hooks/useStore";

export default function ClientesPage() {
  const { clients, matters } = useStore();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");

  const activeCount = (clientId: string) =>
    matters.filter((m) => m.clientId === clientId && isActive(m)).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (kind !== "all" && c.kind !== kind) return false;
      if (q) {
        const hay = `${c.name} ${c.email} ${c.nif} ${c.country}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [clients, query, kind]);

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${clients.length} clientes do escritório`}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar por nome, email, NIF…"
            className="pl-9"
          />
        </div>
        <Select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="sm:w-48"
        >
          <option value="all">Todos os tipos</option>
          <option value="particular">Particular</option>
          <option value="empresa">Empresa</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente encontrado"
          description="Ajuste a pesquisa para encontrar clientes."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const meta = CLIENT_KIND[c.kind];
            const active = activeCount(c.id);
            return (
              <Link key={c.id} href={`/clientes/${c.id}`}>
                <Card className="h-full p-4 transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">
                        {c.name}
                      </p>
                      <p className="text-xs text-muted">{c.country}</p>
                    </div>
                    <Badge className={meta.badge}>{meta.label}</Badge>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-muted">
                    <p className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{c.email}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      {c.phone}
                    </p>
                  </div>
                  <div className="mt-3 border-t border-border pt-3 text-xs">
                    {active > 0 ? (
                      <span className="font-medium text-bordeaux">
                        {active} processo{active > 1 ? "s" : ""} ativo
                        {active > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="text-muted">Sem processos ativos</span>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
