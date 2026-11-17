import Link from "next/link";
import { exigirSessao } from "@/server/sessao";
import { withTenant } from "@/server/db";
import { indicador } from "@/server/services/indicadores";
import { listarCaixa } from "@/server/services/triagem";
import { listarTipos, listarUtilizadores } from "@/server/services/processos";
import { cn } from "@/lib/utils";
import { Triagem, type ProcessoAlvo } from "../triagem/Triagem";
import { EmFalta, type GrupoEmFalta } from "./EmFalta";

export const metadata = { title: "Documentos em falta" };

export default async function DocumentosPage({ searchParams }: { searchParams: { separador?: string; arquivados?: string } }) {
  const s = await exigirSessao();
  const separador = searchParams.separador === "rececao" ? "rececao" : "em_falta";
  const [falta, caixa] = await Promise.all([
    indicador(s.ctx, "documentos_em_falta"),
    listarCaixa(s.ctx),
  ]);
  const porAssociar = caixa.reduce((n, e) => n + e.anexos.filter((a) => !a.matter_id).length, 0);

  const grupos = new Map<string, GrupoEmFalta>();
  for (const l of falta.linhas) {
    const [ref, cliente, responsavel] = l.detalhe.split(" · ");
    if (!grupos.has(l.grupo!)) grupos.set(l.grupo!, { matterId: l.grupo!, reference: ref, cliente, responsavel, itens: [] });
    grupos.get(l.grupo!)!.itens.push({ id: l.id, label: l.titulo, estado: l.etiqueta ?? "Em falta" });
  }

  const separadores = [
    { id: "em_falta", rotulo: `Em falta (${falta.total})`, href: "/documentos" },
    { id: "rececao", rotulo: `Receção (${porAssociar} por associar)`, href: "/documentos?separador=rececao" },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Documentos em falta</h1>
        <p className="mt-1 text-sm text-muted">{falta.definicao}</p>
      </header>
      <nav aria-label="Secções" className="flex flex-wrap gap-1">
        {separadores.map((t) => (
          <Link key={t.id} href={t.href} aria-current={separador === t.id ? "page" : undefined}
            className={cn("inline-flex h-11 items-center rounded-lg px-4 text-sm focus-ring", separador === t.id ? "bg-bordeaux text-white" : "bg-surface text-ink hover:bg-background")}>
            {t.rotulo}
          </Link>
        ))}
      </nav>
      {separador === "em_falta" ? (
        <EmFalta grupos={[...grupos.values()]} total={falta.total} />
      ) : (
        <RececaoServidor arquivados={searchParams.arquivados === "1"} />
      )}
    </div>
  );
}

async function RececaoServidor({ arquivados }: { arquivados: boolean }) {
  const s = await exigirSessao();
  const [emails, tipos, utilizadores, processos] = await Promise.all([
    listarCaixa(s.ctx, { arquivados }),
    listarTipos(s.ctx),
    listarUtilizadores(s.ctx),
    withTenant(s.ctx, async (tx) => {
      const ms = await tx<{ id: string; reference: string; title: string }[]>`
        select id, reference, title from matters where state <> 'concluido'
        order by year desc, number desc limit 400`;
      const itens = ms.length
        ? await tx<{ id: string; matter_id: string; label: string; status: string }[]>`
            select id, matter_id, label, status from matter_items
            where matter_id = any(${ms.map((m) => m.id)}::uuid[]) order by position`
        : [];
      return ms.map<ProcessoAlvo>((m) => ({
        id: m.id, reference: m.reference, title: m.title,
        itens: itens.filter((i) => i.matter_id === m.id).map(({ id, label, status }) => ({ id, label, status })),
      }));
    }),
  ]);
  return (
    <Triagem
      emails={JSON.parse(JSON.stringify(emails))}
      processos={processos}
      tipos={tipos}
      utilizadores={utilizadores.filter((u) => u.active)}
      utilizadorAtual={s.utilizador.id}
      arquivados={arquivados}
    />
  );
}
