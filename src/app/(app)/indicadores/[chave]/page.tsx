import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { exigirSessao } from "@/server/sessao";
import { eChaveIndicador, indicador } from "@/server/services/indicadores";
import { cn } from "@/lib/utils";

export default async function IndicadorPage({ params }: { params: { chave: string } }) {
  const s = await exigirSessao();
  if (!eChaveIndicador(params.chave)) notFound();
  const r = await indicador(s.ctx, params.chave);
  return (
    <div className="space-y-5">
      <Link href="/dashboard" className="inline-flex min-h-[44px] items-center gap-1.5 rounded text-sm text-muted hover:text-bordeaux focus-ring">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Dashboard
      </Link>
      <header>
        <h1 className="text-2xl font-semibold text-ink">
          {r.titulo} <span className="font-normal text-muted" data-testid="total">({r.total})</span>
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{r.definicao}</p>
      </header>
      {r.linhas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-muted">Nada a mostrar: o contador está a zero.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card" data-testid="lista-indicador">
          {r.linhas.map((l) => (
            <li key={l.id}>
              <Link href={l.href} className="flex min-h-[56px] items-center gap-3 px-4 py-3 hover:bg-background focus-ring">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{l.titulo}</span>
                  <span className="block text-sm text-muted">{l.detalhe}</span>
                </span>
                {l.etiqueta && (
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                    l.tom === "perigo" ? "border-red-200 bg-red-50 text-red-800" : l.tom === "aviso" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-border bg-background text-ink/80")}>
                    {l.etiqueta}
                  </span>
                )}
                <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
