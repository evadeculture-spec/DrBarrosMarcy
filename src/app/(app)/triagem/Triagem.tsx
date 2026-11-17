"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Archive, CheckCircle2, FileText, Inbox, Plus } from "lucide-react";
import { useAcao } from "@/components/useAcao";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useRascunhoLocal } from "@/lib/rascunho";
import { formatarDataHora } from "@/server/domain/datas";
import type { TipoResumo, UtilizadorResumo } from "@/server/services/processos";
import type { AnexoCaixa, EmailCaixa } from "@/server/services/triagem";
import { cn } from "@/lib/utils";
import { tamanho } from "../processos/[id]/TabDocumentos";
import {
  anularTriagemAcao,
  arquivarAcao,
  associarAcao,
  carregarEmailAcao,
  processoDeEmailAcao,
} from "./acoes";

const ORIGEM: Record<string, string> = { email: "Email", entregue_em_mao: "Entregue em mão", correio: "Correio", outro: "Outro" };

export interface ProcessoAlvo {
  id: string;
  reference: string;
  title: string;
  itens: { id: string; label: string; status: string }[];
}

export function Triagem({
  emails,
  processos,
  tipos,
  utilizadores,
  utilizadorAtual,
  arquivados,
}: {
  emails: EmailCaixa[];
  processos: ProcessoAlvo[];
  tipos: TipoResumo[];
  utilizadores: UtilizadorResumo[];
  utilizadorAtual: string;
  arquivados: boolean;
}) {
  const [formAberto, setFormAberto] = useState(false);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Receção de documentos</h2>
          <p className="mt-1 text-sm text-muted">
            Registe o que chegou (email, entregue em mão, correio) e confirme, anexo a anexo, o processo e o documento certos.
          </p>
        </div>
        {!arquivados && (
          <Button onClick={() => setFormAberto((v) => !v)} aria-expanded={formAberto} variant={formAberto ? "outline" : "primary"}>
            <Plus aria-hidden className="h-4 w-4" /> Carregar email
          </Button>
        )}
      </header>

      {formAberto && !arquivados && <FormEmail utilizadorAtual={utilizadorAtual} fechar={() => setFormAberto(false)} />}

      <nav aria-label="Caixas" className="flex gap-1 text-sm">
        <Link href="/documentos?separador=rececao" aria-current={!arquivados ? "page" : undefined} className={cn("rounded-lg px-3 py-1.5 focus-ring", !arquivados ? "bg-bordeaux text-white" : "text-ink hover:bg-surface")}>
          Por triar
        </Link>
        <Link href="/documentos?separador=rececao&arquivados=1" aria-current={arquivados ? "page" : undefined} className={cn("rounded-lg px-3 py-1.5 focus-ring", arquivados ? "bg-bordeaux text-white" : "text-ink hover:bg-surface")}>
          Arquivados
        </Link>
      </nav>

      {emails.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center">
          <Inbox aria-hidden className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-2 text-sm text-ink">{arquivados ? "Não há emails arquivados." : "Caixa vazia: está tudo triado."}</p>
          {!arquivados && <p className="mt-1 text-sm text-muted">Quando chegar documentação, use «Carregar email».</p>}
        </div>
      ) : (
        <ul className="space-y-4">
          {emails.map((e) => (
            <CartaoEmail key={e.id} email={e} processos={processos} tipos={tipos} utilizadores={utilizadores} utilizadorAtual={utilizadorAtual} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FormEmail({ utilizadorAtual, fechar }: { utilizadorAtual: string; fechar: () => void }) {
  const { pendente, correr } = useAcao();
  const ficheiros = useRef<HTMLInputElement>(null);
  const { valor, setValor, limpar, recuperado } = useRascunhoLocal(`sf:triagem-email:${utilizadorAtual}`, {
    remetenteNome: "",
    remetenteEmail: "",
    assunto: "",
    corpo: "",
    recebidoEm: "",
    origem: "email",
  });
  const set = (k: keyof typeof valor) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValor({ ...valor, [k]: e.target.value });

  return (
    <form
      className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        Object.entries(valor).forEach(([k, v]) => fd.set(k, v));
        for (const f of Array.from(ficheiros.current?.files ?? [])) fd.append("ficheiros", f);
        correr(() => carregarEmailAcao(fd), {
          sucesso: (d) => `Email carregado com ${d.anexos.length} anexo(s).`,
          depois: () => {
            limpar();
            if (ficheiros.current) ficheiros.current.value = "";
            fechar();
          },
        });
      }}
    >
      <h2 className="text-base font-semibold text-ink">Carregar email recebido</h2>
      {recuperado && <p className="text-sm text-muted">Recuperámos o rascunho anterior.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="em-nome">Remetente (nome)</Label>
          <Input id="em-nome" value={valor.remetenteNome} onChange={set("remetenteNome")} />
        </div>
        <div>
          <Label htmlFor="em-email">Remetente (email)</Label>
          <Input id="em-email" type="email" value={valor.remetenteEmail} onChange={set("remetenteEmail")} />
        </div>
        <div>
          <Label htmlFor="em-assunto">Assunto</Label>
          <Input id="em-assunto" value={valor.assunto} onChange={set("assunto")} />
        </div>
        <div>
          <Label htmlFor="em-origem">Origem</Label>
          <select
            id="em-origem"
            value={valor.origem}
            onChange={(e) => setValor({ ...valor, origem: e.target.value })}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus-ring"
          >
            <option value="email">Email</option>
            <option value="entregue_em_mao">Entregue em mão</option>
            <option value="correio">Correio</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div>
          <Label htmlFor="em-data">Recebido em (opcional)</Label>
          <Input id="em-data" type="datetime-local" value={valor.recebidoEm} onChange={set("recebidoEm")} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="em-corpo">Texto do email</Label>
          <Textarea id="em-corpo" rows={4} value={valor.corpo} onChange={set("corpo")} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="em-ficheiros">Anexos</Label>
          <input
            id="em-ficheiros"
            ref={ficheiros}
            type="file"
            multiple
            aria-describedby="em-ficheiros-ajuda"
            className="block w-full rounded-lg border border-border bg-surface p-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-bordeaux/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-bordeaux focus-ring"
          />
          <p id="em-ficheiros-ajuda" className="mt-1 text-xs text-muted">PDF, imagens, Word/Excel/OpenDocument ou texto. Até 15 MB cada, 25 MB no total.</p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={fechar}>Fechar</Button>
        <Button type="submit" disabled={pendente}>{pendente ? "A carregar…" : "Carregar"}</Button>
      </div>
    </form>
  );
}

function CartaoEmail({
  email,
  processos,
  tipos,
  utilizadores,
  utilizadorAtual,
}: {
  email: EmailCaixa;
  processos: ProcessoAlvo[];
  tipos: TipoResumo[];
  utilizadores: UtilizadorResumo[];
  utilizadorAtual: string;
}) {
  const { pendente, correr } = useAcao();
  const [criar, setCriar] = useState(false);
  const porTriar = email.anexos.filter((a) => !a.matter_id);
  const remetente = email.from_name ?? email.from_email ?? "Remetente desconhecido";
  return (
    <li id={`email-${email.id}`} className="scroll-mt-24 rounded-2xl border border-border bg-surface shadow-card">
      <div className="border-b border-border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">
            {remetente}
            {email.from_name && email.from_email && <span className="ml-1 font-normal text-muted">&lt;{email.from_email}&gt;</span>}
          </h2>
          <p className="text-xs text-muted">{ORIGEM[email.origem] ?? "Email"} · {formatarDataHora(email.received_at)}</p>
        </div>
        <p className="mt-1 text-sm text-ink">{email.subject || "(sem assunto)"}</p>
        {email.body && (
          <details className="mt-2">
            <summary className="cursor-pointer rounded text-sm text-muted hover:text-ink focus-ring">Ver texto do email</summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink">{email.body}</pre>
          </details>
        )}
        {email.sugestoes.length > 0 && porTriar.length > 0 && (
          <p className="mt-2 text-sm text-muted">
            Sugestão (mesmo email de cliente):{" "}
            {email.sugestoes.map((s, i) => (
              <span key={s.id}>
                {i > 0 && ", "}
                <span className="font-medium text-ink">{s.reference}</span> {s.title}
              </span>
            ))}
            . Confirme antes de associar.
          </p>
        )}
      </div>

      <ul className="divide-y divide-border" aria-label={`Anexos de ${remetente}`}>
        {email.anexos.map((a) => (
          <LinhaAnexoTriagem key={a.id} anexo={a} processos={processos} sugestoes={email.sugestoes.map((s) => s.id)} />
        ))}
        {email.anexos.length === 0 && <li className="px-4 py-3 text-sm text-muted">Sem anexos.</li>}
      </ul>

      <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
        {porTriar.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setCriar((v) => !v)} aria-expanded={criar}>
            Criar processo com {porTriar.length === 1 ? "este anexo" : `estes ${porTriar.length} anexos`}
          </Button>
        )}
        {email.archived_at ? (
          <Button size="sm" variant="ghost" disabled={pendente} onClick={() => correr(() => arquivarAcao(email.id, false), { sucesso: "Email reposto na triagem." })}>
            Repor na triagem
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={pendente || porTriar.length > 0}
            aria-describedby={porTriar.length > 0 ? `arq-${email.id}` : undefined}
            onClick={() =>
              correr(() => arquivarAcao(email.id, true), {
                sucesso: "Email arquivado.",
                anular: () => arquivarAcao(email.id, false),
              })
            }
          >
            <Archive aria-hidden className="h-4 w-4" /> Arquivar
          </Button>
        )}
        {porTriar.length > 0 && !email.archived_at && (
          <span id={`arq-${email.id}`} className="text-xs text-muted">Associe todos os anexos antes de arquivar.</span>
        )}
      </div>
      {criar && (
        <FormProcessoDeEmail email={email} tipos={tipos} utilizadores={utilizadores} utilizadorAtual={utilizadorAtual} fechar={() => setCriar(false)} />
      )}
    </li>
  );
}

function LinhaAnexoTriagem({ anexo, processos, sugestoes }: { anexo: AnexoCaixa; processos: ProcessoAlvo[]; sugestoes: string[] }) {
  const { pendente, correr } = useAcao();
  const sug = anexo.sugestao;
  const [processo, setProcesso] = useState(sug?.matterId ?? "");
  const [item, setItem] = useState(sug?.itemId ?? "");
  if (sug && !sugestoes.includes(sug.matterId)) sugestoes = [sug.matterId, ...sugestoes];
  const segueSugestao = sug && processo === sug.matterId;
  const p = processos.find((x) => x.id === processo);
  const ordenados = [...processos].sort((a, b) => Number(sugestoes.includes(b.id)) - Number(sugestoes.includes(a.id)));

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <FileText aria-hidden className="h-4 w-4 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate text-ink">{anexo.filename}</span>
        <span className="text-xs text-muted">{tamanho(anexo.size_bytes)}</span>
        <a href={`/api/anexos/${anexo.id}?ver=1`} target="_blank" rel="noopener" className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-medium text-bordeaux hover:underline focus-ring">
          Pré-visualizar<span className="sr-only"> {anexo.filename}</span>
        </a>
      </div>
      {!anexo.matter_id && sug && (
        <p className={cn("mt-1 text-xs", segueSugestao ? "text-ink/80" : "text-muted")}>
          <span className="rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-900">Sugestão</span>{" "}
          {sug.reference} · {sug.cliente}{sug.itemLabel ? ` · ${sug.itemLabel}` : ""} — confirme antes de associar.
        </p>
      )}
      {anexo.matter_id ? (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-emerald-900">
          <CheckCircle2 aria-hidden className="h-4 w-4" />
          Associado a{" "}
          <Link href={`/processos/${anexo.matter_id}`} className="font-medium underline focus-ring rounded">
            {anexo.matter_reference}
          </Link>
          {anexo.item_label && <> · {anexo.item_label}</>}
        </p>
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label htmlFor={`as-p-${anexo.id}`} className="text-xs">Processo</Label>
            <Select id={`as-p-${anexo.id}`} value={processo} onChange={(e) => { setProcesso(e.target.value); setItem(""); }}>
              <option value="">Escolha…</option>
              {ordenados.map((x) => (
                <option key={x.id} value={x.id}>
                  {sugestoes.includes(x.id) ? "★ " : ""}{x.reference} — {x.title}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`as-i-${anexo.id}`} className="text-xs">Documento</Label>
            <Select id={`as-i-${anexo.id}`} value={item} onChange={(e) => setItem(e.target.value)} disabled={!p}>
              <option value="">Sem documento associado</option>
              {p?.itens.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}{i.status === "em_falta" || i.status === "rejeitado" ? " (em falta)" : ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              className="w-full sm:w-auto"
              disabled={!processo || pendente}
              onClick={() =>
                correr(() => associarAcao(anexo.id, processo, item || null), {
                  sucesso: `«${anexo.filename}» associado a ${p?.reference}.`,
                  anular: (r) => anularTriagemAcao(r.eventoId),
                })
              }
            >
              Associar
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function FormProcessoDeEmail({
  email,
  tipos,
  utilizadores,
  utilizadorAtual,
  fechar,
}: {
  email: EmailCaixa;
  tipos: TipoResumo[];
  utilizadores: UtilizadorResumo[];
  utilizadorAtual: string;
  fechar: () => void;
}) {
  const router = useRouter();
  const { pendente, correr } = useAcao();
  const [nome, setNome] = useState(email.from_name ?? "");
  const [mail, setMail] = useState(email.from_email ?? "");
  const [tipo, setTipo] = useState(tipos[0]?.id ?? "");
  const [resp, setResp] = useState(utilizadorAtual);
  const id = email.id;
  return (
    <form
      className="grid gap-3 border-t border-border bg-background/60 p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        correr(
          () =>
            processoDeEmailAcao(email.id, {
              novoCliente: { nome, email: mail },
              tipoId: tipo,
              responsavelId: resp,
            }),
          {
            sucesso: (d) => `Processo ${d.reference} criado com ${d.anexos} anexo(s).`,
            depois: (d) => {
              fechar();
              router.push(`/processos/${d.id}`);
            },
          },
        );
      }}
    >
      <div>
        <Label htmlFor={`pe-n-${id}`}>Nome do cliente</Label>
        <Input id={`pe-n-${id}`} value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor={`pe-e-${id}`}>Email do cliente</Label>
        <Input id={`pe-e-${id}`} type="email" value={mail} onChange={(e) => setMail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor={`pe-t-${id}`}>Tipo de processo</Label>
        <Select id={`pe-t-${id}`} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`pe-r-${id}`}>Responsável</Label>
        <Select id={`pe-r-${id}`} value={resp} onChange={(e) => setResp(e.target.value)}>
          {utilizadores.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </Select>
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={fechar}>Fechar</Button>
        <Button type="submit" disabled={pendente || !nome.trim()}>Criar processo</Button>
      </div>
    </form>
  );
}
