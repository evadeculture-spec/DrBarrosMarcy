import Link from "next/link";
import { exigirSessao } from "@/server/sessao";
import { listarTarefas, type FiltroTarefas } from "@/server/services/tarefas";
import { listarUtilizadores } from "@/server/services/processos";
import { diaLisboa } from "@/server/domain/datas";
import { cn } from "@/lib/utils";
import { ListaTarefas } from "./ListaTarefas";

export const metadata = { title: "Tarefas" };

const FILTROS: { id: FiltroTarefas; rotulo: string }[] = [
  { id: "minhas", rotulo: "Atribuídas a mim" },
  { id: "abertas", rotulo: "Todas as abertas" },
  { id: "concluidas", rotulo: "Concluídas" },
];

export default async function TarefasPage({ searchParams }: { searchParams: { filtro?: string } }) {
  const s = await exigirSessao();
  const filtro = (FILTROS.find((f) => f.id === searchParams.filtro)?.id ?? "minhas") as FiltroTarefas;
  const [tarefas, utilizadores] = await Promise.all([listarTarefas(s.ctx, filtro), listarUtilizadores(s.ctx)]);
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-ink">
          Tarefas <span className="font-normal text-muted" data-testid="total">({tarefas.length})</span>
        </h1>
        <p className="mt-1 text-sm text-muted">Atribua, assuma e conclua. A revisão de documentos é criada automaticamente quando chega documentação.</p>
      </header>
      <nav aria-label="Filtro de tarefas" className="flex flex-wrap gap-1">
        {FILTROS.map((f) => (
          <Link
            key={f.id}
            href={`/tarefas?filtro=${f.id}`}
            aria-current={filtro === f.id ? "page" : undefined}
            className={cn("inline-flex h-11 items-center rounded-lg px-4 text-sm focus-ring", filtro === f.id ? "bg-bordeaux text-white" : "bg-surface text-ink hover:bg-background")}
          >
            {f.rotulo}
          </Link>
        ))}
      </nav>
      <ListaTarefas
        tarefas={JSON.parse(JSON.stringify(tarefas))}
        utilizadores={utilizadores.filter((u) => u.active).map(({ id, name }) => ({ id, name }))}
        eu={s.utilizador.id}
        hoje={diaLisboa()}
      />
    </div>
  );
}
