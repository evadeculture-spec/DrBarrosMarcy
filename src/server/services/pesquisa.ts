import { withTenant } from "../db";
import type { Estado } from "../domain/estados";
import { normalizar, padroesPesquisa } from "./clientes";
import type { Ctx } from "./comum";

export interface ResultadoPesquisa {
  clientes: {
    id: string; reference: string; name: string; city: string | null; nif: string | null;
    email: string | null; processos: number; homonimo: boolean;
  }[];
  processos: { id: string; reference: string; title: string; client_name: string; state: Estado }[];
  emails: { id: string; subject: string; from: string }[];
}

/** Pesquisa restrita ao escritório (RLS), sem acentos nem maiúsculas. */
export async function pesquisar(ctx: Ctx, termo: string): Promise<ResultadoPesquisa> {
  const t = termo.trim().slice(0, 100);
  if (normalizar(t).length < 2) return { clientes: [], processos: [], emails: [] };
  const qs = padroesPesquisa(t);
  return withTenant(ctx, async (tx) => {
    const clientes = await tx<(Omit<ResultadoPesquisa["clientes"][number], "homonimo"> & { iguais: number })[]>`
      select c.id, c.reference, c.name, c.city, c.nif, c.email,
             (select count(*) from matters m where m.client_id = c.id)::int as processos,
             (select count(*) from clients o where sf_normalizar(o.name) = sf_normalizar(c.name))::int as iguais
      from clients c where c.pesquisa like all(${qs}::text[])
      order by c.name, c.reference, c.id limit 20`;
    return {
      clientes: clientes.map(({ iguais, ...c }) => ({ ...c, homonimo: iguais > 1 })),
      processos: await tx<ResultadoPesquisa["processos"]>`
        select m.id, m.reference, m.title, c.name as client_name, m.state
        from matters m join clients c on c.id = m.client_id
        where sf_normalizar(m.reference || ' ' || m.title || ' ' || c.name) like all(${qs}::text[])
        order by m.updated_at desc, m.id limit 10`,
      emails: await tx<ResultadoPesquisa["emails"]>`
        select id, subject, coalesce(from_name, from_email, '') as from
        from inbox_messages
        where archived_at is null
          and sf_normalizar(subject || ' ' || coalesce(from_name, '') || ' ' || coalesce(from_email, '')) like all(${qs}::text[])
        order by received_at desc limit 5`,
    };
  });
}
