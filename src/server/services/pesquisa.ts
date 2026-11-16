import { withTenant } from "../db";
import type { Estado } from "../domain/estados";
import type { Ctx } from "./comum";

export interface ResultadoPesquisa {
  processos: { id: string; reference: string; title: string; client_name: string; state: Estado }[];
  emails: { id: string; subject: string; from: string }[];
}

/** Pesquisa restrita ao escritório (RLS). */
export async function pesquisar(ctx: Ctx, termo: string): Promise<ResultadoPesquisa> {
  const t = termo.trim().toLowerCase().slice(0, 100);
  if (t.length < 2) return { processos: [], emails: [] };
  const q = `%${t.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  return withTenant(ctx, async (tx) => ({
    processos: await tx<ResultadoPesquisa["processos"]>`
      select m.id, m.reference, m.title, c.name as client_name, m.state
      from matters m join clients c on c.id = m.client_id
      where lower(m.reference) like ${q} or lower(m.title) like ${q}
         or lower(c.name) like ${q} or lower(coalesce(c.email, '')) like ${q}
      order by m.updated_at desc limit 8`,
    emails: await tx<ResultadoPesquisa["emails"]>`
      select id, subject, coalesce(from_name, from_email, '') as from
      from inbox_messages
      where archived_at is null
        and (lower(subject) like ${q} or lower(coalesce(from_name, '')) like ${q}
             or lower(coalesce(from_email, '')) like ${q})
      order by received_at desc limit 5`,
  }));
}
