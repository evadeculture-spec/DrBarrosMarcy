"use client";

import { useState } from "react";
import { Building2, ListChecks, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MATTER_STATUS_OPTIONS,
  MATTER_TYPE_OPTIONS,
} from "@/lib/constants";
import { CHECKLIST_TEMPLATES } from "@/lib/checklists";
import { organization, users } from "@/data/users";
import type { MatterType } from "@/types";

const TABS = [
  { value: "utilizadores", label: "Utilizadores" },
  { value: "processos", label: "Tipos e estados" },
  { value: "checklists", label: "Checklists" },
  { value: "notificacoes", label: "Notificações" },
  { value: "escritorio", label: "Escritório" },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  solicitador: "Solicitador",
  assistente: "Assistente",
};

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState("utilizadores");

  return (
    <div>
      <PageHeader
        title="Configurações"
        subtitle="Faça a gestão do escritório, equipa e automatismos."
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} className="mb-6" />

      {tab === "utilizadores" && (
        <Card>
          <CardHeader>
            <CardTitle>Utilizadores do escritório</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar userId={u.id} size="lg" />
                  <div>
                    <p className="text-sm font-medium text-ink">{u.name}</p>
                    <p className="text-xs text-muted">{u.email}</p>
                  </div>
                </div>
                <Badge className="border border-bordeaux/20 bg-bordeaux/10 text-bordeaux">
                  {ROLE_LABEL[u.role]}
                </Badge>
              </div>
            ))}
            {/* SECURITY: gestão de utilizadores e papéis exige validação no
                servidor e permissões de administrador (RBAC). */}
            <p className="pt-2 text-xs text-muted">
              As permissões por utilizador (RBAC) serão validadas no servidor
              em produção.
            </p>
          </CardContent>
        </Card>
      )}

      {tab === "processos" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Tipos de processo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {MATTER_TYPE_OPTIONS.map((o) => (
                <Badge
                  key={o.value}
                  className="border border-border bg-background text-ink"
                >
                  {o.label}
                </Badge>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Estados de processo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {MATTER_STATUS_OPTIONS.map((o) => (
                <div key={o.value} className="flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 rounded-full ${o.dot}`} />
                  {o.label}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "checklists" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {MATTER_TYPE_OPTIONS.map((o) => (
            <Card key={o.value}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ListChecks className="h-4 w-4 text-bordeaux" />
                  {o.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-ink/80">
                  {CHECKLIST_TEMPLATES[o.value as MatterType].map((item) => (
                    <li key={item.label} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-bordeaux/40" />
                      {item.label}
                      {!item.required && (
                        <span className="text-xs text-muted">(opcional)</span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "notificacoes" && (
        <Card>
          <CardHeader>
            <CardTitle>Preferências de notificação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <ToggleRow
              label="Alertas de prazos a vencer"
              description="Receber aviso 2 dias antes de cada prazo."
              defaultOn
            />
            <ToggleRow
              label="Resumo diário do escritório"
              description="Email com as prioridades do dia, todas as manhãs."
              defaultOn
            />
            <ToggleRow
              label="Novos documentos recebidos"
              description="Notificar quando um cliente envia documentos."
            />
            <ToggleRow
              label="Pagamentos pendentes"
              description="Lembrete semanal de honorários por liquidar."
            />
          </CardContent>
        </Card>
      )}

      {tab === "escritorio" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-bordeaux" />
                Dados do escritório
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nome" value={organization.name} />
                <Field label="NIF" value={organization.nif} />
                <Field label="Email" value={organization.email} />
                <Field label="Telefone" value={organization.phone} />
                <div className="sm:col-span-2">
                  <Field label="Morada" value={organization.address} />
                </div>
                <Field label="Localidade" value={organization.city} />
              </div>
              <div className="mt-4 flex justify-end">
                <Button>Guardar alterações</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-bordeaux" />
                Segurança e RGPD
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted">
              <p>• Dados separados por escritório (multi-tenant).</p>
              <p>• Permissões por utilizador (RBAC).</p>
              <p>• Logs de atividade por processo.</p>
              <p>• Pronto para Supabase RLS em produção.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input defaultValue={value} />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  defaultOn,
}: {
  label: string;
  description: string;
  defaultOn?: boolean;
}) {
  const [on, setOn] = useState(Boolean(defaultOn));
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <button
        onClick={() => setOn((o) => !o)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          on ? "bg-bordeaux" : "bg-border"
        }`}
        aria-pressed={on}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
