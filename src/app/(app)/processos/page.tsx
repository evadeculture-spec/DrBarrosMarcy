import Link from "next/link";
import { exigirSessao } from "@/server/sessao";
import { listarProcessos, listarUtilizadores } from "@/server/services/processos";
import { ESTADOS, ESTADO_ROTULO } from "@/server/domain/estados";
import { calcularFaixa, textoFalta } from "@/server/domain/faixa";
import { diaLisboa, formatarData, haQuantoTempo } from "@/server/domain/datas";
import { EstadoProcesso } from "@/components/EstadoProcesso";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

export const metadata = { title: "Processos" };

export default async function ProcessosPage({
  searchParams,
}: {
  searchParams: { estado?: string; responsavel?: string; q?: string; concluidos?: string };
}) {
  const s = await exigirSessao();
  const filtros = {
    estado: searchParams.estado,
    responsavel: searchParams.responsavel,
    q: searchParams.q,
    incluirConcluidos: searchParams.concluidos === "1",
  };
  const [linhas, utilizadores] = await Promise.all([listarProcessos(s.ctx, filtros), listarUtilizadores(s.ctx)]);
  const hoje = diaLisboa();
  const filtrado = Boolean(searchParams.estado || searchParams.responsavel || searchParams.q || searchParams.concluidos);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Processos</h1>
        <p className="mt-1 text-sm text-muted">Ordenados por quem está à espera há mais tempo.</p>
      </header>

      <form className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1fr_200px_200px_auto]" role="search" aria-label="Filtrar processos">
        <div>
          <Label htmlFor="f-q">Procurar</Label>
          <Input id="f-q" name="q" defaultValue={searchParams.q} placeholder="Referência, título ou cliente" />
        </div>
        <div>
          <Label htmlFor="f-estado">Estado</Label>
          <Select id="f-estado" name="estado" defaultValue={searchParams.estado ?? ""}>
            <option value="">Todos os ativos</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>{ESTADO_ROTULO[e]}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="f-resp">Responsável</Label>
          <Select id="f-resp" name="responsavel" defaultValue={searchParams.responsavel ?? ""}>
            <option value="">Todos</option>
            {utilizadores.filter((u) => u.active).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <label className="mb-2.5 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="concluidos" value="1" defaultChecked={filtros.incluirConcluidos} className="h-4 w-4 accent-bordeaux" />
            Incluir concluídos
          </label>
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit" variant="outline">Filtrar</Button>
          {filtrado && (
            <Link href="/processos" className="inline-flex h-10 items-center px-3 text-sm text-muted hover:text-bordeaux focus-ring rounded-lg">
              Limpar filtros
            </Link>
          )}
        </div>
      </form>

      {linhas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center">
          <p className="text-sm text-ink">{filtrado ? "Nenhum processo corresponde aos filtros." : "Ainda não há processos."}</p>
          {!filtrado && (
            <p className="mt-1 text-sm text-muted">Crie o primeiro com «Novo processo», no topo, ou a partir de um email na Triagem.</p>
          )}
        </div>
      ) : (
        <ul className="space-y-2" aria-label={`${linhas.length} processos`}>
          {linhas.map((p) => {
            const f = calcularFaixa({
              estado: p.state,
              desde: p.state_since,
              responsavel: p.responsible_name,
              cliente: p.client_name,
              itens: [],
            });
            return (
              <li key={p.id}>
                <Link
                  href={`/processos/${p.id}`}
                  className="block rounded-2xl border border-border bg-surface p-4 shadow-card transition-shadow hover:shadow-card-hover focus-ring"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-sm font-semibold text-bordeaux">{p.reference}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{p.title}</span>
                    <EstadoProcesso estado={p.state} />
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    <span className="text-ink">Falta: {textoFalta(p.falta)}</span>
                    {p.total > 0 && <> de {p.total}</>} · Aguarda: <span className="text-ink">{f.aguarda}</span>{" "}
                    {p.state !== "concluido" && <>{haQuantoTempo(p.state_since, hoje)}</>} · {p.responsible_name}
                    {p.follow_up_on && <> · seguimento {formatarData(p.follow_up_on)}</>}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
