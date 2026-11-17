"use client";

import { useState } from "react";
import { PauseCircle } from "lucide-react";
import { useAcao } from "@/components/useAcao";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { formatarData, formatarDataHora } from "@/server/domain/datas";
import type { Ficha } from "@/server/services/processos";
import { bloqueioAcao, proximaAcaoAcao } from "../acoes";

const MOTIVOS: Record<string, string> = {
  aguarda_documentos_cliente: "A aguardar documentos do cliente",
  aguarda_entidade_externa: "A aguardar entidade externa",
  aguarda_pagamento: "A aguardar pagamento",
  aguarda_revisao_interna: "A aguardar revisão interna",
  aguarda_decisao_cliente: "A aguardar decisão do cliente",
  outro: "Outro motivo",
};

/** Primeiro ecrã: próxima ação, quem a executa e quando; última decisão; bloqueio. */
export function PainelProximaAcao({ ficha, hoje }: { ficha: Ficha; hoje: string }) {
  const m = ficha.matter;
  const { pendente, correr } = useAcao();
  const [aEditar, setAEditar] = useState(false);
  const [texto, setTexto] = useState(m.proxima_acao ?? "");
  const [aBloquear, setABloquear] = useState(false);
  const [motivo, setMotivo] = useState("aguarda_entidade_externa");
  const [nota, setNota] = useState("");
  const [revisao, setRevisao] = useState("");

  const proxima = m.proxima_acao || ficha.faixa.proximoPasso;
  const quando = m.state === "concluido" ? null : m.bloqueio_revisao ?? m.follow_up_on;
  const ultima = ficha.ultimaDecisao;
  const bloqueado = Boolean(m.bloqueio_motivo) || ficha.bloqueioDerivado;

  return (
    <section aria-labelledby="t-proxima" className="mt-4 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5" data-testid="proxima-acao">
      <h2 id="t-proxima" className="sr-only">Próxima ação</h2>
      <dl className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Próxima ação</dt>
          <dd className="mt-1 text-base font-semibold text-ink">{proxima}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Quem</dt>
          <dd className="mt-1 text-sm text-ink" data-testid="quem">{m.state === "a_aguardar_cliente" ? `${m.client.name} (cliente) · acompanha ${m.responsible_name}` : m.responsible_name}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Quando</dt>
          <dd className="mt-1 text-sm text-ink">
            {quando ? (
              <span className={quando < hoje ? "font-semibold text-red-800" : undefined}>
                {formatarData(quando)}{quando < hoje ? " (ultrapassado)" : quando === hoje ? " (hoje)" : ""}
              </span>
            ) : (
              "Sem data marcada"
            )}
          </dd>
        </div>
      </dl>

      {ultima && (
        <p className="mt-3 rounded-lg bg-background px-3 py-2 text-sm text-ink" data-testid="ultima-decisao">
          <span className="font-medium">Última decisão:</span> {ultima.summary}{" "}
          <span className="text-muted">— {ultima.actor_name ?? "Sistema"}, {formatarDataHora(ultima.created_at)}</span>
        </p>
      )}

      {bloqueado && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
          <PauseCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Processo parado:</strong>{" "}
            {m.bloqueio_motivo ? MOTIVOS[m.bloqueio_motivo] : MOTIVOS.aguarda_documentos_cliente}
            {m.bloqueio_nota && ` — ${m.bloqueio_nota}`}. Responsável: {m.responsible_name}. Próxima revisão:{" "}
            {m.bloqueio_revisao ?? m.follow_up_on ? formatarData((m.bloqueio_revisao ?? m.follow_up_on)!) : "por marcar"}.
            {ficha.bloqueioDerivado && " (Calculado a partir dos documentos obrigatórios em falta.)"}
          </span>
        </p>
      )}

      {m.state !== "concluido" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" className="h-11" onClick={() => setAEditar((v) => !v)} aria-expanded={aEditar}>
            Mudar próxima ação
          </Button>
          {m.bloqueio_motivo ? (
            <Button variant="ghost" className="h-11" disabled={pendente} onClick={() => correr(() => bloqueioAcao(m.id, null), { sucesso: "Bloqueio levantado." })}>
              Levantar bloqueio
            </Button>
          ) : (
            <Button variant="ghost" className="h-11" onClick={() => setABloquear((v) => !v)} aria-expanded={aBloquear}>
              Marcar como parado
            </Button>
          )}
        </div>
      )}

      {aEditar && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            correr(() => proximaAcaoAcao(m.id, texto || null), { sucesso: "Próxima ação guardada.", depois: () => setAEditar(false) });
          }}
        >
          <div className="min-w-[14rem] flex-1">
            <Label htmlFor="pa-texto">Próxima ação (vazio = a sugerida pelo estado)</Label>
            <Input id="pa-texto" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300} />
          </div>
          <Button type="submit" className="h-10" disabled={pendente}>Guardar</Button>
        </form>
      )}

      {aBloquear && (
        <form
          className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-[1fr_1fr_10rem_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            correr(() => bloqueioAcao(m.id, { motivo, nota, revisao }), { sucesso: "Processo marcado como parado.", depois: () => setABloquear(false) });
          }}
        >
          <div>
            <Label htmlFor="bl-motivo">Motivo</Label>
            <Select id="bl-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {Object.entries(MOTIVOS).filter(([k]) => k !== "aguarda_documentos_cliente").map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="bl-nota">Nota</Label>
            <Input id="bl-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: aguarda certidão da conservatória" />
          </div>
          <div>
            <Label htmlFor="bl-revisao">Próxima revisão</Label>
            <Input id="bl-revisao" type="date" value={revisao} onChange={(e) => setRevisao(e.target.value)} required />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="h-10 w-full" disabled={!revisao || pendente}>Guardar</Button>
          </div>
        </form>
      )}
    </section>
  );
}
