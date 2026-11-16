import { exigirSessao } from "@/server/sessao";
import { withTenant } from "@/server/db";
import { dadosEscritorio, listasDocumentais } from "@/server/services/configuracao";
import { pode, type Papel } from "@/server/domain/papeis";
import { Configuracoes } from "./Configuracoes";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const s = await exigirSessao();
  const admin = pode(s.ctx.papel, "gerir_escritorio");
  const [listas, escritorio, utilizadores] = await Promise.all([
    listasDocumentais(s.ctx),
    dadosEscritorio(s.ctx),
    withTenant(s.ctx, (tx) => tx<{ id: string; name: string; email: string; role: Papel; active: boolean }[]>`
      select id, name, email, role, active from users order by active desc, name`),
  ]);
  return (
    <Configuracoes
      admin={admin}
      eu={s.utilizador.id}
      escritorio={escritorio}
      listas={listas}
      utilizadores={[...utilizadores]}
      envioModo={process.env.ENVIO_MODO ?? "registo"}
    />
  );
}
