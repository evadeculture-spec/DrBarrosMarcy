"use client";

import { useState } from "react";
import { useAcao } from "@/components/useAcao";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatarData, formatarDataHora } from "@/server/domain/datas";
import type { Ficha } from "@/server/services/processos";
import { confirmarPrazoAcao, criarPrazoAcao, removerPrazoAcao } from "../acoes";
import type { Permissoes } from "./Ficha";

export function TabPrazos({ ficha, permissoes }: { ficha: Ficha; permissoes: Permissoes }) {
  const { pendente, correr } = useAcao();
  const [label, setLabel] = useState("");
  const [data, setData] = useState("");
  const m = ficha.matter;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
        <p>
          <strong className="text-ink">Seguimento</strong> é uma data interna, que qualquer pessoa pode mudar (acima, junto ao
          responsável). Quando chega, o processo volta a aparecer em «Hoje».
        </p>
        <p className="mt-2">
          <strong className="text-ink">Prazo</strong> é uma data com consequências. Fica «por confirmar» — sem alertas e fora
          dos contadores — até um solicitador o validar.
        </p>
      </div>

      <section aria-labelledby="t-prazos-lista">
        <h3 id="t-prazos-lista" className="mb-2 text-sm font-semibold text-ink">Prazos</h3>
        {ficha.prazos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted">Sem prazos registados.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {ficha.prazos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-ink">{p.label}</span>
                  <span className="ml-2 text-muted">{formatarData(p.due_on)}</span>
                </span>
                {p.status === "confirmado" ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                    Confirmado por {p.confirmed_by_name} · {p.confirmed_at && formatarDataHora(p.confirmed_at)}
                  </span>
                ) : (
                  <>
                    <span className="rounded-full border border-dashed border-gray-400 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                      Por confirmar
                    </span>
                    {permissoes.confirmarPrazo && (
                      <Button size="sm" disabled={pendente} onClick={() => correr(() => confirmarPrazoAcao(p.id), { sucesso: `Prazo «${p.label}» confirmado.` })}>
                        Confirmar prazo
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pendente}
                      onClick={() =>
                        correr(() => removerPrazoAcao(p.id), {
                          sucesso: `Prazo «${p.label}» removido.`,
                          anular: () => criarPrazoAcao(m.id, p.label, p.due_on),
                        })
                      }
                    >
                      Remover<span className="sr-only"> «{p.label}»</span>
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        className="grid gap-3 rounded-2xl border border-dashed border-border p-4 sm:grid-cols-[1fr_12rem_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          correr(() => criarPrazoAcao(m.id, label, data), {
            sucesso: "Prazo registado como «por confirmar».",
            depois: () => {
              setLabel("");
              setData("");
            },
          });
        }}
      >
        <div>
          <Label htmlFor="pz-label">Novo prazo</Label>
          <Input id="pz-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Entrega na conservatória" />
        </div>
        <div>
          <Label htmlFor="pz-data">Data</Label>
          <Input id="pz-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="outline" disabled={!label.trim() || !data || pendente}>Registar</Button>
        </div>
      </form>
    </div>
  );
}
