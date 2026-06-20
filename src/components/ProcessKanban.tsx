"use client";

import { useState } from "react";
import { ProcessCard } from "@/components/ProcessCard";
import { KANBAN_COLUMNS, MATTER_STATUS } from "@/lib/constants";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";
import type { Matter, MatterStatus } from "@/types";

/**
 * Pipeline em colunas por estado. Suporta arrastar um cartão entre colunas
 * para alterar o estado do processo (drag & drop nativo).
 */
export function ProcessKanban({ matters }: { matters: Matter[] }) {
  const { updateMatterStatus } = useStore();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<MatterStatus | null>(null);

  const handleDrop = (status: MatterStatus) => {
    if (dragId) updateMatterStatus(dragId, status);
    setDragId(null);
    setOverCol(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((status) => {
        const items = matters.filter((m) => m.status === status);
        const meta = MATTER_STATUS[status];
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(status);
            }}
            onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
            onDrop={() => handleDrop(status)}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-2xl border bg-background/50 transition-colors",
              overCol === status
                ? "border-bordeaux/40 bg-bordeaux/[0.04]"
                : "border-border",
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                {meta.label}
              </span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">
                {items.length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2.5 p-2.5">
              {items.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted">
                  Sem processos
                </p>
              ) : (
                items.map((m) => (
                  <div
                    key={m.id}
                    className={cn(dragId === m.id && "opacity-50")}
                  >
                    <ProcessCard
                      matter={m}
                      draggable
                      onDragStart={() => setDragId(m.id)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
