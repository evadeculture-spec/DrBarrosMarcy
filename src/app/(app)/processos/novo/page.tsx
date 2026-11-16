import { exigirSessao } from "@/server/sessao";
import { listarClientes, listarTipos, listarUtilizadores } from "@/server/services/processos";
import { FormNovoProcesso } from "./FormNovoProcesso";

export const metadata = { title: "Novo processo" };

export default async function NovoProcessoPage() {
  const s = await exigirSessao();
  const [clientes, tipos, utilizadores] = await Promise.all([
    listarClientes(s.ctx),
    listarTipos(s.ctx),
    listarUtilizadores(s.ctx),
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-ink">Novo processo</h1>
      <p className="mt-1 text-sm text-muted">
        A lista documental é criada a partir do tipo de processo (configurável em Configurações).
      </p>
      <FormNovoProcesso
        clientes={clientes}
        tipos={tipos}
        utilizadores={utilizadores.filter((u) => u.active)}
        utilizadorAtual={s.utilizador.id}
      />
    </div>
  );
}
