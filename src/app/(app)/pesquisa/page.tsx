import Link from "next/link";
import { exigirSessao } from "@/server/sessao";
import { pesquisar } from "@/server/services/pesquisa";
import { EstadoProcesso } from "@/components/EstadoProcesso";

export const metadata = { title: "Pesquisa" };

export default async function PesquisaPage({ searchParams }: { searchParams: { q?: string } }) {
  const s = await exigirSessao();
  const q = (searchParams.q ?? "").trim().slice(0, 100);
  const r = await pesquisar(s.ctx, q);
  const total = r.clientes.length + r.processos.length + r.emails.length;
  const de = encodeURIComponent(`/pesquisa?q=${encodeURIComponent(q)}`);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Pesquisa</h1>
        <form role="search" className="mt-3 flex gap-2" aria-label="Refinar pesquisa">
          <label htmlFor="p-q" className="sr-only">Termo de pesquisa</label>
          <input id="p-q" name="q" defaultValue={q} className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus-ring" />
          <button type="submit" className="h-11 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-ink focus-ring">Procurar</button>
        </form>
      </header>
      {q.length < 2 ? (
        <p className="text-sm text-muted">Escreva pelo menos 2 caracteres. Os acentos não são necessários (ex.: «ines»).</p>
      ) : total === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted" role="status">
          Sem resultados para «{q}». Experimente só o apelido, a referência (CLI-…) ou o NIF.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted" role="status">{total} resultado(s) para «{q}».</p>
          {r.clientes.length > 0 && (
            <section aria-labelledby="r-cli">
              <h2 id="r-cli" className="mb-2 text-sm font-semibold text-ink">Clientes</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {r.clientes.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clientes/${c.id}?de=${de}`} className="flex min-h-[56px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm hover:bg-background focus-ring">
                      <span className="font-mono text-xs font-semibold text-bordeaux">{c.reference}</span>
                      <span className="flex-1 font-medium text-ink">{c.name}</span>
                      {c.homonimo && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">Homónimo</span>}
                      <span className="w-full text-xs text-muted sm:w-auto">
                        {[c.city, c.nif ? `NIF …${c.nif.slice(-3)}` : "sem NIF", c.email, `${c.processos} processo(s)`].filter(Boolean).join(" · ")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {r.processos.length > 0 && (
            <section aria-labelledby="r-proc">
              <h2 id="r-proc" className="mb-2 text-sm font-semibold text-ink">Processos</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {r.processos.map((p) => (
                  <li key={p.id}>
                    <Link href={`/processos/${p.id}`} className="flex min-h-[56px] flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-background focus-ring">
                      <span className="font-mono font-semibold text-bordeaux">{p.reference}</span>
                      <span className="flex-1 text-ink">{p.title}</span>
                      <EstadoProcesso estado={p.state} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {r.emails.length > 0 && (
            <section aria-labelledby="r-email">
              <h2 id="r-email" className="mb-2 text-sm font-semibold text-ink">Documentos recebidos por associar</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {r.emails.map((e) => (
                  <li key={e.id}>
                    <Link href={`/documentos?separador=rececao#email-${e.id}`} className="block min-h-[56px] px-4 py-3 text-sm hover:bg-background focus-ring">
                      <span className="font-medium text-ink">{e.from}</span> · {e.subject || "(sem assunto)"}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
