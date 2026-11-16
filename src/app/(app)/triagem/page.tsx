import { exigirSessao } from "@/server/sessao";
import { withTenant } from "@/server/db";
import { listarCaixa } from "@/server/services/triagem";
import { listarTipos, listarUtilizadores } from "@/server/services/processos";
import { Triagem, type ProcessoAlvo } from "./Triagem";

export const metadata = { title: "Triagem" };

export default async function TriagemPage({ searchParams }: { searchParams: { arquivados?: string } }) {
  const s = await exigirSessao();
  const arquivados = searchParams.arquivados === "1";
  const [emails, tipos, utilizadores, processos] = await Promise.all([
    listarCaixa(s.ctx, { arquivados }),
    listarTipos(s.ctx),
    listarUtilizadores(s.ctx),
    withTenant(s.ctx, async (tx) => {
      const ms = await tx<{ id: string; reference: string; title: string; state: string }[]>`
        select id, reference, title, state from matters where state <> 'concluido'
        order by year desc, number desc limit 300`;
      const itens = ms.length
        ? await tx<{ id: string; matter_id: string; label: string; status: string }[]>`
            select id, matter_id, label, status from matter_items
            where matter_id = any(${ms.map((m) => m.id)}::uuid[]) order by position`
        : [];
      return ms.map<ProcessoAlvo>((m) => ({
        id: m.id,
        reference: m.reference,
        title: m.title,
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
