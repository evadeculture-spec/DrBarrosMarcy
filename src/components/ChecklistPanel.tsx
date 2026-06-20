"use client";

import { Check, Circle, FileCheck2, X } from "lucide-react";
import { Select } from "@/components/ui/input";
import { CHECKLIST_STATUS } from "@/lib/constants";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";
import type { ChecklistItem, ChecklistStatus } from "@/types";

const ICONS: Record<ChecklistStatus, typeof Check> = {
  pendente: Circle,
  recebido: FileCheck2,
  validado: Check,
  rejeitado: X,
};

export function ChecklistPanel({
  matterId,
  items,
}: {
  matterId: string;
  items: ChecklistItem[];
}) {
  const { setChecklistItemStatus } = useStore();

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const meta = CHECKLIST_STATUS[item.status];
        const Icon = ICONS[item.status];
        const done = item.status === "validado";
        return (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  done
                    ? "bg-success text-white"
                    : item.status === "rejeitado"
                      ? "bg-danger text-white"
                      : "bg-background text-muted",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span
                className={cn(
                  "truncate text-sm",
                  done ? "text-muted line-through" : "text-ink",
                )}
              >
                {item.label}
                {item.required && (
                  <span className="ml-1 text-xs text-danger">*</span>
                )}
              </span>
            </div>
            <Select
              value={item.status}
              onChange={(e) =>
                setChecklistItemStatus(
                  matterId,
                  item.id,
                  e.target.value as ChecklistStatus,
                )
              }
              className={cn("h-8 w-40 text-xs", meta.badge)}
            >
              {Object.values(CHECKLIST_STATUS).map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </li>
        );
      })}
    </ul>
  );
}
