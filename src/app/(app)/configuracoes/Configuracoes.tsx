"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { useAcao } from "@/components/useAcao";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { PAPEIS, PAPEL_ROTULO, type Papel } from "@/server/domain/papeis";
import type { TipoConfig } from "@/server/services/configuracao";
import { restaurarProcessoAcao } from "../processos/acoes";
import {
  adicionarRequisitoAcao,
  adicionarTipoAcao,
  alterarPapelAcao,
  alternarObrigatorioAcao,
  criarUtilizadorAcao,
  definirAtivoAcao,
  mudarPalavraPasseAcao,
  removerRequisitoAcao,
  reporRequisitoAcao,
  simularFalhasAcao,
} from "./acoes";

interface Utilizador {
  id: string;
  name: string;
  email: string;
  role: Papel;
  active: boolean;
}

function Seccao({ id, titulo, descricao, children }: { id: string; titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <h2 id={id} className="text-base font-semibold text-ink">{titulo}</h2>
      {descricao && <p className="mt-1 text-sm text-muted">{descricao}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Configuracoes({
  admin,
  eu,
  escritorio,
  listas,
  utilizadores,
  envioModo,
}: {
  admin: boolean;
  eu: string;
  escritorio: { name: string; slug: string; falhas: number };
  listas: TipoConfig[];
  utilizadores: Utilizador[];
  envioModo: string;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Configurações</h1>
        <p className="mt-1 text-sm text-muted">{escritorio.name} · endereço «{escritorio.slug}»</p>
      </header>
      <ListasDocumentais listas={listas} admin={admin} />
      {admin && <Utilizadores utilizadores={utilizadores} eu={eu} />}
      {admin && <Envio falhas={escritorio.falhas} modo={envioModo} />}
      {admin && <ExportarRestaurar />}
      <MinhaConta />
    </div>
  );
}

function ListasDocumentais({ listas, admin }: { listas: TipoConfig[]; admin: boolean }) {
  const { pendente, correr } = useAcao();
  const [novoTipo, setNovoTipo] = useState("");
  return (
    <Seccao
      id="t-listas"
      titulo="Listas documentais por tipo de processo"
      descricao="Exemplos configuráveis pelo escritório — não são requisitos legais confirmados. Alterar uma lista só afeta processos novos."
    >
      <div className="space-y-3">
        {listas.map((t) => (
          <details key={t.id} className="rounded-xl border border-border">
            <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-ink focus-ring">
              {t.name} <span className="font-normal text-muted">({t.requisitos.length} documentos)</span>
            </summary>
            <ul className="divide-y divide-border border-t border-border">
              {t.requisitos.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                  <span className="flex-1 text-ink">{r.label}</span>
                  {admin ? (
                    <>
                      <label className="flex items-center gap-1.5 text-xs text-ink">
                        <input
                          type="checkbox"
                          checked={r.required}
                          disabled={pendente}
                          onChange={() => correr(() => alternarObrigatorioAcao(r.id))}
                          className="h-4 w-4 accent-bordeaux"
                        />
                        Obrigatório<span className="sr-only">: {r.label}</span>
                      </label>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pendente}
                        aria-label={`Remover «${r.label}»`}
                        onClick={() =>
                          correr(() => removerRequisitoAcao(r.id), {
                            sucesso: `«${r.label}» removido da lista.`,
                            anular: (dados) => reporRequisitoAcao(dados),
                          })
                        }
                      >
                        <Trash2 aria-hidden className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted">{r.required ? "Obrigatório" : "Opcional"}</span>
                  )}
                </li>
              ))}
              {admin && <NovoRequisito tipoId={t.id} tipo={t.name} />}
            </ul>
          </details>
        ))}
      </div>
      {admin && (
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            correr(() => adicionarTipoAcao(novoTipo), { sucesso: `Tipo «${novoTipo}» criado.`, depois: () => setNovoTipo("") });
          }}
        >
          <div className="min-w-[14rem] flex-1">
            <Label htmlFor="novo-tipo">Novo tipo de processo</Label>
            <Input id="novo-tipo" value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)} />
          </div>
          <Button type="submit" variant="outline" disabled={!novoTipo.trim() || pendente}>Criar tipo</Button>
        </form>
      )}
    </Seccao>
  );
}

function NovoRequisito({ tipoId, tipo }: { tipoId: string; tipo: string }) {
  const { pendente, correr } = useAcao();
  const [nome, setNome] = useState("");
  return (
    <li className="px-4 py-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          correr(() => adicionarRequisitoAcao(tipoId, nome, true), { sucesso: `«${nome}» acrescentado.`, depois: () => setNome("") });
        }}
      >
        <div className="min-w-[12rem] flex-1">
          <Label htmlFor={`nr-${tipoId}`} className="text-xs">Acrescentar documento a «{tipo}»</Label>
          <Input id={`nr-${tipoId}`} value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <Button type="submit" size="sm" variant="outline" className="h-10" disabled={!nome.trim() || pendente}>Acrescentar</Button>
      </form>
    </li>
  );
}

function Utilizadores({ utilizadores, eu }: { utilizadores: Utilizador[]; eu: string }) {
  const { pendente, correr } = useAcao();
  const [novo, setNovo] = useState({ nome: "", email: "", papel: "triagem" });
  const [palavraPasse, setPalavraPasse] = useState<{ email: string; pp: string } | null>(null);
  return (
    <Seccao id="t-util" titulo="Utilizadores" descricao="Triagem carrega e associa documentos; solicitadores também aprovam pedidos, confirmam prazos e concluem processos; administradores gerem o escritório.">
      <ul className="divide-y divide-border rounded-xl border border-border">
        {utilizadores.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink">{u.name}{u.id === eu && " (eu)"}</span>
              <span className="block text-muted">{u.email}{!u.active && " · desativado"}</span>
            </span>
            <label className="sr-only" htmlFor={`papel-${u.id}`}>Papel de {u.name}</label>
            <Select
              id={`papel-${u.id}`}
              className="h-9 w-auto"
              value={u.role}
              disabled={pendente || u.id === eu}
              onChange={(e) => {
                const anterior = u.role;
                const p = e.target.value as Papel;
                correr(() => alterarPapelAcao(u.id, p), { sucesso: `${u.name}: ${PAPEL_ROTULO[p]}.`, anular: () => alterarPapelAcao(u.id, anterior) });
              }}
            >
              {PAPEIS.map((p) => (
                <option key={p} value={p}>{PAPEL_ROTULO[p]}</option>
              ))}
            </Select>
            {u.id !== eu && (
              <Button
                size="sm"
                variant="ghost"
                disabled={pendente}
                onClick={() =>
                  correr(() => definirAtivoAcao(u.id, !u.active), {
                    sucesso: u.active ? `${u.name} desativado.` : `${u.name} reativado.`,
                    anular: () => definirAtivoAcao(u.id, u.active),
                  })
                }
              >
                {u.active ? "Desativar" : "Reativar"}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_10rem_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          const email = novo.email;
          correr(() => criarUtilizadorAcao(novo), {
            sucesso: "Utilizador criado.",
            depois: (d) => {
              setPalavraPasse({ email, pp: d.palavraPasse });
              setNovo({ nome: "", email: "", papel: "triagem" });
            },
          });
        }}
      >
        <div>
          <Label htmlFor="nu-nome">Nome</Label>
          <Input id="nu-nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="nu-email">Email</Label>
          <Input id="nu-email" type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="nu-papel">Papel</Label>
          <Select id="nu-papel" value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value })}>
            {PAPEIS.map((p) => (
              <option key={p} value={p}>{PAPEL_ROTULO[p]}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="outline" disabled={pendente || !novo.nome || !novo.email}>Criar</Button>
        </div>
      </form>
      {palavraPasse && (
        <div role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          Palavra-passe inicial de {palavraPasse.email}: <code className="font-mono font-semibold">{palavraPasse.pp}</code>
          <br />
          Mostrada só agora. Entregue-a por um canal seguro e peça para a mudar no primeiro acesso.
          <button type="button" className="ml-2 underline focus-ring rounded" onClick={() => setPalavraPasse(null)}>Esconder</button>
        </div>
      )}
    </Seccao>
  );
}

function Envio({ falhas, modo }: { falhas: number; modo: string }) {
  const { pendente, correr } = useAcao();
  return (
    <Seccao
      id="t-envio"
      titulo="Envio de pedidos"
      descricao={
        modo === "registo"
          ? "Modo de demonstração: os pedidos ficam registados na aplicação e não saem por email."
          : `Modo de envio: ${modo}.`
      }
    >
      <p className="text-sm text-ink">
        Falhas simuladas pendentes: <strong>{falhas}</strong>. Útil para treinar o reenvio de um pedido.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" disabled={pendente} onClick={() => correr(() => simularFalhasAcao(falhas + 1), { sucesso: "O próximo envio vai falhar." })}>
          Simular falha no próximo envio
        </Button>
        {falhas > 0 && (
          <Button size="sm" variant="ghost" disabled={pendente} onClick={() => correr(() => simularFalhasAcao(0), { sucesso: "Simulação desligada." })}>
            Desligar simulação
          </Button>
        )}
      </div>
    </Seccao>
  );
}

function ExportarRestaurar() {
  const router = useRouter();
  const { pendente, correr } = useAcao();
  const ficheiro = useRef<HTMLInputElement>(null);
  return (
    <Seccao id="t-export" titulo="Exportar e restaurar" descricao="Exportar todos os dados do escritório (inclui anexos, exclui palavras-passe). Para exportar um processo, use o separador Histórico da ficha.">
      <div className="flex flex-wrap items-center gap-2">
        <a href="/api/exportar/escritorio" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-ink hover:bg-background focus-ring">
          <Download aria-hidden className="h-4 w-4" /> Exportar escritório
        </a>
        <input
          ref={ficheiro}
          id="restaurar-ficheiro"
          aria-label="Ficheiro de exportação de processo"
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const fd = new FormData();
            fd.set("ficheiro", f);
            correr(() => restaurarProcessoAcao(fd), {
              sucesso: (d) => `Processo ${d.reference} restaurado com ${d.anexos} anexo(s) verificados.`,
              depois: (d) => router.push(`/processos/${d.id}`),
            });
            e.target.value = "";
          }}
        />
        <Button variant="outline" disabled={pendente} onClick={() => ficheiro.current?.click()}>
          <Upload aria-hidden className="h-4 w-4" /> Restaurar processo de ficheiro
        </Button>
      </div>
    </Seccao>
  );
}

function MinhaConta() {
  const { pendente, correr } = useAcao();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  return (
    <Seccao id="t-conta" titulo="A minha conta">
      <form
        className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          correr(() => mudarPalavraPasseAcao(atual, nova), {
            sucesso: "Palavra-passe alterada.",
            depois: () => {
              setAtual("");
              setNova("");
            },
          });
        }}
      >
        <div>
          <Label htmlFor="pp-atual">Palavra-passe atual</Label>
          <Input id="pp-atual" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="pp-nova">Nova palavra-passe</Label>
          <Input id="pp-nova" type="password" autoComplete="new-password" minLength={10} value={nova} onChange={(e) => setNova(e.target.value)} aria-describedby="pp-ajuda" />
          <p id="pp-ajuda" className="mt-1 text-xs text-muted">Mínimo 10 caracteres.</p>
        </div>
        <div className="flex items-start pt-6">
          <Button type="submit" variant="outline" disabled={pendente || !atual || nova.length < 10}>Alterar</Button>
        </div>
      </form>
    </Seccao>
  );
}
