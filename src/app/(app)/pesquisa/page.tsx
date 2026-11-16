import Link from "next/link";
import { exigirSessao } from "@/server/sessao";
import { pesquisar } from "@/server/services/pesquisa";
import { EstadoProcesso } from "@/components/EstadoProcesso";

export const metadata = { title: "Pesquisa" };

export default async function PesquisaPage({ searchParams }: { searchParams: { q?: string } }) {
  const s = await exigirSessao();
  const q = (searchParams.q ?? "").trim();
  const r = await pesquisar(s.ctx, q);
  const total = r.processos.length + r.emails.length;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink">Pesquisa</h1>
      {q.length < 2 ? (
        <p className="text-sm text-muted">Escreva pelo menos 2 caracteres na caixa de pesquisa.</p>
      ) : total === 0 ? (
        <p className="text-sm text-muted">Sem resultados para «{q}».</p>
      ) : (
        <>
          <p className="text-sm text-muted" role="status">{total} resultado(s) para «{q}».</p>
          {r.processos.length > 0 && (
            <section aria-labelledby="r-proc">
              <h2 id="r-proc" className="mb-2 text-sm font-semibold text-ink">Processos</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {r.processos.map((p) => (
                  <li key={p.id}>
                    <Link href={`/processos/${p.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-background focus-ring">
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
              <h2 id="r-email" className="mb-2 text-sm font-semibold text-ink">Emails por triar</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {r.emails.map((e) => (
                  <li key={e.id}>
                    <Link href={`/triagem#email-${e.id}`} className="block px-4 py-3 text-sm hover:bg-background focus-ring">
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
