import Link from "next/link";
import { FileWarning } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, PaymentBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { MATTER_TYPES } from "@/lib/constants";
import { clientName } from "@/data/clients";
import { countMissingDocs } from "@/lib/selectors";
import { cn, formatCurrency } from "@/lib/utils";
import { isOverdue, relativeDeadline } from "@/utils/date";
import type { Matter } from "@/types";

export function ProcessTable({ matters }: { matters: Matter[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-card">
      <table className="w-full min-w-[920px] text-sm">
        <thead>
          <tr className="border-b border-border bg-background/60 text-left text-xs font-semibold uppercase tracking-wide text-muted">
            <th className="px-4 py-3">Processo</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Prioridade</th>
            <th className="px-4 py-3">Próxima ação</th>
            <th className="px-4 py-3">Prazo</th>
            <th className="px-4 py-3">Honorários</th>
            <th className="px-4 py-3 text-center">Resp.</th>
          </tr>
        </thead>
        <tbody>
          {matters.map((m) => {
            const missing = countMissingDocs(m);
            const overdue = isOverdue(m.dueDate);
            return (
              <tr
                key={m.id}
                className="group border-b border-border last:border-0 transition-colors hover:bg-bordeaux/[0.03]"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/processos/${m.id}`}
                    className="block focus-ring rounded"
                  >
                    <span className="font-medium text-ink group-hover:text-bordeaux">
                      {clientName(m.clientId)}
                    </span>
                    <span className="block text-xs text-muted">
                      {m.reference}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink/80">
                  {MATTER_TYPES[m.type].label}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={m.status} />
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={m.priority} />
                </td>
                <td className="max-w-[220px] px-4 py-3">
                  <span className="line-clamp-1 text-ink/80">
                    {m.nextAction ?? (
                      <span className="italic text-muted">
                        Sem próxima ação definida
                      </span>
                    )}
                  </span>
                  {missing > 0 && (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-warning">
                      <FileWarning className="h-3 w-3" />
                      {missing} doc. em falta
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      overdue ? "font-medium text-danger" : "text-ink/80",
                    )}
                  >
                    {relativeDeadline(m.dueDate)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="tabular-nums text-ink">
                      {formatCurrency(m.fee)}
                    </span>
                    <span className="mt-0.5">
                      <PaymentBadge status={m.paymentStatus} />
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <Avatar userId={m.assigneeId} size="sm" />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
