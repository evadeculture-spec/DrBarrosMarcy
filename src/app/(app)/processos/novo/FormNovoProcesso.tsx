"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { useRascunhoLocal } from "@/lib/rascunho";
import type { ClienteResumo, TipoResumo, UtilizadorResumo } from "@/server/services/processos";
import { criarProcessoAcao } from "../acoes";

export function FormNovoProcesso({
  clientes,
  tipos,
  utilizadores,
  utilizadorAtual,
  clienteInicial,
}: {
  clientes: ClienteResumo[];
  tipos: TipoResumo[];
  utilizadores: UtilizadorResumo[];
  utilizadorAtual: string;
  clienteInicial: string | null;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  const { valor: rascunho, setValor, recuperado, limpar } = useRascunhoLocal(`sf:novo-processo:${utilizadorAtual}`, {
    modoCliente: clientes.length ? "existente" : "novo",
    clienteId: "",
    nome: "",
    email: "",
    telefone: "",
    tipoId: tipos[0]?.id ?? "",
    titulo: "",
    responsavelId: utilizadorAtual,
    seguimento: "",
    estadoInicial: "em_conferencia",
  });
  // Vindo da ficha de um cliente, esse cliente prevalece sobre o rascunho.
  const f = clienteInicial ? { ...rascunho, modoCliente: "existente", clienteId: rascunho.clienteId || clienteInicial } : rascunho;
  const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const palavras = norm(filtro).split(/\s+/).filter(Boolean);
  const filtrados = clientes
    .filter((c) => palavras.every((w) => norm(`${c.name} ${c.reference} ${c.city ?? ""} ${c.email ?? ""}`).includes(w)))
    .slice(0, 60);
  // O cliente escolhido (ex.: vindo da ficha) está sempre na lista.
  const escolhido = clientes.find((c) => c.id === f.clienteId);
  const visiveis = escolhido && !filtrados.includes(escolhido) ? [escolhido, ...filtrados] : filtrados;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValor({ ...f, [k]: e.target.value });

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await criarProcessoAcao({
        clienteId: f.modoCliente === "existente" ? f.clienteId || null : null,
        novoCliente: f.modoCliente === "novo" ? { nome: f.nome, email: f.email, telefone: f.telefone } : null,
        tipoId: f.tipoId,
        titulo: f.titulo,
        responsavelId: f.responsavelId,
        seguimento: f.seguimento || null,
        estadoInicial: f.estadoInicial === "por_triar" ? "por_triar" : "em_conferencia",
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      limpar();
      router.push(`/processos/${r.dados.id}`);
    });
  }

  return (
    <form onSubmit={submeter} className="mt-6 space-y-6 rounded-2xl border border-border bg-surface p-5 shadow-card" noValidate>
      {recuperado && (
        <p className="flex flex-wrap items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm text-muted">
          Recuperámos o rascunho que estava a preencher.
          <button type="button" onClick={limpar} className="font-medium text-bordeaux underline focus-ring rounded">
            Começar do zero
          </button>
        </p>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Cliente</legend>
        <div className="mb-3 flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="modo" checked={f.modoCliente === "existente"} onChange={() => setValor({ ...f, modoCliente: "existente" })} className="accent-bordeaux" disabled={!clientes.length} />
            Cliente existente
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="modo" checked={f.modoCliente === "novo"} onChange={() => setValor({ ...f, modoCliente: "novo" })} className="accent-bordeaux" />
            Novo cliente
          </label>
        </div>
        {f.modoCliente === "existente" ? (
          <div className="grid gap-2">
            <div>
              <Label htmlFor="np-filtro">Procurar cliente</Label>
              <Input id="np-filtro" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Nome, referência ou localidade" autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="np-cliente">Cliente</Label>
              <Select id="np-cliente" value={f.clienteId} onChange={set("clienteId")} required>
                <option value="">Escolha… ({visiveis.length}{visiveis.length === 60 ? "+" : ""} visíveis)</option>
                {visiveis.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.reference}{c.city ? ` · ${c.city}` : ""}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="np-nome">Nome do cliente</Label>
              <Input id="np-nome" value={f.nome} onChange={set("nome")} required autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="np-email">Email</Label>
              <Input id="np-email" type="email" value={f.email} onChange={set("email")} autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="np-tel">Telefone</Label>
              <Input id="np-tel" type="tel" value={f.telefone} onChange={set("telefone")} autoComplete="off" />
            </div>
          </div>
        )}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="np-tipo">Tipo de processo</Label>
          <Select id="np-tipo" value={f.tipoId} onChange={set("tipoId")} required>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="np-resp">Responsável</Label>
          <Select id="np-resp" value={f.responsavelId} onChange={set("responsavelId")} required>
            {utilizadores.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="np-estado">Estado inicial</Label>
          <Select id="np-estado" value={f.estadoInicial} onChange={set("estadoInicial")}>
            <option value="em_conferencia">Em conferência</option>
            <option value="por_triar">Por triar</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="np-titulo">Título (opcional)</Label>
          <Input id="np-titulo" value={f.titulo} onChange={set("titulo")} placeholder="Por omissão: tipo — cliente" aria-describedby="np-titulo-ajuda" />
          <p id="np-titulo-ajuda" className="mt-1 text-xs text-muted">Ex.: «Registo da moradia em Alcains».</p>
        </div>
        <div>
          <Label htmlFor="np-seg">Seguimento (opcional)</Label>
          <Input id="np-seg" type="date" value={f.seguimento} onChange={set("seguimento")} aria-describedby="np-seg-ajuda" />
          <p id="np-seg-ajuda" className="mt-1 text-xs text-muted">Data interna para voltar a olhar para o processo.</p>
        </div>
      </div>

      {erro && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{erro}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pendente}>{pendente ? "A criar…" : "Criar processo"}</Button>
      </div>
    </form>
  );
}
