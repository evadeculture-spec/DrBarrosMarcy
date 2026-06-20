"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckSquare,
  Euro,
  FileWarning,
  FolderOpen,
  PauseCircle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/EmptyState";
import { PriorityBadge } from "@/components/PriorityBadge";
import { STALLED_REASONS } from "@/lib/constants";
import { clientName } from "@/data/clients";
import {
  computeDashboardStats,
  isActive,
  stalledByReason,
} from "@/lib/selectors";
import { useSession } from "@/hooks/useSession";
import { useStore } from "@/hooks/useStore";
import { useUI } from "@/hooks/useUI";
import { cn } from "@/lib/utils";
import { isOverdue, isToday, relativeDeadline } from "@/utils/date";
import type { StalledReason } from "@/types";

export default function DashboardPage() {
  const { user } = useSession();
  const { matters, tasks } = useStore();
  const { openQuickCreate } = useUI();

  const stats = computeDashboardStats(matters, tasks, user?.id ?? "");
  const stalled = stalledByReason(matters);

  // Prioridades de hoje: tarefas vencidas/para hoje + processos urgentes/com prazo.
  const priorityTasks = tasks
    .filter(
      (t) =>
        t.status !== "concluida" &&
        (isToday(t.dueDate) || isOverdue(t.dueDate) || t.priority === "urgente"),
    )
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 6);

  const firstName = user?.name.split(" ")[0] ?? "";

  return (
    <div>
      <PageHeader
        title={`Bom dia, ${firstName} 👋`}
        subtitle="O que precisa da sua atenção hoje no escritório."
        actions={
          <Button onClick={openQuickCreate}>
            Criar processo rápido
          </Button>
        }
      />

      {/* Estatísticas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Processos ativos"
          value={stats.activeMatters}
          icon={FolderOpen}
          href="/processos"
        />
        <StatCard
          label="Prazos hoje"
          value={stats.dueToday}
          icon={CalendarClock}
          tone={stats.dueToday > 0 ? "warning" : "default"}
          href="/processos"
        />
        <StatCard
          label="Prazos vencidos"
          value={stats.overdue}
          icon={AlertTriangle}
          tone={stats.overdue > 0 ? "danger" : "success"}
          href="/processos"
        />
        <StatCard
          label="Documentos em falta"
          value={stats.missingDocs}
          icon={FileWarning}
          tone={stats.missingDocs > 0 ? "warning" : "default"}
          href="/documentos"
        />
        <StatCard
          label="Processos parados"
          value={stats.stalled}
          icon={PauseCircle}
          tone={stats.stalled > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Pagamentos pendentes"
          value={stats.pendingPayments}
          icon={Euro}
          tone={stats.pendingPayments > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Tarefas atribuídas a mim"
          value={stats.myTasks}
          icon={CheckSquare}
          href="/tarefas"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Prioridades de hoje */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Prioridades de hoje</CardTitle>
              <Link
                href="/tarefas"
                className="text-sm font-medium text-bordeaux hover:underline"
              >
                Ver tarefas
              </Link>
            </CardHeader>
            <CardContent>
              {priorityTasks.length === 0 ? (
                <EmptyState
                  icon={CheckSquare}
                  title="Tudo em dia!"
                  description="Não há ações urgentes para hoje. Bom trabalho."
                  className="border-0 bg-transparent py-8"
                />
              ) : (
                <ul className="space-y-2">
                  {priorityTasks.map((task) => {
                    const matter = matters.find((m) => m.id === task.matterId);
                    const overdue = isOverdue(task.dueDate);
                    return (
                      <li key={task.id}>
                        <Link
                          href={matter ? `/processos/${matter.id}` : "/tarefas"}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:border-bordeaux/30",
                            overdue
                              ? "border-danger/30 bg-red-50/50"
                              : "border-border bg-surface",
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">
                              {task.title}
                            </p>
                            <p
                              className={cn(
                                "mt-0.5 text-xs",
                                overdue
                                  ? "font-medium text-danger"
                                  : "text-muted",
                              )}
                            >
                              {relativeDeadline(task.dueDate)}
                              {matter &&
                                ` · ${clientName(matter.clientId)}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <PriorityBadge priority={task.priority} />
                            <Avatar userId={task.assigneeId} size="sm" />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Processos parados — porquê? */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Processos parados — porquê?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(Object.keys(stalled) as StalledReason[]).map((reason) => {
                const meta = STALLED_REASONS[reason];
                const list = stalled[reason];
                return (
                  <div
                    key={reason}
                    className="rounded-xl border border-border bg-surface p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-medium text-ink">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            meta.dot,
                          )}
                        />
                        {meta.label}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          list.length > 0
                            ? "bg-bordeaux/10 text-bordeaux"
                            : "bg-background text-muted",
                        )}
                      >
                        {list.length}
                      </span>
                    </div>
                    {list.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {list.map((m) => (
                          <li key={m.id}>
                            <Link
                              href={`/processos/${m.id}`}
                              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-sm text-ink/80 hover:bg-bordeaux/[0.05] hover:text-bordeaux"
                            >
                              <span className="truncate">
                                {clientName(m.clientId)}
                              </span>
                              <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
