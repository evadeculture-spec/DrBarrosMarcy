import Link from "next/link";
import { CalendarClock, FileWarning } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { MATTER_TYPES } from "@/lib/constants";
import { clientName } from "@/data/clients";
import { countMissingDocs } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { isOverdue, relativeDeadline } from "@/utils/date";
import type { Matter } from "@/types";

export function ProcessCard({
  matter,
  draggable,
  onDragStart,
}: {
  matter: Matter;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const missing = countMissingDocs(matter);
  const overdue = isOverdue(matter.dueDate);

  return (
    <Link
      href={`/processos/${matter.id}`}
      draggable={draggable}
      onDragStart={onDragStart}
      className="block rounded-xl border border-border bg-surface p-3.5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover focus-ring"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">
          {matter.reference}
        </span>
        <PriorityBadge priority={matter.priority} />
      </div>

      <p className="mt-1.5 truncate font-semibold text-ink">
        {clientName(matter.clientId)}
      </p>
      <p className="text-sm text-muted">{MATTER_TYPES[matter.type].label}</p>

      <div className="mt-3 flex items-center gap-2">
        <StatusBadge status={matter.status} />
      </div>

      <p className="mt-3 line-clamp-1 text-sm text-ink/80">
        <span className="text-muted">Próxima ação: </span>
        {matter.nextAction ?? (
          <span className="italic text-muted">Sem próxima ação definida</span>
        )}
      </p>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-3 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-1",
              overdue ? "font-medium text-danger" : "text-muted",
            )}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            {relativeDeadline(matter.dueDate)}
          </span>
          {missing > 0 && (
            <span className="inline-flex items-center gap-1 text-warning">
              <FileWarning className="h-3.5 w-3.5" />
              {missing} em falta
            </span>
          )}
        </div>
        <Avatar userId={matter.assigneeId} size="sm" />
      </div>
    </Link>
  );
}
