"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  UploadCloud,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const COLUMNS = [
  "cliente",
  "email",
  "telefone",
  "tipo_processo",
  "estado",
  "responsavel",
  "prioridade",
  "prazo",
  "proximo_passo",
  "valor",
  "observacoes",
];

const REQUIRED = ["cliente", "tipo_processo"];

const SAMPLE_CSV = `cliente,email,telefone,tipo_processo,estado,responsavel,prioridade,prazo,proximo_passo,valor,observacoes
Karolina Jasinska,k.jasinska@gmail.com,+351912445781,Pedido de NIF,A aguardar documentos,Márcia Raposo,Urgente,2026-06-25,Confirmar procuração,120,Cliente polaca
António Marques,antonio@sapo.pt,+351966201334,Registo Predial,Em preparação,João Barros,Alta,2026-06-28,Validar caderneta,280,Moradia em Castelo Branco
Hortas do Tejo Lda,geral@hortasdotejo.pt,+351272988540,Certidão,Submetido,Carolina,Baixa,,Aguardar emissão,45,Prédio rústico
,sem-cliente@email.com,+351900000000,Procuração,Novo pedido,João Barros,Média,2026-07-01,,90,Linha sem cliente (inválida)`;

interface ParsedRow {
  data: Record<string, string>;
  valid: boolean;
  errors: string[];
}

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: ParsedRow[] = lines.slice(1).map((line) => {
    const cells = line.split(",");
    const data: Record<string, string> = {};
    headers.forEach((h, i) => (data[h] = (cells[i] ?? "").trim()));
    const errors: string[] = [];
    for (const req of REQUIRED) {
      if (!data[req]) errors.push(`Falta "${req}"`);
    }
    return { data, valid: errors.length === 0, errors };
  });
  return { headers, rows };
}

export default function ImportarPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ReturnType<typeof parseCSV> | null>(
    null,
  );
  const [imported, setImported] = useState(false);

  const handleText = (text: string) => {
    setParsed(parseCSV(text));
    setImported(false);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleText(String(reader.result));
    reader.readAsText(file);
  };

  const validCount = parsed?.rows.filter((r) => r.valid).length ?? 0;
  const invalidCount = (parsed?.rows.length ?? 0) - validCount;

  return (
    <div>
      <PageHeader
        title="Importar processos"
        subtitle="Migre processos ativos a partir de Excel/CSV, sem inserir tudo à mão."
      />

      {/* Aviso explicativo */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          Esta funcionalidade permite migrar os processos ativos do escritório
          de uma só vez. Carregue um ficheiro CSV com as colunas indicadas,
          pré-visualize e confirme.{" "}
          <span className="font-medium">
            No MVP a importação é simulada — os dados não são gravados.
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Modelo de colunas */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Modelo de colunas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {COLUMNS.map((c) => (
                <li key={c} className="flex items-center gap-2">
                  <code className="rounded bg-background px-1.5 py-0.5 text-xs text-ink">
                    {c}
                  </code>
                  {REQUIRED.includes(c) && (
                    <span className="text-xs font-medium text-danger">
                      obrigatório
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full"
              onClick={() => handleText(SAMPLE_CSV)}
            >
              <Download className="h-4 w-4" />
              Carregar CSV de exemplo
            </Button>
          </CardContent>
        </Card>

        {/* Upload */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>1. Carregar ficheiro</CardTitle>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background/60 px-6 py-10 text-center transition-colors hover:border-bordeaux/40"
            >
              <UploadCloud className="h-8 w-8 text-bordeaux" />
              <span className="text-sm font-medium text-ink">
                Clique para escolher um ficheiro CSV
              </span>
              <span className="text-xs text-muted">
                ou use o CSV de exemplo ao lado
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onFile}
            />
          </CardContent>
        </Card>
      </div>

      {/* Pré-visualização */}
      {parsed && parsed.rows.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>2. Pré-visualização</CardTitle>
            <div className="flex items-center gap-2">
              <Badge className="border border-green-200 bg-green-50 text-success">
                {validCount} válidos
              </Badge>
              {invalidCount > 0 && (
                <Badge className="border border-red-200 bg-red-50 text-danger">
                  {invalidCount} com erros
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/60 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    <th className="px-3 py-2">Validação</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Responsável</th>
                    <th className="px-3 py-2">Prazo</th>
                    <th className="px-3 py-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-border last:border-0 ${
                        row.valid ? "" : "bg-red-50/40"
                      }`}
                    >
                      <td className="px-3 py-2">
                        {row.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-danger"
                            title={row.errors.join(", ")}
                          >
                            <AlertTriangle className="h-4 w-4" />
                            {row.errors.join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-ink">
                        {row.data.cliente || (
                          <span className="italic text-muted">(vazio)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-ink/80">
                        {row.data.tipo_processo}
                      </td>
                      <td className="px-3 py-2 text-ink/80">
                        {row.data.estado}
                      </td>
                      <td className="px-3 py-2 text-ink/80">
                        {row.data.responsavel}
                      </td>
                      <td className="px-3 py-2 text-ink/80">
                        {row.data.prazo || "—"}
                      </td>
                      <td className="px-3 py-2 text-ink/80">
                        {row.data.valor ? `${row.data.valor} €` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {validCount} processo(s) prontos a importar.
              </p>
              <Button
                disabled={validCount === 0 || imported}
                onClick={() => setImported(true)}
              >
                <FileSpreadsheet className="h-4 w-4" />
                {imported ? "Importado (simulado)" : "Confirmar importação"}
              </Button>
            </div>

            {imported && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                {validCount} processos importados com sucesso (simulação do
                MVP). Em produção, seriam gravados na base de dados.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
