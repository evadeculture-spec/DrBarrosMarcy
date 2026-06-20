"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Euro,
  Plus,
  User as UserIcon,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Tabs } from "@/components/ui/tabs";
import {
  StatusBadge,
  PaymentBadge,
} from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ChecklistPanel } from "@/components/ChecklistPanel";
import { Timeline } from "@/components/Timeline";
import { DocumentList } from "@/components/DocumentList";
import { TaskList } from "@/components/TaskList";
import { EmailTemplatePreview } from "@/components/EmailTemplatePreview";
import { EmptyState } from "@/components/EmptyState";
import {
  MATTER_STATUS_OPTIONS,
  MATTER_TYPES,
  PRIORITY_OPTIONS,
} from "@/lib/constants";
import { emailTemplates } from "@/data/templates";
import { getClient } from "@/data/clients";
import { users, userName } from "@/data/users";
import { missingChecklistItems } from "@/lib/selectors";
import { useStore } from "@/hooks/useStore";
import { useSession } from "@/hooks/useSession";
import { formatCurrency } from "@/lib/utils";
import { formatDate, relativeDeadline } from "@/utils/date";
import { ClipboardList } from "lucide-react";
import type { MatterStatus } from "@/types";

const TABS = [
  { value: "resumo", label: "Resumo" },
  { value: "checklist", label: "Checklist" },
  { value: "tarefas", label: "Tarefas" },
  { value: "documentos", label: "Documentos" },
  { value: "historico", label: "Notas e histórico" },
  { value: "comunicacoes", label: "Comunicações" },
];

export default function MatterDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useSession();
  const {
    matters,
    tasks,
    timeline,
    updateMatterStatus,
    addTask,
  } = useStore();
  const [tab, setTab] = useState("resumo");

  const matter = matters.find((m) => m.id === params.id);
  const matterTasks = tasks.filter((t) => t.matterId === params.id);
  const matterTimeline = useMemo(
    () =>
      timeline
        .filter((e) => e.matterId === params.id)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [timeline, params.id],
  );

  // Estado do formulário de nova tarefa
  const [newTask, setNewTask] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState(
    user?.id ?? users[0].id,
  );

  if (!matter) return notFound();

  const client = getClient(matter.clientId);
  const missing = missingChecklistItems(matter);

  const tabsWithCounts = TABS.map((t) => ({
    ...t,
    count:
      t.value === "checklist"
        ? matter.checklist.length
        : t.value === "tarefas"
          ? matterTasks.length
          : t.value === "documentos"
            ? undefined
            : undefined,
  }));

  const handleAddTask = () => {
    if (!newTask.trim()) return;
    addTask({
      matterId: matter.id,
      title: newTask.trim(),
      assigneeId: newTaskAssignee,
      dueDate: null,
      status: "por_fazer",
      priority: "media",
    });
    setNewTask("");
  };

  return (
    <div>
      <Link
        href="/processos"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-bordeaux"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar aos processos
      </Link>

      <PageHeader
        title={client?.name ?? "Processo"}
        subtitle={`${matter.reference} · ${MATTER_TYPES[matter.type].label}`}
        actions={
          <div className="flex items-center gap-2">
            <Label className="mb-0 hidden text-xs text-muted sm:block">
              Estado
            </Label>
            <Select
              value={matter.status}
              onChange={(e) =>
                updateMatterStatus(matter.id, e.target.value as MatterStatus)
              }
              className="w-56"
            >
              {MATTER_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      <Tabs tabs={tabsWithCounts} active={tab} onChange={setTab} className="mb-6" />

      {/* RESUMO */}
      {tab === "resumo" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* O que falta para concluir */}
            <Card className="border-bordeaux/20 bg-bordeaux/[0.02]">
              <CardHeader>
                <CardTitle className="text-bordeaux">
                  O que falta para concluir este processo?
                </CardTitle>
              </CardHeader>
              <CardContent>
                {missing.length === 0 ? (
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">
                      Pronto a concluir — não há documentos obrigatórios em
                      falta.
                    </span>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {missing.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm text-ink"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                        Falta{" "}
                        {item.status === "rejeitado"
                          ? "corrigir"
                          : "receber"}{" "}
                        — {item.label}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {matter.quickNotes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notas rápidas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-ink/80">{matter.quickNotes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Painel lateral de detalhes */}
          <div className="space-y-3">
            <Card>
              <CardContent className="space-y-3 p-5">
                <DetailRow label="Estado">
                  <StatusBadge status={matter.status} />
                </DetailRow>
                <DetailRow label="Prioridade">
                  <PriorityBadge priority={matter.priority} />
                </DetailRow>
                <DetailRow label="Responsável">
                  <span className="flex items-center gap-2">
                    <Avatar userId={matter.assigneeId} size="sm" />
                    <span className="text-sm text-ink">
                      {userName(matter.assigneeId)}
                    </span>
                  </span>
                </DetailRow>
                <DetailRow label="Tipo">
                  <span className="text-sm text-ink">
                    {MATTER_TYPES[matter.type].label}
                  </span>
                </DetailRow>
                <DetailRow label="Próximo passo">
                  <span className="text-right text-sm text-ink">
                    {matter.nextAction ?? (
                      <span className="italic text-muted">
                        Sem próxima ação definida
                      </span>
                    )}
                  </span>
                </DetailRow>
                <DetailRow label="Prazo">
                  <span className="text-sm text-ink">
                    {formatDate(matter.dueDate)}
                    <span className="ml-1 text-xs text-muted">
                      ({relativeDeadline(matter.dueDate)})
                    </span>
                  </span>
                </DetailRow>
                <DetailRow label="Honorários">
                  <span className="flex items-center gap-1 text-sm font-medium text-ink">
                    <Euro className="h-3.5 w-3.5 text-muted" />
                    {formatCurrency(matter.fee)}
                  </span>
                </DetailRow>
                <DetailRow label="Pagamento">
                  <PaymentBadge status={matter.paymentStatus} />
                </DetailRow>
                <DetailRow label="Última atualização">
                  <span className="text-sm text-ink">
                    {formatDate(matter.updatedAt)}
                  </span>
                </DetailRow>
              </CardContent>
            </Card>

            {client && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <UserIcon className="h-4 w-4 text-bordeaux" />
                    Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <Link
                    href={`/clientes/${client.id}`}
                    className="font-medium text-ink hover:text-bordeaux"
                  >
                    {client.name}
                  </Link>
                  <p className="text-muted">{client.email}</p>
                  <p className="text-muted">{client.phone}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* CHECKLIST */}
      {tab === "checklist" && (
        <Card>
          <CardHeader>
            <CardTitle>Documentos e tarefas do processo</CardTitle>
          </CardHeader>
          <CardContent>
            <ChecklistPanel matterId={matter.id} items={matter.checklist} />
          </CardContent>
        </Card>
      )}

      {/* TAREFAS */}
      {tab === "tarefas" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-2 p-4 sm:flex-row">
              <Input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                placeholder="Nova tarefa para este processo…"
                className="flex-1"
              />
              <Select
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
                className="sm:w-44"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
              <Button onClick={handleAddTask} disabled={!newTask.trim()}>
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </CardContent>
          </Card>
          {matterTasks.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Sem tarefas neste processo"
              description="Crie a primeira tarefa para organizar o trabalho."
            />
          ) : (
            <TaskList tasks={matterTasks} showMatter={false} />
          )}
        </div>
      )}

      {/* DOCUMENTOS */}
      {tab === "documentos" && (
        <Card>
          <CardHeader>
            <CardTitle>Documentos</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentList matterId={matter.id} />
          </CardContent>
        </Card>
      )}

      {/* HISTÓRICO */}
      {tab === "historico" && (
        <Card>
          <CardHeader>
            <CardTitle>Notas e histórico</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline matterId={matter.id} events={matterTimeline} />
          </CardContent>
        </Card>
      )}

      {/* COMUNICAÇÕES */}
      {tab === "comunicacoes" && (
        <Communications matterId={matter.id} />
      )}
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </div>
  );
}

function Communications({ matterId }: { matterId: string }) {
  const { matters } = useStore();
  const matter = matters.find((m) => m.id === matterId);
  const [selected, setSelected] = useState(emailTemplates[0].key);
  const template = emailTemplates.find((t) => t.key === selected)!;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <p className="mb-2 text-sm font-medium text-ink">Escolher template</p>
        <div className="space-y-2">
          {emailTemplates.map((t) => (
            <button
              key={t.key}
              onClick={() => setSelected(t.key)}
              className={`w-full rounded-xl border p-3 text-left text-sm transition-colors ${
                selected === t.key
                  ? "border-bordeaux bg-bordeaux/[0.04] font-medium text-bordeaux"
                  : "border-border bg-surface text-ink hover:border-bordeaux/30"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>{template.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <EmailTemplatePreview template={template} matter={matter} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
