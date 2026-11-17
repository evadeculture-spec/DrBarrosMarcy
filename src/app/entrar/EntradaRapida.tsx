"use client";

import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { entrarDemoAcao } from "./acoes";

export function EntradaRapida({ contas }: { contas: { email: string; nome: string; papel: string }[] }) {
  const [pendente, iniciar] = useTransition();
  const [aEntrar, setAEntrar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <section aria-labelledby="t-rapida" className="mt-6 rounded-2xl border-2 border-bordeaux/30 bg-surface p-4">
      <h2 id="t-rapida" className="text-sm font-semibold text-ink">Entrada rápida — demonstração</h2>
      <p className="mt-0.5 text-sm text-muted">Escolha um perfil para entrar sem email nem palavra-passe.</p>
      <ul className="mt-3 grid gap-2">
        {contas.map((c) => (
          <li key={c.email}>
            <button
              type="button"
              disabled={pendente}
              onClick={() => {
                setErro(null);
                setAEntrar(c.email);
                iniciar(async () => {
                  const r = await entrarDemoAcao(c.email);
                  if (r?.erro) setErro(r.erro);
                });
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left hover:border-bordeaux/40 focus-ring disabled:opacity-60"
            >
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bordeaux text-sm font-semibold text-white"
              >
                {c.nome.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{c.nome}</span>
                <span className="block text-xs text-ink/75">{c.papel}</span>
              </span>
              <span className="text-sm font-medium text-bordeaux">
                {pendente && aEntrar === c.email ? "A entrar…" : <ArrowRight aria-label={`Entrar como ${c.nome}`} className="h-4 w-4" />}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-red-900">{erro}</p>
      )}
    </section>
  );
}
