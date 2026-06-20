"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailTemplatePreview } from "@/components/EmailTemplatePreview";
import { emailTemplates } from "@/data/templates";

export default function TemplatesPage() {
  const [selected, setSelected] = useState(emailTemplates[0].key);
  const template = emailTemplates.find((t) => t.key === selected)!;

  return (
    <div>
      <PageHeader
        title="Templates de email"
        subtitle="Mensagens prontas a usar. Edite o texto antes de enviar."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-1">
          {emailTemplates.map((t) => (
            <button
              key={t.key}
              onClick={() => setSelected(t.key)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                selected === t.key
                  ? "border-bordeaux bg-bordeaux/[0.04] ring-1 ring-bordeaux/20"
                  : "border-border bg-surface hover:border-bordeaux/30"
              }`}
            >
              <span
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  selected === t.key
                    ? "bg-bordeaux text-white"
                    : "bg-bordeaux/10 text-bordeaux"
                }`}
              >
                <Mail className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">
                  {t.name}
                </span>
                <span className="block truncate text-xs text-muted">
                  {t.subject}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{template.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <EmailTemplatePreview template={template} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
