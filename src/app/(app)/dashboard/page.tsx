import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckSquare,
  Euro,
  FileWarning,
  FolderOpen,
  PauseCircle,
} from "lucide-react";
import { exigirSessao } from "@/server/sessao";
import { dadosDashboard, saudacao } from "@/server/services/dashboard";
import { INDICADORES } from "@/server/services/indicadores";
import { diaLisboa, formatarData } from "@/server/domain/datas";
import { StatCard } from "@/components/StatCard";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const ETIQUETA_TIPO = {
  prazo: { texto: "Prazo", classe: "border-red-200 bg-red-50 text-red-800" },
  tarefa: { texto: "Tarefa", classe: "border-amber-200 bg-amber-50 text-amber-900" },
  acao: { texto: "Ação", classe: "border-blue-200 bg-blue-50 text-blue-900" },
  lembrete: { texto: "Lembrete interno", classe: "border-violet-200 bg-violet-50 text-violet-900" },
  triagem: { texto: "Receção", classe: "border-slate-300 bg-slate-50 text-slate-800" },
} as const;

export default async function DashboardPage({ searchParams }: { searchParams: { tudo?: string } }) {
  const s = await exigirSessao();
  const hoje = diaLisboa();
  const d = await dadosDashboard(s.ctx, hoje);
  const primeiroNome = s.utilizador.name.split(" ")[0];
  const verTudo = searchParams.tudo === "1";
  const prioridades = verTudo ? d.prioridades : d.prioridades.slice(0, 8);
  const c = d.cartoes;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink sm:text-[28px]">
            {saudacao()}, {primeiroNome}
          </h1>
          <p className="mt-1 text-sm text-muted">
            O que precisa da sua atenção hoje no escritório · {formatarData(hoje)}
          </p>
        </div>
        <Link
          href="/processos/novo"
          className="inline-flex h-11 items-center rounded-lg bg-bordeaux px-4 text-sm font-medium text-white hover:bg-bordeaux-hover focus-ring"
        >
          Criar processo rápido
        </Link>
      </header>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Processos ativos" value={c.ativos} icon={FolderOpen} href={INDICADORES.ativos.href} descricao={INDICADORES.ativos.definicao} />
        <StatCard label="Prazos hoje" value={c.prazos_hoje} icon={CalendarClock} tone={c.prazos_hoje > 0 ? "warning" : "default"} href={INDICADORES.prazos_hoje.href} descricao={INDICADORES.prazos_hoje.definicao} />
        <StatCard label="Prazos vencidos" value={c.prazos_vencidos} icon={AlertTriangle} tone={c.prazos_vencidos > 0 ? "danger" : "success"} href={INDICADORES.prazos_vencidos.href} descricao={INDICADORES.prazos_vencidos.definicao} />
        <StatCard label="Documentos em falta" value={c.documentos_em_falta} icon={FileWarning} tone={c.documentos_em_falta > 0 ? "warning" : "default"} href={INDICADORES.documentos_em_falta.href} descricao={INDICADORES.documentos_em_falta.definicao} />
        <StatCard label="Processos parados" value={c.parados} icon={PauseCircle} tone={c.parados > 0 ? "warning" : "default"} href={INDICADORES.parados.href} descricao={INDICADORES.parados.definicao} />
        <StatCard label="Pagamentos pendentes" value={c.pagamentos} icon={Euro} tone={c.pagamentos > 0 ? "danger" : "success"} href={INDICADORES.pagamentos.href} descricao={INDICADORES.pagamentos.definicao} />
        <StatCard label="Tarefas atribuídas a mim" value={c.tarefas_minhas} icon={CheckSquare} href={INDICADORES.tarefas_minhas.href} descricao={INDICADORES.tarefas_minhas.definicao} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section aria-labelledby="t-prioridades" className="rounded-2xl border border-border bg-surface shadow-card lg:col-span-3">
          <div className="flex items-center justify-between gap-3 p-5 pb-3">
            <h2 id="t-prioridades" className="text-base font-semibold text-ink">Prioridades de hoje</h2>
            <Link href="/tarefas" className="rounded text-sm font-medium text-bordeaux hover:underline focus-ring">
              Ver tarefas
            </Link>
          </div>
          <div className="px-5 pb-5">
            {prioridades.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
                Não há prazos, tarefas nem ações urgentes para hoje.
              </p>
            ) : (
              <ul className="space-y-2">
                {prioridades.map((p) => (
                  <li key={p.chave}>
                    <Link
                      href={p.href}
                      className={cn(
                        "flex items-start justify-between gap-3 rounded-xl border p-3 transition-colors hover:border-bordeaux/40 focus-ring",
                        p.urgente ? "border-red-200 bg-red-50/50" : "border-border bg-surface",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">{p.acao}</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {p.processo} · {p.responsavel}
                        </span>
                        <span className={cn("mt-0.5 block text-xs font-medium", p.urgente ? "text-red-800" : "text-ink/75")}>
                          {p.motivo}
                        </span>
                      </span>
                      <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium", ETIQUETA_TIPO[p.tipo].classe)}>
                        {ETIQUETA_TIPO[p.tipo].texto}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {!verTudo && d.prioridades.length > prioridades.length && (
              <Link href="/dashboard?tudo=1" className="mt-3 inline-block rounded text-sm font-medium text-bordeaux hover:underline focus-ring">
                Ver todas as {d.prioridades.length} prioridades
              </Link>
            )}
          </div>
        </section>

        <section aria-labelledby="t-parados" className="rounded-2xl border border-border bg-surface shadow-card lg:col-span-2">
          <h2 id="t-parados" className="p-5 pb-3 text-base font-semibold text-ink">Processos parados — porquê?</h2>
          <div className="space-y-2 px-5 pb-5">
            {d.parados.map((g) => (
              <details key={g.motivo} open={g.processos.length > 0 && g.processos.length <= 4} className="rounded-xl border border-border">
                <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink focus-ring">
                  {g.rotulo}
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", g.processos.length ? "bg-bordeaux/10 text-bordeaux" : "bg-background text-muted")}>
                    {g.processos.length}
                  </span>
                </summary>
                {g.processos.length > 0 && (
                  <ul className="space-y-1 px-2 pb-2">
                    {g.processos.map((p) => (
                      <li key={p.id}>
                        <Link href={p.href} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm text-ink/85 hover:bg-bordeaux/[0.05] hover:text-bordeaux focus-ring">
                          <span className="min-w-0">
                            <span className="block truncate">{p.titulo}</span>
                            <span className="block truncate text-xs text-muted">{p.detalhe.split(" · ").slice(1).join(" · ")}</span>
                          </span>
                          <ArrowRight aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
