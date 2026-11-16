import { exigirSessao } from "@/server/sessao";
import { listarModelos } from "@/server/services/configuracao";
import { pode } from "@/server/domain/papeis";
import { VARIAVEIS_MODELO } from "@/server/domain/modelos";
import { EditorModelo } from "./EditorModelo";

export const metadata = { title: "Modelos" };

export default async function ModelosPage() {
  const s = await exigirSessao();
  const modelos = await listarModelos(s.ctx);
  const editar = pode(s.ctx.papel, "editar_modelos");
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Modelos</h1>
        <p className="mt-1 text-sm text-muted">
          Texto de partida dos pedidos ao cliente. Variáveis disponíveis:{" "}
          {VARIAVEIS_MODELO.map((v) => (
            <code key={v} className="mr-1 rounded bg-surface px-1 py-0.5 text-xs text-ink">[{v}]</code>
          ))}
        </p>
        {!editar && <p className="mt-2 text-sm text-muted">Só solicitadores e administradores podem editar modelos.</p>}
      </header>
      {modelos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted">Sem modelos.</p>
      ) : (
        modelos.map((m) => <EditorModelo key={m.id} modelo={JSON.parse(JSON.stringify(m))} editavel={editar} />)
      )}
    </div>
  );
}
