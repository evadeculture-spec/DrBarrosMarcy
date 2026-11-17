"use client";

import { useState } from "react";
import { useAcao } from "@/components/useAcao";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { Ficha } from "@/server/services/processos";
import { valoresAcao } from "../acoes";

const euros = (v: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v);

export function TabPagamento({ ficha }: { ficha: Ficha }) {
  const m = ficha.matter;
  const { pendente, correr } = useAcao();
  const [previsto, setPrevisto] = useState(m.valor_previsto ?? "");
  const [pago, setPago] = useState(m.valor_pago ?? "0");
  const p = m.valor_previsto === null ? null : Number(m.valor_previsto);
  const pg = Number(m.valor_pago ?? 0);
  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-ink" role="status">
        {p === null
          ? "Sem valor previsto registado: este processo não entra em «Pagamentos pendentes»."
          : pg >= p
            ? `Pago na totalidade (${euros(pg)}).`
            : `Pendente: falta ${euros(p - pg)} de ${euros(p)}.`}
      </p>
      <form
        className="grid gap-3 rounded-2xl border border-dashed border-border p-4 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          const prev = String(previsto).trim() === "" ? null : Number(String(previsto).replace(",", "."));
          correr(() => valoresAcao(m.id, prev, Number(String(pago).replace(",", ".") || 0)), { sucesso: "Valores guardados." });
        }}
      >
        <div>
          <Label htmlFor="pg-previsto">Valor previsto (€)</Label>
          <Input id="pg-previsto" inputMode="decimal" value={previsto} onChange={(e) => setPrevisto(e.target.value)} placeholder="Ex.: 250" />
        </div>
        <div>
          <Label htmlFor="pg-pago">Valor pago (€)</Label>
          <Input id="pg-pago" inputMode="decimal" value={pago} onChange={(e) => setPago(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="h-10 w-full" disabled={pendente}>Guardar</Button>
        </div>
      </form>
      <p className="text-xs text-muted">Registo administrativo simples: não emite faturas nem recibos.</p>
    </div>
  );
}
