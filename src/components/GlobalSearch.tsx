"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  FileText,
  FolderOpen,
  Search,
  Users,
} from "lucide-react";
import { MATTER_TYPES } from "@/lib/constants";
import { useStore } from "@/hooks/useStore";
import { useUI } from "@/hooks/useUI";
import { cn } from "@/lib/utils";

interface Result {
  id: string;
  label: string;
  sub: string;
  href: string;
  group: "Processos" | "Clientes" | "Tarefas" | "Documentos";
  icon: typeof Search;
}

export function GlobalSearch() {
  const router = useRouter();
  const { searchOpen, setSearchOpen } = useUI();
  const { matters, clients, tasks, documents } = useStore();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Atalho ⌘K / Ctrl+K abre a pesquisa.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setSearchOpen]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
    else setQuery("");
  }, [searchOpen]);

  const clientById = (id: string) =>
    clients.find((c) => c.id === id)?.name ?? "";

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Result[] = [];

    for (const m of matters) {
      const name = clientById(m.clientId);
      if (
        name.toLowerCase().includes(q) ||
        m.reference.toLowerCase().includes(q) ||
        MATTER_TYPES[m.type].label.toLowerCase().includes(q)
      ) {
        out.push({
          id: m.id,
          label: `${name} — ${MATTER_TYPES[m.type].label}`,
          sub: m.reference,
          href: `/processos/${m.id}`,
          group: "Processos",
          icon: FolderOpen,
        });
      }
    }
    for (const c of clients) {
      if (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.nif.includes(q)
      ) {
        out.push({
          id: c.id,
          label: c.name,
          sub: c.email,
          href: `/clientes/${c.id}`,
          group: "Clientes",
          icon: Users,
        });
      }
    }
    for (const t of tasks) {
      if (t.title.toLowerCase().includes(q)) {
        out.push({
          id: t.id,
          label: t.title,
          sub: "Tarefa",
          href: "/tarefas",
          group: "Tarefas",
          icon: CheckSquare,
        });
      }
    }
    for (const d of documents) {
      if (d.name.toLowerCase().includes(q)) {
        out.push({
          id: d.id,
          label: d.name,
          sub: d.type,
          href: `/processos/${d.matterId}`,
          group: "Documentos",
          icon: FileText,
        });
      }
    }
    return out.slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, matters, clients, tasks, documents]);

  if (!searchOpen) return null;

  const go = (href: string) => {
    setSearchOpen(false);
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in"
        onClick={() => setSearchOpen(false)}
      />
      <div className="relative z-10 mx-4 w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-xl animate-scale-in">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-5 w-5 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar processos, clientes, tarefas, documentos…"
            className="h-14 w-full bg-transparent text-base text-ink outline-none placeholder:text-muted"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {query && results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted">
              Sem resultados para “{query}”.
            </p>
          )}
          {!query && (
            <p className="px-3 py-6 text-center text-sm text-muted">
              Escreva para pesquisar em todo o escritório.
            </p>
          )}
          {results.map((r) => {
            const Icon = r.icon;
            return (
              <button
                key={`${r.group}-${r.id}`}
                onClick={() => go(r.href)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-bordeaux/[0.06]",
                )}
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background text-bordeaux">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {r.label}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {r.sub}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted">
                  {r.group}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
