"use client";

import { useEffect, useRef, useState } from "react";
import { useAcao } from "@/components/useAcao";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { formatarDataHora } from "@/server/domain/datas";
import type { Ficha, PedidoFicha } from "@/server/services/processos";
import { cn } from "@/lib/utils";
import {
  aprovarEnviarAcao,
  cancelarPedidoAcao,
  devolverPedidoAcao,
  guardarRascunhoAcao,
  prepararPedidoAcao,
  registarEnvioExternoAcao,
  submeterPedidoAcao,
} from "../acoes";
import { useAvisos } from "@/components/avisos";
import type { Permissoes } from "./Ficha";

const ROTULO: Record<string, string> = {
  rascunho: "Rascunho",
  a_aguardar_aprovacao: "A aguardar aprovação",
  enviado: "Enviado",
  falhado: "Envio falhado",
  devolvido: "Devolvido",
  cancelado: "Cancelado",
};

export function TabPedido({ ficha, permissoes }: { ficha: Ficha; permissoes: Permissoes }) {
  const { pendente, correr } = useAcao();
  const aberto = ficha.pedidos.find((p) => ["rascunho", "a_aguardar_aprovacao", "falhado"].includes(p.status));
  const anteriores = ficha.pedidos.filter((p) => p !== aberto);
  const m = ficha.matter;
  const podePreparar = m.state === "em_conferencia" || m.state === "resposta_por_conferir";

  return (
    <div className="space-y-6">
      {aberto ? (
        <PedidoAberto key={aberto.id} pedido={aberto} permissoes={permissoes} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-5">
          <p className="text-sm text-ink">Não há nenhum pedido ao cliente em curso.</p>
          {podePreparar ? (
            <>
              <p className="mt-1 text-sm text-muted">
                O rascunho é criado a partir do modelo «Pedido de documentos em falta», com os {ficha.faixa.falta} documento(s) em falta já preenchidos.
              </p>
              <Button className="mt-4" disabled={pendente} onClick={() => correr(() => prepararPedidoAcao(m.id))}>
                Preparar pedido ao cliente
              </Button>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">
              Só se prepara um pedido com o processo em «Em conferência» ou «Resposta por conferir».
            </p>
          )}
        </div>
      )}

      {anteriores.length > 0 && (
        <section aria-labelledby="t-anteriores">
          <h3 id="t-anteriores" className="mb-2 text-sm font-semibold text-ink">Pedidos anteriores</h3>
          <ul className="space-y-2">
            {anteriores.map((p) => (
              <li key={p.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
                <details>
                  <summary className="cursor-pointer rounded focus-ring">
                    <span className="font-medium text-ink">{p.subject || "(sem assunto)"}</span>
                    <span className="ml-2 text-muted">
                      {ROTULO[p.status]}
                      {p.sent_at && <> · {formatarDataHora(p.sent_at)} para {p.to_email}</>}
                      {p.approved_by_name && <> · aprovado por {p.approved_by_name}</>}
                    </span>
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink">{p.body}</pre>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PedidoAberto({ pedido, permissoes }: { pedido: PedidoFicha; permissoes: Permissoes }) {
  const { pendente, correr } = useAcao();
  const editavel = pedido.status === "rascunho";
  const [campos, setCampos] = useState({ para: pedido.to_email, assunto: pedido.subject, corpo: pedido.body });
  const [guardado, setGuardado] = useState<{ estado: "guardado" | "a_guardar" | "erro"; em?: string }>({
    estado: "guardado",
    em: pedido.updated_at,
  });
  const [motivo, setMotivo] = useState("");
  const primeira = useRef(true);

  // Guardado automático do rascunho.
  useEffect(() => {
    if (!editavel) return;
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    setGuardado({ estado: "a_guardar" });
    const t = setTimeout(async () => {
      const r = await guardarRascunhoAcao(pedido.id, campos);
      setGuardado(r.ok ? { estado: "guardado", em: r.dados.guardadoEm } : { estado: "erro" });
    }, 700);
    return () => clearTimeout(t);
  }, [campos, editavel, pedido.id]);

  const marcadores = /\[[A-Z_]+\]/.test(campos.assunto + campos.corpo);

  return (
    <section aria-labelledby="t-pedido" className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="t-pedido" className="text-base font-semibold text-ink">
          Pedido ao cliente — <span className={cn(pedido.status === "falhado" && "text-red-800")}>{ROTULO[pedido.status]}</span>
        </h3>
        {editavel && (
          <p className="text-xs text-muted" aria-live="polite">
            {guardado.estado === "a_guardar"
              ? "A guardar…"
              : guardado.estado === "erro"
                ? "Não foi possível guardar. Verifique a ligação."
                : `Guardado automaticamente${guardado.em ? ` · ${formatarDataHora(guardado.em)}` : ""}`}
          </p>
        )}
      </div>

      {pedido.status === "falhado" && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          O envio falhou ({pedido.attempts} tentativa(s)): {pedido.last_error}. Reenviar usa este mesmo pedido — o cliente
          nunca recebe duplicados.
        </p>
      )}

      <div className="grid gap-3">
        <div>
          <Label htmlFor="pd-para">Para</Label>
          <Input id="pd-para" type="email" value={campos.para} readOnly={!editavel} onChange={(e) => setCampos({ ...campos, para: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="pd-assunto">Assunto</Label>
          <Input id="pd-assunto" value={campos.assunto} readOnly={!editavel} onChange={(e) => setCampos({ ...campos, assunto: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="pd-corpo">Texto</Label>
          <Textarea
            id="pd-corpo"
            rows={12}
            value={campos.corpo}
            readOnly={!editavel}
            onChange={(e) => setCampos({ ...campos, corpo: e.target.value })}
            aria-describedby={marcadores ? "pd-marcadores" : undefined}
          />
          {marcadores && (
            <p id="pd-marcadores" className="mt-1 text-sm text-amber-900">
              Há campos entre parênteses retos por preencher; o pedido não pode ser enviado assim.
            </p>
          )}
        </div>
      </div>

      <CopiarERegistar pedido={pedido} campos={campos} permissoes={permissoes} aGuardar={guardado.estado === "a_guardar"} />

      <div className="flex flex-wrap gap-2">
        {pedido.status === "rascunho" && (
          <>
            {permissoes.aprovar ? (
              <Button disabled={pendente || guardado.estado === "a_guardar"} onClick={() => correr(() => aprovarEnviarAcao(pedido.id), { sucesso: "Pedido aprovado e enviado. A bola passa ao cliente." })}>
                Aprovar e enviar
              </Button>
            ) : null}
            <Button
              variant={permissoes.aprovar ? "outline" : "primary"}
              disabled={pendente || guardado.estado === "a_guardar"}
              onClick={() => correr(() => submeterPedidoAcao(pedido.id), { sucesso: "Pedido enviado para aprovação de um solicitador." })}
            >
              Submeter para aprovação
            </Button>
            <Button variant="ghost" disabled={pendente} onClick={() => correr(() => cancelarPedidoAcao(pedido.id), { sucesso: "Rascunho cancelado." })}>
              Cancelar rascunho
            </Button>
          </>
        )}
        {pedido.status === "a_aguardar_aprovacao" &&
          (permissoes.aprovar ? (
            <div className="flex w-full flex-wrap items-end gap-2">
              <Button disabled={pendente} onClick={() => correr(() => aprovarEnviarAcao(pedido.id), { sucesso: "Pedido aprovado e enviado. A bola passa ao cliente." })}>
                Aprovar e enviar
              </Button>
              <div className="min-w-[14rem] flex-1">
                <Label htmlFor="pd-motivo">Motivo da devolução (opcional)</Label>
                <Input id="pd-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
              <Button variant="outline" disabled={pendente} onClick={() => correr(() => devolverPedidoAcao(pedido.id, motivo), { sucesso: "Pedido devolvido para correção." })}>
                Devolver para correção
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted">À espera de aprovação de um solicitador.</p>
          ))}
        {pedido.status === "falhado" && (
          <>
            {permissoes.aprovar ? (
              <Button disabled={pendente} onClick={() => correr(() => aprovarEnviarAcao(pedido.id), { sucesso: "Pedido reenviado. A bola passa ao cliente." })}>
                Reenviar
              </Button>
            ) : (
              <p className="text-sm text-muted">Um solicitador tem de reenviar ou cancelar.</p>
            )}
            {permissoes.aprovar && (
              <Button variant="ghost" disabled={pendente} onClick={() => correr(() => cancelarPedidoAcao(pedido.id), { sucesso: "Pedido cancelado." })}>
                Cancelar pedido
              </Button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Modo sem envio automático: copiar o texto para o email do escritório e,
 * depois de o enviar lá, registar aqui o envio. Copiar não muda o estado.
 */
function CopiarERegistar({
  pedido,
  campos,
  permissoes,
  aGuardar,
}: {
  pedido: PedidoFicha;
  campos: { para: string; assunto: string; corpo: string };
  permissoes: Permissoes;
  aGuardar: boolean;
}) {
  const { pendente, correr } = useAcao();
  const { avisar } = useAvisos();
  const [nota, setNota] = useState("");
  const [registar, setRegistar] = useState(false);
  const copiar = async () => {
    const texto = `Para: ${campos.para}\nAssunto: ${campos.assunto}\n\n${campos.corpo}`;
    try {
      await navigator.clipboard.writeText(texto);
      avisar({ tipo: "sucesso", texto: "Texto copiado. O pedido continua por enviar até registar o envio." });
    } catch {
      avisar({ tipo: "erro", texto: "Não foi possível copiar automaticamente. Selecione o texto e copie à mão." });
    }
  };
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-sm text-ink">
        Enviar a partir do email do escritório? Copie o texto, envie-o e depois registe o envio aqui.
        <span className="block text-xs text-muted">Criar ou copiar o rascunho não o marca como enviado.</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-11" onClick={copiar}>
          Copiar texto
        </Button>
        {permissoes.aprovar && (
          <Button type="button" variant="ghost" className="h-11" aria-expanded={registar} onClick={() => setRegistar((v) => !v)}>
            Registar envio externo
          </Button>
        )}
      </div>
      {registar && (
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            correr(() => registarEnvioExternoAcao(pedido.id, nota), {
              sucesso: "Envio externo registado. A bola passa ao cliente.",
            });
          }}
        >
          <div className="min-w-[14rem] flex-1">
            <Label htmlFor="ee-nota">Nota (opcional)</Label>
            <Input id="ee-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: enviado do email geral às 10h" />
          </div>
          <Button type="submit" className="h-10" disabled={pendente || aGuardar}>Confirmar que foi enviado</Button>
        </form>
      )}
    </div>
  );
}
