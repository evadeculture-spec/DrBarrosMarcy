/**
 * Ativar um escritório só com configuração (sem alterar código).
 * Usado por `npm run escritorio:ativar` e pelo seed de demonstração.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { withTenant, type Sql } from "../db";
import { hashPalavraPasse, MIN_PALAVRA_PASSE } from "./auth";

const TipoSchema = z.object({
  chave: z.string().regex(/^[a-z0-9_]{1,60}$/),
  nome: z.string().min(1).max(120),
  documentos: z
    .array(z.object({ nome: z.string().min(1).max(200), obrigatorio: z.boolean() }))
    .max(100),
});

const ModeloSchema = z.object({
  chave: z.string().regex(/^[a-z0-9_]{1,60}$/),
  nome: z.string().min(1),
  assunto: z.string(),
  corpo: z.string(),
});

export const ConfigEscritorioSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/, "slug inválido"),
  nome: z.string().min(1).max(200),
  administrador: z.object({
    nome: z.string().min(1).max(120),
    email: z.string().email(),
  }),
  /** Se omitido, usa config/listas-documentais.exemplo.json */
  tiposDeProcesso: z.array(TipoSchema).optional(),
  modelos: z.array(ModeloSchema).optional(),
});

export type ConfigEscritorio = z.infer<typeof ConfigEscritorioSchema>;

export function exemplosPorOmissao(): {
  tiposDeProcesso: z.infer<typeof TipoSchema>[];
  modelos: z.infer<typeof ModeloSchema>[];
} {
  const ficheiro = path.join(process.cwd(), "config", "listas-documentais.exemplo.json");
  const json = JSON.parse(readFileSync(ficheiro, "utf8"));
  return {
    tiposDeProcesso: z.array(TipoSchema).parse(json.tiposDeProcesso),
    modelos: z.array(ModeloSchema).parse(json.modelos),
  };
}

export interface EscritorioAtivado {
  orgId: string;
  adminId: string;
}

/**
 * Cria o escritório, o administrador, os tipos de processo e os modelos.
 * `sql` tem de ser a ligação do dono do esquema (insere em organizations).
 */
export async function ativarEscritorio(
  sql: Sql,
  configBruta: unknown,
  palavraPasseAdmin: string,
): Promise<EscritorioAtivado> {
  const config = ConfigEscritorioSchema.parse(configBruta);
  if (palavraPasseAdmin.length < MIN_PALAVRA_PASSE) {
    throw new Error(`A palavra-passe tem de ter pelo menos ${MIN_PALAVRA_PASSE} caracteres.`);
  }
  const exemplos = exemplosPorOmissao();
  const tipos = config.tiposDeProcesso ?? exemplos.tiposDeProcesso;
  const modelos = config.modelos ?? exemplos.modelos;
  const hash = await hashPalavraPasse(palavraPasseAdmin);

  const [org] = await sql<{ id: string }[]>`
    insert into organizations (slug, name) values (${config.slug}, ${config.nome})
    returning id`;

  const adminId = await withTenant(
    { orgId: org.id },
    async (tx) => {
      const [admin] = await tx<{ id: string }[]>`
        insert into users (organization_id, email, name, role, password_hash)
        values (${org.id}, ${config.administrador.email.toLowerCase()},
                ${config.administrador.nome}, 'administrador', ${hash})
        returning id`;
      for (const [i, t] of tipos.entries()) {
        const [tipo] = await tx<{ id: string }[]>`
          insert into matter_types (organization_id, key, name, position)
          values (${org.id}, ${t.chave}, ${t.nome}, ${i}) returning id`;
        for (const [j, d] of t.documentos.entries()) {
          await tx`
            insert into document_requirements
              (organization_id, matter_type_id, label, required, position)
            values (${org.id}, ${tipo.id}, ${d.nome}, ${d.obrigatorio}, ${j})`;
        }
      }
      for (const m of modelos) {
        await tx`
          insert into message_templates (organization_id, key, name, subject, body)
          values (${org.id}, ${m.chave}, ${m.nome}, ${m.assunto}, ${m.corpo})`;
      }
      await tx`
        insert into events (organization_id, actor_id, kind, summary)
        values (${org.id}, ${admin.id}, 'escritorio', 'Escritório ativado.')`;
      return admin.id;
    },
    sql,
  );

  return { orgId: org.id, adminId };
}
