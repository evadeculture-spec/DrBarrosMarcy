"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Mail, Phone } from "lucide-react";
import { EstadoProcesso } from "@/components/EstadoProcesso";
import { useAcao } from "@/components/useAcao";
import { useAvisos } from "@/components/avisos";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { formatarData, formatarDataHora } from "@/server/domain/datas";
import type { Ficha as DadosFicha, UtilizadorResumo } from "@/server/services/processos";
import { cn } from "@/lib/utils";
import {
  apagarProcessoAcao,
  posicaoAcao,
  prepararPedidoAcao,
  responsavelAcao,
  restaurarDadosAcao,
  seguimentoAcao,
  transicionarAcao,
} from "../acoes";
import { TabDocumentos } from "./TabDocumentos";
import { TabPedido } from "./TabPedido";
import { TabPrazos } from "./TabPrazos";

export interface DestinoMover {
  id: string;
  reference: string;
  title: string;
  itens: { id: string; label: string }[];
}

export interface Permissoes {
  aprovar: boolean;
  confirmarPrazo: boolean;
  administrar: boolean;
}

const SEPARADORES = [
  { id: "documentos", rotulo: "Documentos" },
  { id: "pedido", rotulo: "Pedido ao cliente" },
  { id: "prazos", rotulo: "Prazos e seguimento" },
  { id: "historico", rotulo: "Histórico" },
] as const;

export function Ficha({
  ficha,
  utilizadores,
  destinos,
  separadorInicial,
  permissoes,
}: {
  ficha: DadosFicha;
  utilizadores: UtilizadorResumo[];
  destinos: DestinoMover[];
  separadorInicial: string;
  permissoes: Permissoes;
}) {
  const { matter: m, faixa } = ficha;
  const [separador, setSeparador] = useState(separadorInicial);
  const { pendente, correr } = useAcao();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (window.location.hash === "#prazos") setSeparador("prazos");
  }, []);

  function mudarSeparador(id: string, focar = false) {
    setSeparador(id);
    if (focar) refs.current[id]?.focus();
    const url = new URL(window.location.href);
    url.searchParams.set("separador", id);
    url.hash = "";
    window.history.replaceState(null, "", url);
    void posicaoAcao(m.id, id);
  }

  function teclaSeparador(e: React.KeyboardEvent, i: number) {
    const n = SEPARADORES.length;
    const destino =
      e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (destino === null) return;
    e.preventDefault();
    mudarSeparador(SEPARADORES[destino].id, true);
  }

  const pedidoAberto = ficha.pedidos.find((p) => ["rascunho", "a_aguardar_aprovacao", "falhado"].includes(p.status));
  const podePrepararPedido =
    !pedidoAberto && (m.state === "em_conferencia" || m.state === "resposta_por_conferir") && faixa.falta > 0;

  return (
    <div>
      <Link href="/processos" className="mb-3 inline-flex items-center gap-1.5 rounded text-sm text-muted hover:text-bordeaux focus-ring">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Processos
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-bordeaux">{m.reference}</p>
          <h1 className="mt-0.5 text-xl font-semibold text-ink sm:text-2xl">{m.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span>{m.type_name}</span>
            <span aria-hidden>·</span>
            <span className="text-ink">{m.client.name}</span>
            {m.client.email && (
              <a href={`mailto:${m.client.email}`} className="inline-flex items-center gap-1 rounded hover:text-bordeaux focus-ring">
                <Mail aria-hidden className="h-3.5 w-3.5" /> {m.client.email}
              </a>
            )}
            {m.client.phone && (
              <a href={`tel:${m.client.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 rounded hover:text-bordeaux focus-ring">
                <Phone aria-hidden className="h-3.5 w-3.5" /> {m.client.phone}
              </a>
            )}
          </p>
        </div>
        <EstadoProcesso estado={m.state} className="text-sm" />
      </header>

      {/* Faixa: o que falta, quem age, desde quando. Só o texto fica fixo. */}
      <section
        aria-labelledby="faixa-titulo"
        className="sticky top-16 z-10 -mx-4 mt-4 border-y border-border bg-surface/95 px-4 py-3 shadow-card backdrop-blur sm:mx-0 sm:rounded-2xl sm:border"
      >
        <h2 id="faixa-titulo" className="sr-only">Situação do processo</h2>
        <p data-testid="faixa" className="text-sm leading-relaxed text-ink sm:text-base">
          Falta: <strong className={cn(faixa.falta > 0 && "text-red-800")}>{faixa.falta === 0 ? "nada" : faixa.falta === 1 ? "1 documento" : `${faixa.falta} documentos`}</strong>
          {" · "}Aguarda: <strong>{faixa.aguarda}</strong>
          {faixa.aguardaTipo !== "ninguem" && <> desde {faixa.desde}</>}
          {" · "}Responsável: {faixa.responsavel}
        </p>
        <p className="mt-1 text-sm text-muted">
          <span className="font-medium text-ink">Próximo passo:</span> {faixa.proximoPasso}
          {faixa.porConferir > 0 && <> ({faixa.porConferir} recebido(s) por conferir)</>}
        </p>
      </section>
      <div className="mt-3 flex flex-wrap items-center gap-2">
          {podePrepararPedido && (
            <Button
              size="sm"
              disabled={pendente}
              onClick={() =>
                correr(() => prepararPedidoAcao(m.id), {
                  depois: () => mudarSeparador("pedido"),
                })
              }
            >
              Preparar pedido ao cliente
            </Button>
          )}
          {pedidoAberto && separador !== "pedido" && (
            <Button size="sm" variant="secondary" onClick={() => mudarSeparador("pedido")}>
              {pedidoAberto.status === "falhado" ? "Ver pedido e reenviar" : pedidoAberto.status === "rascunho" ? "Continuar pedido" : "Ver pedido"}
            </Button>
          )}
          {ficha.acoes.map((a) => {
            const bloqueado = a.para === "completo" && !ficha.podeCompletar;
            return (
              <Button
                key={a.para}
                size="sm"
                variant={a.para === "completo" || a.para === "concluido" ? "primary" : "outline"}
                disabled={pendente || bloqueado}
                aria-describedby={bloqueado ? "completo-ajuda" : undefined}
                onClick={() => correr(() => transicionarAcao(m.id, a.para), { sucesso: `Feito: ${a.rotulo.toLowerCase()}.` })}
              >
                {a.rotulo}
              </Button>
            );
          })}
          {ficha.acoes.some((a) => a.para === "completo") && !ficha.podeCompletar && (
            <span id="completo-ajuda" className="w-full text-xs text-muted">
              «Marcar como completo» fica disponível quando todos os documentos obrigatórios estiverem conferidos.
            </span>
          )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <CampoResponsavel matterId={m.id} atual={m.responsible_id} utilizadores={utilizadores} />
        <CampoSeguimento matterId={m.id} atual={m.follow_up_on} />
      </div>

      <div role="tablist" aria-label="Secções do processo" className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
        {SEPARADORES.map((t, i) => {
          const ativo = separador === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              role="tab"
              id={`sep-${t.id}`}
              aria-selected={ativo}
              aria-controls={`painel-${t.id}`}
              tabIndex={ativo ? 0 : -1}
              onClick={() => mudarSeparador(t.id)}
              onKeyDown={(e) => teclaSeparador(e, i)}
              className={cn(
                "relative whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors focus-ring rounded-t-lg",
                ativo ? "text-bordeaux" : "text-muted hover:text-ink",
              )}
            >
              {t.rotulo}
              {t.id === "pedido" && pedidoAberto && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-bordeaux" aria-label="(em curso)" />}
              {ativo && <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-bordeaux" />}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`painel-${separador}`} aria-labelledby={`sep-${separador}`} className="pt-5" tabIndex={0}>
        {separador === "documentos" && <TabDocumentos ficha={ficha} destinos={destinos} />}
        {separador === "pedido" && <TabPedido ficha={ficha} permissoes={permissoes} />}
        {separador === "prazos" && <TabPrazos ficha={ficha} permissoes={permissoes} />}
        {separador === "historico" && <TabHistorico ficha={ficha} permissoes={permissoes} />}
      </div>
    </div>
  );
}

function CampoResponsavel({ matterId, atual, utilizadores }: { matterId: string; atual: string; utilizadores: UtilizadorResumo[] }) {
  const { pendente, correr } = useAcao();
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <Label htmlFor="campo-resp">Responsável</Label>
      <Select
        id="campo-resp"
        value={atual}
        disabled={pendente}
        onChange={(e) => {
          const novo = e.target.value;
          correr(() => responsavelAcao(matterId, novo), {
            sucesso: "Responsável alterado.",
            anular: () => responsavelAcao(matterId, atual),
          });
        }}
      >
        {utilizadores.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </Select>
    </div>
  );
}

function CampoSeguimento({ matterId, atual }: { matterId: string; atual: string | null }) {
  const { pendente, correr } = useAcao();
  const [valor, setValor] = useState(atual ?? "");
  useEffect(() => setValor(atual ?? ""), [atual]);
  const guardar = (novo: string | null) =>
    correr(() => seguimentoAcao(matterId, novo), {
      sucesso: novo ? `Seguimento marcado para ${formatarData(novo)}.` : "Seguimento removido.",
      anular: () => seguimentoAcao(matterId, atual),
    });
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <Label htmlFor="campo-seg">Seguimento</Label>
      <div className="flex gap-2">
        <Input
          id="campo-seg"
          type="date"
          value={valor}
          disabled={pendente}
          aria-describedby="campo-seg-ajuda"
          onChange={(e) => setValor(e.target.value)}
          onBlur={() => {
            if ((valor || null) !== atual) guardar(valor || null);
          }}
        />
        {atual && (
          <Button type="button" variant="ghost" size="sm" className="h-10" disabled={pendente} onClick={() => { setValor(""); guardar(null); }}>
            Remover
          </Button>
        )}
      </div>
      <p id="campo-seg-ajuda" className="mt-1 text-xs text-muted">Data interna, editável por todos. Não é um prazo.</p>
    </div>
  );
}

function TabHistorico({ ficha, permissoes }: { ficha: DadosFicha; permissoes: Permissoes }) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const { pendente, correr } = useAcao();
  return (
    <div className="space-y-6">
      <ol className="space-y-0" aria-label="Histórico, do mais recente para o mais antigo">
        {ficha.eventos.map((e) => (
          <li key={e.id} className="relative border-l-2 border-border pb-4 pl-4">
            <span aria-hidden className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-bordeaux/70" />
            <p className="text-sm text-ink">{e.summary}</p>
            <p className="mt-0.5 text-xs text-muted">
              <time dateTime={e.created_at}>{formatarDataHora(e.created_at)}</time> · {e.actor_name ?? "Sistema"}
            </p>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">O histórico não pode ser editado nem apagado.</p>

      {permissoes.administrar && (
        <section aria-labelledby="t-admin" className="rounded-2xl border border-border bg-surface p-4">
          <h3 id="t-admin" className="text-sm font-semibold text-ink">Exportar ou apagar</h3>
          <p className="mt-1 text-sm text-muted">
            A exportação inclui todos os anexos (verificados por SHA-256 ao restaurar).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`/api/exportar/processo/${ficha.matter.id}`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-ink hover:bg-background focus-ring"
            >
              <Download aria-hidden className="h-4 w-4" /> Exportar processo
            </a>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-red-800"
              disabled={pendente}
              onClick={() =>
                correr(() => apagarProcessoAcao(ficha.matter.id), {
                  depois: (exportacao) => {
                    descarregarJson(exportacao, `processo-${ficha.matter.reference.replace("/", "-")}.json`);
                    avisar({
                      tipo: "sucesso",
                      texto: `Processo ${ficha.matter.reference} apagado. A exportação foi descarregada.`,
                      anular: async () => {
                        const r = await restaurarDadosAcao(exportacao);
                        if (r.ok) router.push(`/processos/${ficha.matter.id}`);
                        else avisar({ tipo: "erro", texto: r.erro });
                      },
                    });
                    router.push("/processos");
                  },
                })
              }
            >
              Apagar processo
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function descarregarJson(dados: unknown, nome: string) {
  const blob = new Blob([JSON.stringify(dados)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
