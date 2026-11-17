"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAcao } from "@/components/useAcao";
import { Button } from "@/components/ui/button";
import { prepararPedidoAcao } from "../processos/acoes";

export interface GrupoEmFalta {
  matterId: string;
  reference: string;
  cliente: string;
  responsavel: string;
  itens: { id: string; label: string; estado: string }[];
}

export function EmFalta({ grupos, total }: { grupos: GrupoEmFalta[]; total: number }) {
  const router = useRouter();
  const { pendente, correr } = useAcao();
  if (grupos.length === 0) {
    return <p className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-muted">Não há documentos obrigatórios em falta.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted" data-testid="total">{total} documento(s) em {grupos.length} processo(s).</p>
      <ul className="space-y-3">
        {grupos.map((g) => (
          <li key={g.matterId} className="rounded-2xl border border-border bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Link href={`/processos/${g.matterId}`} className="font-mono text-sm font-semibold text-bordeaux underline-offset-2 hover:underline focus-ring rounded">
                {g.reference}
              </Link>
              <span className="min-w-0 flex-1 text-sm font-medium text-ink">{g.cliente}</span>
              <span className="text-xs text-muted">{g.responsavel}</span>
              <Button
                className="h-11"
                variant="outline"
                disabled={pendente}
                onClick={() =>
                  correr(() => prepararPedidoAcao(g.matterId), {
                    depois: () => router.push(`/processos/${g.matterId}?separador=pedido`),
                  })
                }
              >
                Preparar pedido<span className="sr-only"> para {g.reference}</span>
              </Button>
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {g.itens.map((i) => (
                <li key={i.id} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-900">
                  {i.label} · {i.estado}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
