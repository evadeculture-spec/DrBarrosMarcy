"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRightLeft, FileText, Upload } from "lucide-react";
import { useAcao } from "@/components/useAcao";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import type { AnexoFicha, Ficha } from "@/server/services/processos";
import { cn } from "@/lib/utils";
import {
  adicionarItemAcao,
  alterarItemAcao,
  anularAcao,
  carregarNoProcessoAcao,
  moverAnexoAcao,
  simularRececaoAcao,
} from "../acoes";
import type { DestinoMover } from "./Ficha";

const ESTADOS_ITEM = [
  { v: "em_falta", r: "Em falta" },
  { v: "recebido", r: "Recebido para revisão" },
  { v: "conferido", r: "Validado" },
  { v: "rejeitado", r: "Rejeitado" },
] as const;

const COR_ITEM: Record<string, string> = {
  em_falta: "border-red-300 bg-red-50 text-red-900",
  recebido: "border-blue-200 bg-blue-50 text-blue-900",
  conferido: "border-emerald-200 bg-emerald-50 text-emerald-900",
  rejeitado: "border-red-300 bg-red-50 text-red-900",
};

export function tamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function TabDocumentos({ ficha, destinos, demo }: { ficha: Ficha; destinos: DestinoMover[]; demo: boolean }) {
  const concluido = ficha.matter.state === "concluido";
  const soltos = ficha.anexos.filter((a) => !a.item_id);
  const router = useRouter();
  const { pendente, correr } = useAcao();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-4">
        <p className="min-w-0 flex-1 text-sm text-muted">
          Documentos recebidos por email, correio ou em mão registam-se em{" "}
          <a href="/documentos?separador=rececao" className="font-medium text-bordeaux underline-offset-2 hover:underline focus-ring rounded">Documentos em falta → Receção</a>
          , onde se confirma o processo certo para cada anexo. Também pode carregar um ficheiro diretamente num documento abaixo.
        </p>
        {demo && !concluido && (
          <Button
            variant="outline"
            className="h-11"
            disabled={pendente}
            onClick={() =>
              correr(() => simularRececaoAcao(ficha.matter.id), {
                sucesso: (d) => `Resposta simulada com ${d.anexos} anexos. Associe-os em Receção.`,
                depois: () => router.push("/documentos?separador=rececao"),
              })
            }
          >
            Simular resposta do cliente (3 anexos)
          </Button>
        )}
      </div>
      {concluido && (
        <p className="rounded-lg bg-background px-3 py-2 text-sm text-muted">
          Processo concluído: reabra-o para alterar a lista documental.
        </p>
      )}
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card" aria-label="Lista documental">
        {ficha.itens.map((item) => (
          <ItemDocumental
            key={item.id}
            matterId={ficha.matter.id}
            item={item}
            anexos={ficha.anexos.filter((a) => a.item_id === item.id)}
            destinos={destinos}
            bloqueado={concluido}
          />
        ))}
        {ficha.itens.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted">Este tipo de processo não tem lista documental. Acrescente documentos abaixo.</li>
        )}
      </ul>

      {soltos.length > 0 && (
        <section aria-labelledby="t-soltos">
          <h3 id="t-soltos" className="mb-2 text-sm font-semibold text-ink">Outros anexos (sem documento da lista)</h3>
          <ul className="space-y-1">
            {soltos.map((a) => (
              <LinhaAnexo key={a.id} anexo={a} destinos={destinos} bloqueado={concluido} />
            ))}
          </ul>
        </section>
      )}

      {!concluido && <NovoItem matterId={ficha.matter.id} />}
      <p className="text-xs text-muted">
        As listas documentais são exemplos configuráveis pelo escritório, não requisitos legais confirmados.
      </p>
    </div>
  );
}

function ItemDocumental({
  matterId,
  item,
  anexos,
  destinos,
  bloqueado,
}: {
  matterId: string;
  item: Ficha["itens"][number];
  anexos: AnexoFicha[];
  destinos: DestinoMover[];
  bloqueado: boolean;
}) {
  const { pendente, correr } = useAcao();
  const ficheiro = useRef<HTMLInputElement>(null);
  const idSel = `item-${item.id}`;
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
          <label htmlFor={idSel} className="text-sm font-medium text-ink">
            {item.label}
          </label>
          {!item.required && <span className="ml-2 text-xs text-muted">(opcional)</span>}
        </div>
        <Select
          id={idSel}
          value={item.status}
          disabled={pendente || bloqueado}
          className={cn("h-9 min-w-0 flex-1 text-sm font-medium sm:w-auto sm:min-w-[12rem] sm:flex-none", COR_ITEM[item.status])}
          onChange={(e) => {
            const novo = e.target.value;
            const anterior = item.status;
            correr(() => alterarItemAcao(item.id, novo), {
              sucesso: `«${item.label}»: ${ESTADOS_ITEM.find((x) => x.v === novo)?.r}.`,
              anular: () => alterarItemAcao(item.id, anterior),
            });
          }}
        >
          {ESTADOS_ITEM.map((s) => (
            <option key={s.v} value={s.v}>{s.r}</option>
          ))}
        </Select>
        {!bloqueado && (
          <>
            <input
              ref={ficheiro}
              type="file"
              className="sr-only"
              id={`up-${item.id}`}
              aria-label={`Ficheiro para «${item.label}»`}
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const fd = new FormData();
                fd.set("ficheiro", f);
                fd.set("matterId", matterId);
                fd.set("itemId", item.id);
                correr(() => carregarNoProcessoAcao(fd), {
                  sucesso: `«${f.name}» carregado em «${item.label}».`,
                  anular: (d) => anularAcao(d.eventoId),
                });
                e.target.value = "";
              }}
            />
            <Button type="button" variant="ghost" size="sm" disabled={pendente} onClick={() => ficheiro.current?.click()}>
              <Upload aria-hidden className="h-4 w-4" />
              Carregar<span className="sr-only"> ficheiro para «{item.label}»</span>
            </Button>
          </>
        )}
      </div>
      {anexos.length > 0 && (
        <ul className="mt-2 space-y-1">
          {anexos.map((a) => (
            <LinhaAnexo key={a.id} anexo={a} destinos={destinos} bloqueado={bloqueado} />
          ))}
        </ul>
      )}
    </li>
  );
}

function LinhaAnexo({ anexo, destinos, bloqueado }: { anexo: AnexoFicha; destinos: DestinoMover[]; bloqueado: boolean }) {
  const [aMover, setAMover] = useState(false);
  return (
    <li className="rounded-lg bg-background px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <FileText aria-hidden className="h-4 w-4 shrink-0 text-muted" />
        <a href={`/api/anexos/${anexo.id}`} className="min-w-0 flex-1 truncate text-ink underline-offset-2 hover:text-bordeaux hover:underline focus-ring rounded">
          {anexo.filename}
        </a>
        <span className="text-xs text-muted">{tamanho(anexo.size_bytes)}</span>
        {!bloqueado && (
          <Button type="button" variant="ghost" size="sm" aria-expanded={aMover} onClick={() => setAMover((v) => !v)}>
            <ArrowRightLeft aria-hidden className="h-4 w-4" /> Mover<span className="sr-only"> «{anexo.filename}»</span>
          </Button>
        )}
      </div>
      {aMover && <PainelMover anexo={anexo} destinos={destinos} fechar={() => setAMover(false)} />}
    </li>
  );
}

function PainelMover({ anexo, destinos, fechar }: { anexo: AnexoFicha; destinos: DestinoMover[]; fechar: () => void }) {
  const { pendente, correr } = useAcao();
  const [destino, setDestino] = useState("");
  const [item, setItem] = useState("");
  const d = destinos.find((x) => x.id === destino);
  const id = anexo.id;
  return (
    <div className="mt-2 grid gap-2 rounded-lg border border-border bg-surface p-3 sm:grid-cols-[1fr_1fr_auto]">
      <div>
        <Label htmlFor={`mv-p-${id}`}>Mover para o processo</Label>
        <Select id={`mv-p-${id}`} value={destino} onChange={(e) => { setDestino(e.target.value); setItem(""); }}>
          <option value="">Escolha…</option>
          {destinos.map((x) => (
            <option key={x.id} value={x.id}>{x.reference} — {x.title}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`mv-i-${id}`}>Documento no destino</Label>
        <Select id={`mv-i-${id}`} value={item} onChange={(e) => setItem(e.target.value)} disabled={!d}>
          <option value="">Sem documento associado</option>
          {d?.itens.map((i) => (
            <option key={i.id} value={i.id}>{i.label}</option>
          ))}
        </Select>
      </div>
      <div className="flex items-end gap-2">
        <Button
          type="button"
          size="sm"
          className="h-10"
          disabled={!destino || pendente}
          onClick={() =>
            correr(() => moverAnexoAcao(anexo.id, destino, item || null), {
              sucesso: `«${anexo.filename}» movido para ${d?.reference}.`,
              anular: (r) => anularAcao(r.eventoId),
              depois: fechar,
            })
          }
        >
          Mover
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-10" onClick={fechar}>
          Fechar
        </Button>
      </div>
    </div>
  );
}

function NovoItem({ matterId }: { matterId: string }) {
  const { pendente, correr } = useAcao();
  const [nome, setNome] = useState("");
  const [obrigatorio, setObrigatorio] = useState(true);
  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        correr(() => adicionarItemAcao(matterId, nome, obrigatorio), {
          sucesso: `«${nome}» acrescentado à lista.`,
          depois: () => setNome(""),
        });
      }}
    >
      <div className="min-w-[14rem] flex-1">
        <Label htmlFor="novo-item">Acrescentar documento a este processo</Label>
        <Input id="novo-item" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Planta do imóvel" />
      </div>
      <label className="mb-2.5 flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={obrigatorio} onChange={(e) => setObrigatorio(e.target.checked)} className="h-4 w-4 accent-bordeaux" />
        Obrigatório
      </label>
      <Button type="submit" variant="outline" disabled={!nome.trim() || pendente}>Acrescentar</Button>
    </form>
  );
}
