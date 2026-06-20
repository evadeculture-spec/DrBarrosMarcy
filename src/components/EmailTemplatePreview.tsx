"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { fillTemplate } from "@/lib/email";
import type { EmailTemplate, Matter } from "@/types";

/**
 * Pré-visualização e edição de um template de email. Pode receber um
 * processo (`matter`) para preencher automaticamente as variáveis.
 */
export function EmailTemplatePreview({
  template,
  matter,
}: {
  template: EmailTemplate;
  matter?: Matter;
}) {
  const filled = fillTemplate(template, matter);
  const [subject, setSubject] = useState(filled.subject);
  const [body, setBody] = useState(filled.body);
  const [copied, setCopied] = useState(false);

  // Recalcula quando muda o template ou o processo associado.
  useEffect(() => {
    const next = fillTemplate(template, matter);
    setSubject(next.subject);
    setBody(next.body);
  }, [template, matter]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Assunto: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard indisponível — ignora no MVP */
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Assunto</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div>
        <Label>Mensagem</Label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-[260px] font-mono text-[13px] leading-relaxed"
        />
      </div>
      {template.variables.length > 0 && (
        <p className="text-xs text-muted">
          Variáveis: {template.variables.map((v) => `[${v}]`).join(", ")}
        </p>
      )}
      <div className="flex justify-end">
        <Button variant="outline" onClick={copy}>
          {copied ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? "Copiado" : "Copiar texto"}
        </Button>
      </div>
    </div>
  );
}
