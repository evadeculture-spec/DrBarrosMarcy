import { exigirSessao } from "@/server/sessao";
import { listarModelos, listasDocumentais } from "@/server/services/configuracao";
import { pode } from "@/server/domain/papeis";
import { VARIAVEIS_MODELO } from "@/server/domain/modelos";
import { EditorModelo } from "../modelos/EditorModelo";
import { ListasDocumentais } from "../configuracoes/Configuracoes";

export const metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const s = await exigirSessao();
  const [modelos, listas] = await Promise.all([listarModelos(s.ctx), listasDocumentais(s.ctx)]);
  const editarTexto = pode(s.ctx.papel, "editar_modelos");
  const editarListas = pode(s.ctx.papel, "gerir_escritorio");
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Templates</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Textos de pedido ao cliente e listas documentais por tipo de processo. As alterações aplicam-se a pedidos e
          processos novos; os processos já criados mantêm a lista e o histórico que tinham.
        </p>
      </header>

      <section aria-labelledby="t-textos" className="space-y-4">
        <h2 id="t-textos" className="text-lg font-semibold text-ink">Textos de pedido</h2>
        <p className="text-sm text-muted">
          Variáveis:{" "}
          {VARIAVEIS_MODELO.map((v) => (
            <code key={v} className="mr-1 rounded bg-surface px-1 py-0.5 text-xs text-ink">[{v}]</code>
          ))}
          {!editarTexto && " · Só solicitadores e administradores podem editar."}
        </p>
        {modelos.map((m) => (
          <EditorModelo key={m.id} modelo={JSON.parse(JSON.stringify(m))} editavel={editarTexto} />
        ))}
      </section>

      <ListasDocumentais listas={listas} admin={editarListas} />
    </div>
  );
}
