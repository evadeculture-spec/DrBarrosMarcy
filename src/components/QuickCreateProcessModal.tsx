"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Plus, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  MATTER_STATUS_OPTIONS,
  MATTER_TYPE_OPTIONS,
} from "@/lib/constants";
import { CHECKLIST_TEMPLATES } from "@/lib/checklists";
import { users } from "@/data/users";
import { useStore, type NewMatterInput } from "@/hooks/useStore";
import { useSession } from "@/hooks/useSession";
import type { MatterStatus, MatterType } from "@/types";

const empty = (assigneeId: string): NewMatterInput => ({
  clientName: "",
  email: "",
  phone: "",
  type: "nif",
  assigneeId,
  status: "novo",
  nextAction: "",
  dueDate: null,
  notes: "",
  fee: 0,
  missingDocs: [],
});

export function QuickCreateProcessModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { user } = useSession();
  const { createMatter } = useStore();
  const [form, setForm] = useState<NewMatterInput>(() =>
    empty(user?.id ?? users[0].id),
  );

  const set = <K extends keyof NewMatterInput>(
    key: K,
    value: NewMatterInput[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  // Pré-visualização da checklist automática para o tipo selecionado.
  const checklistPreview = useMemo(
    () => CHECKLIST_TEMPLATES[form.type].map((i) => i.label),
    [form.type],
  );

  const reset = () => setForm(empty(user?.id ?? users[0].id));

  const submit = () => {
    if (!form.clientName.trim()) return;
    const matter = createMatter(form);
    reset();
    onClose();
    router.push(`/processos/${matter.id}`);
  };

  const toggleMissing = (label: string) => {
    set(
      "missingDocs",
      form.missingDocs?.includes(label)
        ? form.missingDocs.filter((d) => d !== label)
        : [...(form.missingDocs ?? []), label],
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Criar processo rápido"
      description="Insira o essencial — pode completar os detalhes depois."
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!form.clientName.trim()}>
            <Plus className="h-4 w-4" />
            Criar processo
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Nome do cliente *</Label>
          <Input
            value={form.clientName}
            onChange={(e) => set("clientName", e.target.value)}
            placeholder="Ex.: Karolina Jasinska-Sadowska"
            autoFocus
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="cliente@email.com"
          />
        </div>
        <div>
          <Label>Telefone</Label>
          <Input
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+351 …"
          />
        </div>
        <div>
          <Label>Tipo de processo</Label>
          <Select
            value={form.type}
            onChange={(e) => set("type", e.target.value as MatterType)}
          >
            {MATTER_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Responsável</Label>
          <Select
            value={form.assigneeId}
            onChange={(e) => set("assigneeId", e.target.value)}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Estado inicial</Label>
          <Select
            value={form.status}
            onChange={(e) => set("status", e.target.value as MatterStatus)}
          >
            {MATTER_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Prazo</Label>
          <Input
            type="date"
            value={form.dueDate ?? ""}
            onChange={(e) => set("dueDate", e.target.value || null)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Próximo passo</Label>
          <Input
            value={form.nextAction}
            onChange={(e) => set("nextAction", e.target.value)}
            placeholder="Ex.: Pedir documentos em falta ao cliente"
          />
        </div>
        <div>
          <Label>Valor previsto (€)</Label>
          <Input
            type="number"
            min={0}
            value={form.fee || ""}
            onChange={(e) => set("fee", Number(e.target.value))}
            placeholder="0"
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Observações</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Notas rápidas sobre o processo…"
          />
        </div>
      </div>

      {/* Checklist automática gerada pelo tipo de processo */}
      <div className="mt-5 rounded-xl border border-border bg-background/60 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
          <ListChecks className="h-4 w-4 text-bordeaux" />
          Checklist automática
          <span className="font-normal text-muted">
            — gerada para este tipo de processo
          </span>
        </div>
        <p className="mb-3 text-xs text-muted">
          Toque para assinalar quais já estão em falta (serão marcados como
          pendentes no processo).
        </p>
        <div className="flex flex-wrap gap-2">
          {checklistPreview.map((label) => {
            const selected = form.missingDocs?.includes(label);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleMissing(label)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  selected
                    ? "border-warning bg-amber-50 text-warning"
                    : "border-border bg-surface text-ink/80 hover:border-bordeaux/30"
                }`}
              >
                {selected && <X className="h-3 w-3" />}
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
