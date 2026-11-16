import Link from "next/link";
import { ArrowRight, CalendarClock, History, Inbox, TriangleAlert } from "lucide-react";
import { exigirSessao } from "@/server/sessao";
import { vistaHoje } from "@/server/services/hoje";
import { ultimoProcesso } from "@/server/services/processos";
import { diaLisboa, formatarData } from "@/server/domain/datas";
import type { LinhaAcao, LinhaPrazo } from "@/server/domain/hoje";
import { cn } from "@/lib/utils";

export const metadata = { title: "Hoje" };

export default async function HojePage({ searchParams }: { searchParams: { meus?: string } }) {
  const s = await exigirSessao();
  const hoje = diaLisboa();
  const [v, ultimo] = await Promise.all([vistaHoje(s.ctx, hoje), ultimoProcesso(s.ctx)]);
  const soMeus = searchParams.meus === "1";
  const acoes = soMeus
    ? v.acoes.filter((a) => a.responsavelId === s.utilizador.id || a.tipo === "email")
    : v.acoes;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Hoje</h1>
          <p className="mt-1 text-sm text-muted">{formatarData(hoje)} · o que a equipa tem de fazer</p>
        </div>
        {ultimo && (
          <Link
            href={`/processos/${ultimo.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink hover:border-bordeaux/40 focus-ring"
          >
            <History aria-hidden className="h-4 w-4 text-muted" />
            Continuar em {ultimo.reference}
          </Link>
        )}
      </header>

      <section aria-labelledby="t-acoes">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="t-acoes" className="text-base font-semibold text-ink">
            Ações da equipa <span className="font-normal text-muted">({acoes.length})</span>
          </h2>
          <div className="flex rounded-lg border border-border bg-surface p-0.5 text-sm" role="group" aria-label="Filtrar ações">
            <Link
              href="/hoje"
              aria-current={!soMeus ? "true" : undefined}
              className={cn("rounded-md px-3 py-1.5 focus-ring", !soMeus ? "bg-bordeaux text-white" : "text-ink hover:bg-background")}
            >
              Todas
            </Link>
            <Link
              href="/hoje?meus=1"
              aria-current={soMeus ? "true" : undefined}
              className={cn("rounded-md px-3 py-1.5 focus-ring", soMeus ? "bg-bordeaux text-white" : "text-ink hover:bg-background")}
            >
              Só as minhas
            </Link>
          </div>
        </div>
        {acoes.length === 0 ? (
          <Vazio>
            {soMeus
              ? "Não tem ações pendentes. Os restantes processos estão com o cliente ou com colegas."
              : "Nada pendente do lado da equipa. Os processos em curso estão à espera dos clientes."}
          </Vazio>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            {acoes.map((a) => (
              <LinhaAcaoItem key={a.chave} a={a} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="t-prazos">
        <h2 id="t-prazos" className="mb-1 text-base font-semibold text-ink">
          Prazos confirmados <span className="font-normal text-muted">({v.contadores.prazos})</span>
        </h2>
        <p className="mb-3 text-sm text-muted">
          Próximos {14} dias e vencidos.
          {v.contadores.prazosVencidos > 0 && (
            <strong className="ml-1 font-semibold text-red-800">{v.contadores.prazosVencidos} vencido(s).</strong>
          )}
        </p>
        {v.prazos.length === 0 ? (
          <Vazio>Sem prazos confirmados nas próximas duas semanas.</Vazio>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            {v.prazos.map((p) => (
              <LinhaPrazoItem key={p.id} p={p} />
            ))}
          </ul>
        )}
      </section>

      {v.prazosPorConfirmar.length > 0 && (
        <section aria-labelledby="t-por-confirmar">
          <h2 id="t-por-confirmar" className="mb-1 text-base font-semibold text-ink">Prazos por confirmar</h2>
          <p className="mb-3 text-sm text-muted">
            Datas indicadas mas ainda não validadas por um solicitador. Não geram alertas nem contam como prazos.
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-dashed border-border bg-surface">
            {v.prazosPorConfirmar.map((p) => (
              <li key={p.id}>
                <Link href={p.href} className="flex items-center gap-3 px-4 py-3 text-sm text-ink hover:bg-background focus-ring">
                  <CalendarClock aria-hidden className="h-4 w-4 shrink-0 text-muted" />
                  <span className="flex-1">{p.texto}</span>
                  <ArrowRight aria-hidden className="h-4 w-4 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

function LinhaAcaoItem({ a }: { a: LinhaAcao }) {
  const [principal, ...resto] = a.texto.split(" · ");
  return (
    <li>
      <Link href={a.href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-background focus-ring">
        {a.tipo === "email" ? (
          <Inbox aria-hidden className="h-5 w-5 shrink-0 text-muted" />
        ) : a.atrasada ? (
          <TriangleAlert aria-hidden className="h-5 w-5 shrink-0 text-red-700" />
        ) : (
          <ArrowRight aria-hidden className="h-5 w-5 shrink-0 text-bordeaux" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">
            {principal}
            {a.atrasada && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-800">seguimento ultrapassado</span>}
          </span>
          <span className="mt-0.5 block text-sm text-muted">{resto.join(" · ")}</span>
        </span>
      </Link>
    </li>
  );
}

function LinhaPrazoItem({ p }: { p: LinhaPrazo }) {
  const rotulo =
    p.diasEmFalta < 0 ? `vencido há ${-p.diasEmFalta} dia(s)` : p.diasEmFalta === 0 ? "hoje" : `em ${p.diasEmFalta} dia(s)`;
  return (
    <li>
      <Link href={p.href} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-background focus-ring">
        <CalendarClock aria-hidden className={cn("h-4 w-4 shrink-0", p.alerta === "vencido" ? "text-red-700" : p.alerta === "proximo" ? "text-amber-700" : "text-muted")} />
        <span className="flex-1 text-ink">{p.texto}</span>
        <span
          className={cn(
            "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold",
            p.alerta === "vencido" ? "bg-red-50 text-red-800" : p.alerta === "proximo" ? "bg-amber-50 text-amber-900" : "bg-background text-muted",
          )}
        >
          {rotulo}
        </span>
      </Link>
    </li>
  );
}
