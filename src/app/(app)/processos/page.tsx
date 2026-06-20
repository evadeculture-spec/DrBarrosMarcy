"use client";

import { useMemo, useState } from "react";
import { KanbanSquare, Plus, Search, Table2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ProcessTable } from "@/components/ProcessTable";
import { ProcessKanban } from "@/components/ProcessKanban";
import { EmptyState } from "@/components/EmptyState";
import {
  MATTER_STATUS_OPTIONS,
  MATTER_TYPES,
  MATTER_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
} from "@/lib/constants";
import { users } from "@/data/users";
import { useStore } from "@/hooks/useStore";
import { useUI } from "@/hooks/useUI";
import { cn } from "@/lib/utils";
import { FolderOpen } from "lucide-react";

type View = "tabela" | "kanban";

export default function ProcessosPage() {
  const { matters, clients } = useStore();
  const { openQuickCreate } = useUI();

  const [view, setView] = useState<View>("tabela");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [priority, setPriority] = useState("all");

  const clientName = (id: string) =>
    clients.find((c) => c.id === id)?.name ?? "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return matters.filter((m) => {
      if (type !== "all" && m.type !== type) return false;
      if (status !== "all" && m.status !== status) return false;
      if (assignee !== "all" && m.assigneeId !== assignee) return false;
      if (priority !== "all" && m.priority !== priority) return false;
      if (q) {
        const haystack = `${clientName(m.clientId)} ${m.reference} ${
          MATTER_TYPES[m.type].label
        }`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matters, query, type, status, assignee, priority]);

  const resetFilters = () => {
    setType("all");
    setStatus("all");
    setAssignee("all");
    setPriority("all");
    setQuery("");
  };

  const hasFilters =
    type !== "all" ||
    status !== "all" ||
    assignee !== "all" ||
    priority !== "all" ||
    query !== "";

  return (
    <div>
      <PageHeader
        title="Processos"
        subtitle={`${filtered.length} de ${matters.length} processos`}
        actions={
          <Button onClick={openQuickCreate}>
            <Plus className="h-4 w-4" />
            Novo processo
          </Button>
        }
      />

      {/* Barra de filtros */}
      <div className="mb-5 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar por cliente, referência ou tipo…"
              className="pl-9"
            />
          </div>
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
            <button
              onClick={() => setView("tabela")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === "tabela"
                  ? "bg-bordeaux text-white"
                  : "text-muted hover:text-ink",
              )}
            >
              <Table2 className="h-4 w-4" />
              Tabela
            </button>
            <button
              onClick={() => setView("kanban")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === "kanban"
                  ? "bg-bordeaux text-white"
                  : "text-muted hover:text-ink",
              )}
            >
              <KanbanSquare className="h-4 w-4" />
              Kanban
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-auto"
          >
            <option value="all">Todos os tipos</option>
            {MATTER_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-auto"
          >
            <option value="all">Todos os estados</option>
            {MATTER_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="w-auto"
          >
            <option value="all">Todos os responsáveis</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-auto"
          >
            <option value="all">Todas as prioridades</option>
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Nenhum processo encontrado"
          description="Ajuste os filtros ou crie um novo processo para começar."
          action={
            <Button onClick={openQuickCreate}>
              <Plus className="h-4 w-4" />
              Criar processo rápido
            </Button>
          }
        />
      ) : view === "tabela" ? (
        <ProcessTable matters={filtered} />
      ) : (
        <ProcessKanban matters={filtered} />
      )}
    </div>
  );
}
