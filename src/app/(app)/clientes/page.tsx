import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { exigirSessao } from "@/server/sessao";
import { listarClientesPaginado } from "@/server/services/clientes";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export const metadata = { title: "Clientes" };

export default async function ClientesPage({ searchParams }: { searchParams: { q?: string; pagina?: string } }) {
  const s = await exigirSessao();
  const q = (searchParams.q ?? "").slice(0, 100);
  const r = await listarClientesPaginado(s.ctx, { q, pagina: Number(searchParams.pagina) || 1 });
  const contexto = new URLSearchParams();
  if (q) contexto.set("q", q);
  if (r.pagina > 1) contexto.set("pagina", String(r.pagina));
  const de = encodeURIComponent(`/clientes${contexto.size ? `?${contexto}` : ""}`);
  const pagina = (n: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (n > 1) u.set("pagina", String(n));
    return `/clientes${u.size ? `?${u}` : ""}`;
  };
  const inicio = r.total === 0 ? 0 : (r.pagina - 1) * 25 + 1;
  const fim = Math.min(r.pagina * 25, r.total);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Clientes</h1>
          <p className="mt-1 text-sm text-muted" role="status">
            {r.total === 0 ? "Nenhum cliente" : `${inicio}–${fim} de ${r.total} clientes`}
            {q && <> para «{q}»</>} · ordenados por nome
          </p>
        </div>
        <Link href="/clientes/novo" className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-ink hover:border-bordeaux/40 focus-ring">
          <Plus aria-hidden className="h-4 w-4" /> Novo cliente
        </Link>
      </header>

      <form role="search" aria-label="Pesquisar clientes" className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-surface p-4">
        <div className="min-w-[14rem] flex-1">
          <Label htmlFor="cl-q">Procurar por nome, referência, NIF, email, telefone ou localidade</Label>
          <Input id="cl-q" name="q" defaultValue={q} placeholder="Ex.: ines faria, CLI-0001" autoComplete="off" />
        </div>
        <Button type="submit" variant="outline" className="h-10">Procurar</Button>
        {q && (
          <Link href="/clientes" className="inline-flex h-10 items-center rounded-lg px-3 text-sm text-muted hover:text-bordeaux focus-ring">Limpar</Link>
        )}
      </form>

      {r.linhas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center">
          <p className="text-sm text-ink">{q ? `Nenhum cliente corresponde a «${q}».` : "Ainda não há clientes."}</p>
          <p className="mt-1 text-sm text-muted">Verifique a ortografia ou procure pela referência (CLI-…) ou NIF. Os acentos não são necessários.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card" aria-label="Clientes">
          {r.linhas.map((c) => (
            <li key={c.id}>
              <Link href={`/clientes/${c.id}?de=${de}`} className="flex min-h-[60px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-background focus-ring">
                <span className="font-mono text-xs font-semibold text-bordeaux">{c.reference}</span>
                <span className="min-w-0 flex-1 text-sm font-medium text-ink">{c.name}</span>
                <span className="w-full text-sm text-muted sm:w-auto">
                  {[c.city, c.nif ? `NIF …${c.nif.slice(-3)}` : null, c.email].filter(Boolean).join(" · ")}
                </span>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs text-ink/80">
                  {c.processos_ativos} ativo(s) · {c.processos_total} no total
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {r.paginas > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-between gap-2">
          {r.pagina > 1 ? (
            <Link href={pagina(r.pagina - 1)} className="inline-flex h-11 items-center gap-1 rounded-lg border border-border bg-surface px-4 text-sm text-ink focus-ring" rel="prev">
              <ChevronLeft aria-hidden className="h-4 w-4" /> Anterior
            </Link>
          ) : <span />}
          <span className="text-sm text-muted">Página {r.pagina} de {r.paginas}</span>
          {r.pagina < r.paginas ? (
            <Link href={pagina(r.pagina + 1)} className="inline-flex h-11 items-center gap-1 rounded-lg border border-border bg-surface px-4 text-sm text-ink focus-ring" rel="next">
              Seguinte <ChevronRight aria-hidden className="h-4 w-4" />
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
