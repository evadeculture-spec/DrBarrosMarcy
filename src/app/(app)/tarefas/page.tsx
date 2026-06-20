"use client";

import { useMemo, useState } from "react";
import { CheckSquare } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Select } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { TaskList } from "@/components/TaskList";
import { EmptyState } from "@/components/EmptyState";
import { TASK_STATUS_OPTIONS } from "@/lib/constants";
import { users } from "@/data/users";
import { useStore } from "@/hooks/useStore";
import { isOverdue, isThisWeek, isToday } from "@/utils/date";
import type { Task } from "@/types";

type TabKey = "hoje" | "semana" | "vencidas" | "sem_prazo" | "concluidas";

export default function TarefasPage() {
  const { tasks } = useStore();
  const [tab, setTab] = useState<TabKey>("hoje");
  const [assignee, setAssignee] = useState("all");
  const [status, setStatus] = useState("all");

  const byFilters = useMemo(
    () =>
      tasks.filter((t) => {
        if (assignee !== "all" && t.assigneeId !== assignee) return false;
        if (status !== "all" && t.status !== status) return false;
        return true;
      }),
    [tasks, assignee, status],
  );

  const buckets = useMemo(() => {
    const open = byFilters.filter((t) => t.status !== "concluida");
    return {
      hoje: open.filter((t) => isToday(t.dueDate)),
      semana: open.filter((t) => isThisWeek(t.dueDate)),
      vencidas: open.filter((t) => isOverdue(t.dueDate)),
      sem_prazo: open.filter((t) => !t.dueDate),
      concluidas: byFilters.filter((t) => t.status === "concluida"),
    } satisfies Record<TabKey, Task[]>;
  }, [byFilters]);

  const tabs = [
    { value: "hoje", label: "Hoje", count: buckets.hoje.length },
    { value: "semana", label: "Esta semana", count: buckets.semana.length },
    { value: "vencidas", label: "Vencidas", count: buckets.vencidas.length },
    { value: "sem_prazo", label: "Sem prazo", count: buckets.sem_prazo.length },
    {
      value: "concluidas",
      label: "Concluídas",
      count: buckets.concluidas.length,
    },
  ];

  const current = buckets[tab];

  return (
    <div>
      <PageHeader
        title="Tarefas"
        subtitle="Todas as tarefas do escritório, organizadas por prazo."
      />

      <div className="mb-4 flex flex-wrap gap-2">
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
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-auto"
        >
          <option value="all">Todos os estados</option>
          {TASK_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      <Tabs
        tabs={tabs}
        active={tab}
        onChange={(v) => setTab(v as TabKey)}
        className="mb-5"
      />

      {current.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Sem tarefas nesta vista"
          description="Não há tarefas para mostrar com os filtros atuais."
        />
      ) : (
        <TaskList tasks={current} />
      )}
    </div>
  );
}
