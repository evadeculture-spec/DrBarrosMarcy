"use client";

import Link from "next/link";
import { useState } from "react";
import { useAcao } from "@/components/useAcao";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { formatarData } from "@/server/domain/datas";
import type { Tarefa } from "@/server/services/tarefas";
import { cn } from "@/lib/utils";
import { atribuirTarefaAcao, concluirTarefaAcao, criarTarefaAcao } from "./acoes";

export function ListaTarefas({
  tarefas,
  utilizadores,
  eu,
  hoje,
  matterId,
  mostrarProcesso = true,
}: {
  tarefas: Tarefa[];
  utilizadores: { id: string; name: string }[];
  eu: string;
  hoje: string;
  matterId?: string;
  mostrarProcesso?: boolean;
}) {
  const { pendente, correr } = useAcao();
  return (
    <div className="space-y-4">
      {tarefas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted">Sem tarefas nesta vista.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card" aria-label="Tarefas">
          {tarefas.map((t) => {
            const atrasada = t.status === "aberta" && t.due_on !== null && t.due_on < hoje;
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3" data-tarefa={t.title}>
                <div className="min-w-0 flex-1 basis-full sm:basis-0">
                  <p className={cn("text-sm font-medium", t.status === "concluida" ? "text-muted line-through" : "text-ink")}>
                    {t.title}
                    {t.kind === "revisao_documentos" && (
                      <span className="ml-2 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-900 no-underline">Revisão de documentos</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {mostrarProcesso && t.matter_id && (
                      <>
                        <Link href={`/processos/${t.matter_id}?separador=tarefas`} className="font-medium text-bordeaux underline-offset-2 hover:underline focus-ring rounded">
                          {t.matter_reference}
                        </Link>{" "}
                        · {t.client_name} ·{" "}
                      </>
                    )}
                    {t.status === "concluida"
                      ? `Concluída${t.completed_by_name ? ` por ${t.completed_by_name}` : ""}${t.completed_at ? ` a ${formatarData(t.completed_at)}` : ""}`
                      : t.due_on ? <span className={cn(atrasada && "font-semibold text-red-800")}>{atrasada ? "Atrasada · " : ""}{formatarData(t.due_on)}</span> : "Sem data"}
                  </p>
                </div>
                {t.status === "aberta" && (
                  <>
                    <label className="sr-only" htmlFor={`resp-${t.id}`}>Responsável por «{t.title}»</label>
                    <Select
                      id={`resp-${t.id}`}
                      className="h-11 w-auto min-w-[10rem]"
                      value={t.assignee_id}
                      disabled={pendente}
                      onChange={(e) => {
                        const anterior = t.assignee_id;
                        correr(() => atribuirTarefaAcao(t.id, e.target.value), {
                          sucesso: "Tarefa atribuída.",
                          anular: () => atribuirTarefaAcao(t.id, anterior),
                        });
                      }}
                    >
                      {utilizadores.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </Select>
                    {t.assignee_id !== eu && (
                      <Button variant="outline" className="h-11" disabled={pendente} onClick={() => correr(() => atribuirTarefaAcao(t.id, eu), { sucesso: "Assumiu a tarefa." })}>
                        Assumir
                      </Button>
                    )}
                  </>
                )}
                <Button
                  variant={t.status === "aberta" ? "primary" : "ghost"}
                  className="h-11"
                  disabled={pendente}
                  onClick={() =>
                    correr(() => concluirTarefaAcao(t.id, t.status === "aberta"), {
                      sucesso: t.status === "aberta" ? "Tarefa concluída." : "Tarefa reaberta.",
                      anular: () => concluirTarefaAcao(t.id, t.status !== "aberta"),
                    })
                  }
                >
                  {t.status === "aberta" ? "Concluir" : "Reabrir"}
                  <span className="sr-only"> «{t.title}»</span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <NovaTarefa utilizadores={utilizadores} eu={eu} matterId={matterId} />
    </div>
  );
}

function NovaTarefa({ utilizadores, eu, matterId }: { utilizadores: { id: string; name: string }[]; eu: string; matterId?: string }) {
  const { pendente, correr } = useAcao();
  const [titulo, setTitulo] = useState("");
  const [resp, setResp] = useState(eu);
  const [data, setData] = useState("");
  return (
    <form
      className="grid gap-2 rounded-2xl border border-dashed border-border p-4 sm:grid-cols-[1fr_12rem_10rem_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        correr(() => criarTarefaAcao({ matterId: matterId ?? null, titulo, responsavelId: resp, data: data || null }), {
          sucesso: "Tarefa criada.",
          depois: () => {
            setTitulo("");
            setData("");
          },
        });
      }}
    >
      <div>
        <Label htmlFor={`nt-t-${matterId ?? "geral"}`}>Nova tarefa</Label>
        <Input id={`nt-t-${matterId ?? "geral"}`} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Telefonar ao cliente" />
      </div>
      <div>
        <Label htmlFor={`nt-r-${matterId ?? "geral"}`}>Responsável</Label>
        <Select id={`nt-r-${matterId ?? "geral"}`} value={resp} onChange={(e) => setResp(e.target.value)}>
          {utilizadores.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`nt-d-${matterId ?? "geral"}`}>Data</Label>
        <Input id={`nt-d-${matterId ?? "geral"}`} type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </div>
      <div className="flex items-end">
        <Button type="submit" variant="outline" className="h-10 w-full" disabled={!titulo.trim() || pendente}>Criar</Button>
      </div>
    </form>
  );
}
