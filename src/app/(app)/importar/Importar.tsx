"use client";

import { useRef, useState, useTransition } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { useAvisos } from "@/components/avisos";
import type { PreVisualizacao } from "@/server/services/clientes";
import { cn } from "@/lib/utils";
import { importarCsvAcao, preVisualizarCsvAcao } from "../clientes/acoes";

const ESTADO = {
  novo: { texto: "Novo", classe: "border-green-200 bg-green-50 text-green-900" },
  duplicado: { texto: "Já existe — ignorado", classe: "border-amber-200 bg-amber-50 text-amber-900" },
  invalido: { texto: "Inválido — ignorado", classe: "border-red-200 bg-red-50 text-red-900" },
} as const;

export function Importar({ exemplo }: { exemplo: string }) {
  const { avisar } = useAvisos();
  const [texto, setTexto] = useState("");
  const [pre, setPre] = useState<PreVisualizacao | null>(null);
  const [pendente, iniciar] = useTransition();
  const ficheiro = useRef<HTMLInputElement>(null);

  const preVisualizar = (t: string) =>
    iniciar(async () => {
      const r = await preVisualizarCsvAcao(t);
      if (!r.ok) avisar({ tipo: "erro", texto: r.erro });
      else setPre(r.dados);
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          ref={ficheiro}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="sr-only"
          tabIndex={-1}
          aria-label="Ficheiro CSV"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const t = await f.text();
            setTexto(t);
            preVisualizar(t);
            e.target.value = "";
          }}
        />
        <Button variant="outline" className="h-11" onClick={() => ficheiro.current?.click()}>
          <Upload aria-hidden className="h-4 w-4" /> Escolher ficheiro CSV
        </Button>
        <Button variant="ghost" className="h-11" onClick={() => { setTexto(exemplo); preVisualizar(exemplo); }}>
          Usar exemplo
        </Button>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(exemplo)}`}
          download="clientes-exemplo.csv"
          className="inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm text-ink hover:bg-background focus-ring"
        >
          <Download aria-hidden className="h-4 w-4" /> Descarregar exemplo
        </a>
      </div>

      <div>
        <Label htmlFor="csv-texto">Ou cole aqui o conteúdo do CSV</Label>
        <Textarea id="csv-texto" rows={6} value={texto} onChange={(e) => { setTexto(e.target.value); setPre(null); }} className="font-mono text-xs" />
        <Button className="mt-2 h-11" variant="outline" disabled={!texto.trim() || pendente} onClick={() => preVisualizar(texto)}>
          Pré-visualizar
        </Button>
      </div>

      {pre && (
        <section aria-labelledby="t-pre" className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
          <h2 id="t-pre" className="text-base font-semibold text-ink">Pré-visualização</h2>
          {pre.erroGeral ? (
            <p role="alert" className="text-sm text-red-900">{pre.erroGeral}</p>
          ) : (
            <>
              <p className="text-sm text-ink" role="status">
                {pre.novos} novo(s) · {pre.duplicados} já existente(s) · {pre.invalidos} inválido(s)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="py-2 pr-3">Linha</th>
                      <th className="py-2 pr-3">Nome</th>
                      <th className="py-2 pr-3">NIF / email</th>
                      <th className="py-2 pr-3">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pre.linhas.map((l) => (
                      <tr key={l.linha}>
                        <td className="py-2 pr-3 text-muted">{l.linha}</td>
                        <td className="py-2 pr-3 text-ink">{l.dados.nome || "—"}</td>
                        <td className="py-2 pr-3 text-muted">{l.dados.nif || l.dados.email || "—"}</td>
                        <td className="py-2 pr-3">
                          <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", ESTADO[l.estado].classe)}>{ESTADO[l.estado].texto}</span>
                          {l.mensagens.length > 0 && <span className="ml-2 text-xs text-muted">{l.mensagens.join(" ")}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                className="h-11"
                disabled={pre.novos === 0 || pendente}
                onClick={() =>
                  iniciar(async () => {
                    const r = await importarCsvAcao(texto);
                    if (!r.ok) {
                      avisar({ tipo: "erro", texto: r.erro });
                      return;
                    }
                    avisar({ tipo: "sucesso", texto: `${r.dados.importados} cliente(s) importado(s); ${r.dados.ignorados} linha(s) ignorada(s).` });
                    preVisualizar(texto);
                  })
                }
              >
                Importar {pre.novos} cliente(s) novo(s)
              </Button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
