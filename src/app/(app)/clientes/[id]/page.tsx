import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Phone, Plus } from "lucide-react";
import { exigirSessao } from "@/server/sessao";
import { obterCliente } from "@/server/services/clientes";
import { formatarData } from "@/server/domain/datas";
import { EstadoProcesso } from "@/components/EstadoProcesso";
import { EditarCliente } from "./EditarCliente";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const s = await exigirSessao();
  const f = await obterCliente(s.ctx, params.id);
  return { title: f ? `${f.cliente.name} (${f.cliente.reference})` : "Cliente" };
}

export default async function FichaClientePage({ params, searchParams }: { params: { id: string }; searchParams: { de?: string } }) {
  const s = await exigirSessao();
  const f = await obterCliente(s.ctx, params.id);
  if (!f) notFound();
  const voltar = searchParams.de && /^\/(clientes|pesquisa)(\?|$)/.test(searchParams.de) ? searchParams.de : "/clientes";
  const voltarRotulo = voltar.startsWith("/pesquisa") ? "Voltar aos resultados da pesquisa" : "Voltar à lista de clientes";
  const c = f.cliente;
  return (
    <div className="space-y-5">
      <Link href={voltar} className="inline-flex min-h-[44px] items-center gap-1.5 rounded text-sm text-muted hover:text-bordeaux focus-ring" data-testid="voltar-lista">
        <ArrowLeft aria-hidden className="h-4 w-4" /> {voltarRotulo}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-bordeaux">{c.reference}</p>
          <h1 className="text-2xl font-semibold text-ink">{c.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {[c.city, c.nif ? `NIF ${c.nif}` : "Sem NIF registado", `cliente desde ${formatarData(c.created_at)}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Link
          href={`/processos/novo?cliente=${c.id}`}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-bordeaux px-4 text-sm font-medium text-white hover:bg-bordeaux-hover focus-ring"
        >
          <Plus aria-hidden className="h-4 w-4" /> Novo processo para este cliente
        </Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <section aria-labelledby="t-contactos" className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h2 id="t-contactos" className="text-base font-semibold text-ink">Contactos</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Mail aria-hidden className="h-4 w-4 text-muted" />
              {c.email ? <a href={`mailto:${c.email}`} className="text-ink underline-offset-2 hover:underline focus-ring rounded">{c.email}</a> : <span className="text-muted">Sem email</span>}
            </li>
            <li className="flex items-center gap-2">
              <Phone aria-hidden className="h-4 w-4 text-muted" />
              {c.phone ? <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="text-ink underline-offset-2 hover:underline focus-ring rounded">{c.phone}</a> : <span className="text-muted">Sem telefone</span>}
            </li>
            <li className="flex items-start gap-2">
              <MapPin aria-hidden className="mt-0.5 h-4 w-4 text-muted" />
              <span className="text-ink">{[c.address, c.city].filter(Boolean).join(", ") || <span className="text-muted">Sem morada</span>}</span>
            </li>
          </ul>
          {c.notes && <p className="mt-3 rounded-lg bg-background px-3 py-2 text-sm text-ink">{c.notes}</p>}
          <EditarCliente cliente={JSON.parse(JSON.stringify(c))} />
        </section>

        <section aria-labelledby="t-proxima" className="rounded-2xl border border-border bg-surface p-5 shadow-card lg:col-span-2">
          <h2 id="t-proxima" className="text-base font-semibold text-ink">Próxima ação</h2>
          {f.proximaAcao ? (
            <p className="mt-2 text-sm text-ink">
              <Link href={`/processos/${f.proximaAcao.processoId}`} className="font-medium text-bordeaux underline-offset-2 hover:underline focus-ring rounded">
                {f.proximaAcao.reference}
              </Link>{" "}
              — {f.proximaAcao.texto} <span className="text-muted">· {f.proximaAcao.quem}{f.proximaAcao.quando ? ` · ${formatarData(f.proximaAcao.quando)}` : ""}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">Sem processos ativos. Use «Novo processo para este cliente».</p>
          )}

          <h2 className="mt-5 text-base font-semibold text-ink">Processos ({f.processos.length})</h2>
          {f.processos.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">Este cliente ainda não tem processos.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
              {f.processos.map((p) => (
                <li key={p.id}>
                  <Link href={`/processos/${p.id}`} className="flex min-h-[56px] flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 hover:bg-background focus-ring">
                    <span className="font-mono text-sm font-semibold text-bordeaux">{p.reference}</span>
                    <span className="min-w-0 flex-1 text-sm text-ink">{p.title}</span>
                    <EstadoProcesso estado={p.state} />
                    <span className="w-full text-xs text-muted">
                      {p.proximo_passo} · {p.responsible_name}{p.falta > 0 ? ` · faltam ${p.falta}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
