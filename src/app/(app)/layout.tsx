import { exigirSessao } from "@/server/sessao";
import { withTenant } from "@/server/db";
import { rotuloPapel } from "@/server/domain/papeis";
import { notificacoes } from "@/server/services/dashboard";
import { Shell } from "./Shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await exigirSessao();
  const [notas, [org]] = await Promise.all([
    notificacoes(s.ctx),
    withTenant(s.ctx, (tx) => tx<{ demo: boolean; local: string | null }[]>`
      select coalesce((settings->>'demo')::boolean, false) as demo, settings->>'localidade' as local
      from organizations where id = ${s.ctx.orgId}`),
  ]);
  return (
    <Shell
      escritorio={{
        nome: s.escritorio.name,
        local: [org?.local, org?.demo ? "Demonstração" : null].filter(Boolean).join(" · ") || s.escritorio.slug,
      }}
      utilizador={{
        nome: s.utilizador.name,
        email: s.utilizador.email,
        papel: rotuloPapel(s.utilizador.role, s.utilizador.forma_tratamento),
      }}
      notificacoes={notas.map(({ id, texto, href }) => ({ id, texto, href }))}
    >
      {children}
    </Shell>
  );
}
