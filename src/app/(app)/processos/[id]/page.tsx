import { notFound } from "next/navigation";
import { exigirSessao } from "@/server/sessao";
import { withTenant } from "@/server/db";
import { listarUtilizadores, obterFicha, SEPARADORES } from "@/server/services/processos";
import { pode } from "@/server/domain/papeis";
import { diaLisboa } from "@/server/domain/datas";
import { Ficha, type DestinoMover } from "./Ficha";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const s = await exigirSessao();
  const f = await obterFicha(s.ctx, params.id);
  return { title: f ? `${f.matter.reference} · ${f.matter.client.name}` : "Processo" };
}

export default async function FichaPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { separador?: string };
}) {
  const s = await exigirSessao();
  const ficha = await obterFicha(s.ctx, params.id);
  if (!ficha) notFound();

  const [utilizadores, destinos, demo] = await Promise.all([
    listarUtilizadores(s.ctx),
    withTenant(s.ctx, async (tx) => {
      const ms = await tx<{ id: string; reference: string; title: string }[]>`
        select id, reference, title from matters
        where id <> ${params.id} and state <> 'concluido'
        order by year desc, number desc limit 300`;
      const itens = ms.length
        ? await tx<{ id: string; matter_id: string; label: string }[]>`
            select id, matter_id, label from matter_items
            where matter_id = any(${ms.map((m) => m.id)}::uuid[]) order by position`
        : [];
      return ms.map<DestinoMover>((m) => ({
        ...m,
        itens: itens.filter((i) => i.matter_id === m.id).map(({ id, label }) => ({ id, label })),
      }));
    }),
    withTenant(s.ctx, async (tx) => {
      const [o] = await tx<{ demo: boolean }[]>`
        select coalesce((settings->>'demo')::boolean, false) as demo from organizations where id = ${s.ctx.orgId}`;
      return Boolean(o?.demo);
    }),
  ]);

  const pedido = searchParams.separador;
  const separador = (SEPARADORES as readonly string[]).includes(pedido ?? "")
    ? pedido!
    : ficha.posicao ?? "documentos";

  return (
    <Ficha
      ficha={JSON.parse(JSON.stringify(ficha))}
      utilizadores={utilizadores.filter((u) => u.active || u.id === ficha.matter.responsible_id)}
      destinos={destinos}
      separadorInicial={separador}
      hoje={diaLisboa()}
      demo={demo}
      permissoes={{
        eu: s.utilizador.id,
        aprovar: pode(s.ctx.papel, "aprovar_pedido"),
        confirmarPrazo: pode(s.ctx.papel, "confirmar_prazo"),
        administrar: pode(s.ctx.papel, "apagar_processo"),
      }}
    />
  );
}
