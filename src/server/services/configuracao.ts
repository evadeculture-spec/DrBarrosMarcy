/**
 * Configuração do escritório: listas documentais, modelos, utilizadores.
 */
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { withTenant } from "../db";
import { PAPEIS, type FormaTratamento, type Papel } from "../domain/papeis";
import { hashPalavraPasse, MIN_PALAVRA_PASSE } from "./auth";
import { ErroNegocio, exigir, exigirUuid, registarEvento, type Ctx } from "./comum";

// ---------------------------------------------------------------------------
// Listas documentais
// ---------------------------------------------------------------------------

export interface RequisitoConfig {
  id: string;
  label: string;
  required: boolean;
  position: number;
}

export interface TipoConfig {
  id: string;
  key: string;
  name: string;
  requisitos: RequisitoConfig[];
}

export async function listasDocumentais(ctx: Ctx): Promise<TipoConfig[]> {
  return withTenant(ctx, async (tx) => {
    const tipos = await tx<Omit<TipoConfig, "requisitos">[]>`
      select id, key, name from matter_types order by position, name`;
    const reqs = await tx<(RequisitoConfig & { matter_type_id: string })[]>`
      select id, matter_type_id, label, required, position
      from document_requirements order by position, label`;
    return tipos.map((t) => ({
      ...t,
      requisitos: reqs.filter((r) => r.matter_type_id === t.id),
    }));
  });
}

function chaveDe(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50);
  return base || "tipo";
}

export async function adicionarTipo(ctx: Ctx, nome: string) {
  exigir(ctx, "gerir_escritorio");
  const n = nome.trim();
  if (!n || n.length > 120) throw new ErroNegocio("Indique o nome do tipo de processo.");
  await withTenant(ctx, async (tx) => {
    const [{ pos }] = await tx<{ pos: number }[]>`
      select coalesce(max(position), -1) + 1 as pos from matter_types`;
    let chave = chaveDe(n);
    const [existe] = await tx`select 1 from matter_types where key = ${chave}`;
    if (existe) chave = `${chave}_${randomBytes(2).toString("hex")}`;
    await tx`
      insert into matter_types (organization_id, key, name, position)
      values (${ctx.orgId}, ${chave}, ${n}, ${pos})`;
    await registarEvento(tx, ctx, { matterId: null, kind: "configuracao", summary: `Tipo de processo criado: «${n}».` });
  });
}

export async function adicionarRequisito(ctx: Ctx, tipoId: string, label: string, required: boolean) {
  exigir(ctx, "gerir_escritorio");
  exigirUuid(tipoId, "Tipo de processo");
  const n = label.trim();
  if (!n || n.length > 200) throw new ErroNegocio("Indique o nome do documento.");
  return withTenant(ctx, async (tx) => {
    const [t] = await tx<{ name: string }[]>`select name from matter_types where id = ${tipoId}`;
    if (!t) throw new ErroNegocio("Tipo de processo não encontrado.");
    const [{ pos }] = await tx<{ pos: number }[]>`
      select coalesce(max(position), -1) + 1 as pos from document_requirements
      where matter_type_id = ${tipoId}`;
    const [r] = await tx<{ id: string }[]>`
      insert into document_requirements (organization_id, matter_type_id, label, required, position)
      values (${ctx.orgId}, ${tipoId}, ${n}, ${required}, ${pos}) returning id`;
    await registarEvento(tx, ctx, {
      matterId: null, kind: "configuracao",
      summary: `Lista «${t.name}»: acrescentado «${n}».`,
    });
    return r;
  });
}

export interface RequisitoRemovido {
  tipoId: string;
  label: string;
  required: boolean;
  position: number;
}

/** Remove um documento da lista (não mexe nos processos já criados). */
export async function removerRequisito(ctx: Ctx, id: string): Promise<RequisitoRemovido> {
  exigir(ctx, "gerir_escritorio");
  exigirUuid(id, "Documento");
  return withTenant(ctx, async (tx) => {
    const [r] = await tx<{ matter_type_id: string; label: string; required: boolean; position: number }[]>`
      delete from document_requirements where id = ${id}
      returning matter_type_id, label, required, position`;
    if (!r) throw new ErroNegocio("Documento não encontrado.", "nao_encontrado");
    await registarEvento(tx, ctx, {
      matterId: null, kind: "configuracao", summary: `Removido da lista: «${r.label}».`,
    });
    return { tipoId: r.matter_type_id, label: r.label, required: r.required, position: r.position };
  });
}

/** «Anular» de removerRequisito. */
export async function reporRequisito(ctx: Ctx, r: RequisitoRemovido) {
  exigir(ctx, "gerir_escritorio");
  exigirUuid(r.tipoId, "Tipo de processo");
  await withTenant(ctx, async (tx) => {
    await tx`
      insert into document_requirements (organization_id, matter_type_id, label, required, position)
      values (${ctx.orgId}, ${r.tipoId}, ${r.label.slice(0, 200)}, ${Boolean(r.required)}, ${Number(r.position) || 0})`;
    await registarEvento(tx, ctx, {
      matterId: null, kind: "configuracao", summary: `Reposto na lista: «${r.label}».`,
    });
  });
}

export async function alternarObrigatorio(ctx: Ctx, id: string) {
  exigir(ctx, "gerir_escritorio");
  exigirUuid(id, "Documento");
  await withTenant(ctx, async (tx) => {
    const r = await tx`update document_requirements set required = not required where id = ${id} returning id`;
    if (r.length === 0) throw new ErroNegocio("Documento não encontrado.", "nao_encontrado");
  });
}

// ---------------------------------------------------------------------------
// Modelos de mensagem
// ---------------------------------------------------------------------------

export interface Modelo {
  id: string;
  key: string;
  name: string;
  subject: string;
  body: string;
  updated_at: string;
}

export async function listarModelos(ctx: Ctx): Promise<Modelo[]> {
  return withTenant(ctx, (tx) => tx<Modelo[]>`
    select id, key, name, subject, body, updated_at from message_templates order by name`);
}

export async function guardarModelo(ctx: Ctx, id: string, subject: string, body: string) {
  exigir(ctx, "editar_modelos");
  exigirUuid(id, "Modelo");
  if (!subject.trim() || !body.trim()) throw new ErroNegocio("O modelo precisa de assunto e texto.");
  return withTenant(ctx, async (tx) => {
    const [m] = await tx<{ name: string; updated_at: Date }[]>`
      update message_templates set subject = ${subject.slice(0, 300)}, body = ${body.slice(0, 20000)},
             updated_at = now()
      where id = ${id} returning name, updated_at`;
    if (!m) throw new ErroNegocio("Modelo não encontrado.", "nao_encontrado");
    return { guardadoEm: new Date(m.updated_at).toISOString() };
  });
}

// ---------------------------------------------------------------------------
// Utilizadores
// ---------------------------------------------------------------------------

const NovoUtilizadorSchema = z.object({
  nome: z.string().trim().min(1, "Indique o nome.").max(120),
  email: z.string().trim().toLowerCase().email("Email inválido."),
  papel: z.enum(PAPEIS),
});

export function gerarPalavraPasse(): string {
  // 16 caracteres sem ambiguidades (sem 0/O, 1/l/I).
  const alfabeto = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

/** Cria um utilizador e devolve a palavra-passe inicial (mostrada uma vez). */
export async function criarUtilizador(ctx: Ctx, bruto: unknown): Promise<{ palavraPasse: string }> {
  exigir(ctx, "gerir_escritorio");
  const parsed = NovoUtilizadorSchema.safeParse(bruto);
  if (!parsed.success) throw new ErroNegocio(parsed.error.issues[0].message);
  const u = parsed.data;
  const palavraPasse = gerarPalavraPasse();
  const hash = await hashPalavraPasse(palavraPasse);
  await withTenant(ctx, async (tx) => {
    const [existe] = await tx`select 1 from users where email = ${u.email}`;
    if (existe) throw new ErroNegocio("Já existe um utilizador com esse email.");
    await tx`
      insert into users (organization_id, email, name, role, password_hash)
      values (${ctx.orgId}, ${u.email}, ${u.nome}, ${u.papel}, ${hash})`;
    await registarEvento(tx, ctx, {
      matterId: null, kind: "configuracao", summary: `Utilizador criado: ${u.nome} (${u.papel}).`,
    });
  });
  return { palavraPasse };
}

export async function alterarPapel(ctx: Ctx, userId: string, papel: Papel) {
  exigir(ctx, "gerir_escritorio");
  exigirUuid(userId, "Utilizador");
  if (!PAPEIS.includes(papel)) throw new ErroNegocio("Papel desconhecido.");
  if (userId === ctx.userId) throw new ErroNegocio("Não pode alterar o seu próprio papel.");
  await withTenant(ctx, async (tx) => {
    const r = await tx`update users set role = ${papel} where id = ${userId} returning id`;
    if (r.length === 0) throw new ErroNegocio("Utilizador não encontrado.", "nao_encontrado");
  });
}

export async function definirAtivo(ctx: Ctx, userId: string, ativo: boolean) {
  exigir(ctx, "gerir_escritorio");
  exigirUuid(userId, "Utilizador");
  if (userId === ctx.userId) throw new ErroNegocio("Não pode desativar a sua própria conta.");
  await withTenant(ctx, async (tx) => {
    const r = await tx`update users set active = ${ativo} where id = ${userId} returning id`;
    if (r.length === 0) throw new ErroNegocio("Utilizador não encontrado.", "nao_encontrado");
    if (!ativo) await tx`delete from sessions where user_id = ${userId}`;
  });
}

export async function mudarPalavraPasse(ctx: Ctx, atual: string, nova: string) {
  if (nova.length < MIN_PALAVRA_PASSE) {
    throw new ErroNegocio(`A nova palavra-passe tem de ter pelo menos ${MIN_PALAVRA_PASSE} caracteres.`);
  }
  const { verificarPalavraPasse } = await import("./auth");
  const hash = await hashPalavraPasse(nova);
  await withTenant(ctx, async (tx) => {
    const [u] = await tx<{ password_hash: string }[]>`select password_hash from users where id = ${ctx.userId}`;
    if (!u || !(await verificarPalavraPasse(atual, u.password_hash))) {
      throw new ErroNegocio("A palavra-passe atual não está correta.");
    }
    await tx`update users set password_hash = ${hash} where id = ${ctx.userId}`;
  });
}

export async function dadosEscritorio(ctx: Ctx) {
  return withTenant(ctx, async (tx) => {
    const [o] = await tx<{ name: string; slug: string; falhas: number }[]>`
      select name, slug, coalesce((settings->>'falhasEnvioSimuladas')::int, 0) as falhas
      from organizations where id = ${ctx.orgId}`;
    return o;
  });
}

export async function definirFormaTratamento(ctx: Ctx, userId: string, forma: FormaTratamento | null) {
  exigir(ctx, "gerir_escritorio");
  exigirUuid(userId, "Utilizador");
  if (forma !== null && forma !== "masculino" && forma !== "feminino") {
    throw new ErroNegocio("Forma de tratamento desconhecida.");
  }
  await withTenant(ctx, async (tx) => {
    const r = await tx`update users set forma_tratamento = ${forma} where id = ${userId} returning id`;
    if (r.length === 0) throw new ErroNegocio("Utilizador não encontrado.", "nao_encontrado");
  });
}
