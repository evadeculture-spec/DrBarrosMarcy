import { exigirSessao } from "@/server/sessao";
import { EXEMPLO_CSV, COLUNAS_CSV } from "@/server/services/clientes";
import { Importar } from "./Importar";

export const metadata = { title: "Importar" };

export default async function ImportarPage() {
  await exigirSessao();
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Importar clientes (CSV)</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Colunas aceites: {COLUNAS_CSV.join(", ")} (só «nome» é obrigatória), separadas por «;» ou «,». Primeiro vê a
          pré-visualização linha a linha; só depois importa. Linhas com NIF, email ou nome+telefone já existentes são
          ignoradas, por isso repetir o mesmo ficheiro não cria duplicados.
        </p>
      </header>
      <Importar exemplo={EXEMPLO_CSV} />
    </div>
  );
}
