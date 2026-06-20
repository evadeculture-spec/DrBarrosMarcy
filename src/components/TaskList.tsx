"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/input";
import { TaskStatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { TASK_STATUS } from "@/lib/constants";
import { clientName } from "@/data/clients";
import { useStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";
import { isOverdue, relativeDeadline } from "@/utils/date";
import type { Task, TaskStatus } from "@/types";

export function TaskList({
  tasks,
  showMatter = true,
}: {
  tasks: Task[];
  showMatter?: boolean;
}) {
  const { updateTaskStatus, matters } = useStore();

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const overdue =
          task.status !== "concluida" && isOverdue(task.dueDate);
        const done = task.status === "concluida";
        const matter = matters.find((m) => m.id === task.matterId);
        return (
          <div
            key={task.id}
            className={cn(
              "flex flex-col gap-2 rounded-xl border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between",
              overdue ? "border-danger/30 bg-red-50/40" : "border-border",
            )}
          >
            <div className="flex min-w-0 items-start gap-3">
              <button
                onClick={() =>
                  updateTaskStatus(
                    task.id,
                    done ? "por_fazer" : "concluida",
                  )
                }
                className="mt-0.5 shrink-0 text-muted transition-colors hover:text-success focus-ring rounded-full"
                aria-label="Concluir tarefa"
              >
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </button>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    done ? "text-muted line-through" : "text-ink",
                  )}
                >
                  {task.title}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                  <span
                    className={cn(overdue && "font-medium text-danger")}
                  >
                    {relativeDeadline(task.dueDate)}
                  </span>
                  {showMatter && matter && (
                    <>
                      <span>·</span>
                      <Link
                        href={`/processos/${matter.id}`}
                        className="hover:text-bordeaux"
                      >
                        {clientName(matter.clientId)} ({matter.reference})
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 pl-8 sm:pl-0">
              <PriorityBadge priority={task.priority} />
              <Select
                value={task.status}
                onChange={(e) =>
                  updateTaskStatus(task.id, e.target.value as TaskStatus)
                }
                className="h-8 w-44 text-xs"
              >
                {Object.values(TASK_STATUS).map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
              <Avatar userId={task.assigneeId} size="sm" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
