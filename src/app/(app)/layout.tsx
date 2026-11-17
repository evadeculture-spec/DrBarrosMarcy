import { exigirSessao } from "@/server/sessao";
import { withTenant } from "@/server/db";
import { rotuloPapel } from "@/server/domain/papeis";
import { Shell } from "./Shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await exigirSessao();
  const [{ n }] = await withTenant(s.ctx, (tx) => tx<{ n: number }[]>`
    select count(*)::int as n from attachments a
    left join inbox_messages e on e.id = a.inbox_message_id
    where a.matter_id is null and e.archived_at is null`);
  return (
    <Shell
      escritorio={s.escritorio.name}
      utilizador={{ nome: s.utilizador.name, papel: rotuloPapel(s.utilizador.role, s.utilizador.forma_tratamento) }}
      porTriar={n}
    >
      {children}
    </Shell>
  );
}
