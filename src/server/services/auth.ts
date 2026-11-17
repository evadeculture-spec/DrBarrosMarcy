/**
 * Autenticação: palavras-passe com scrypt e sessões guardadas na BD
 * (só o hash do token). Tudo dentro do escritório resolvido pelo endereço.
 */
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db, withTenant, type Tx } from "../db";
import type { Papel } from "../domain/papeis";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
export const SESSAO_DIAS = 14;
export const MIN_PALAVRA_PASSE = 10;

export async function hashPalavraPasse(palavraPasse: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(palavraPasse, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verificarPalavraPasse(
  palavraPasse: string,
  guardado: string,
): Promise<boolean> {
  const partes = guardado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = partes;
  const esperado = Buffer.from(hashB64, "base64");
  const obtido = await scryptAsync(palavraPasse, Buffer.from(saltB64, "base64"), esperado.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return obtido.length === esperado.length && timingSafeEqual(obtido, esperado);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Hash fixo para gastar o mesmo tempo quando o email não existe.
let hashFicticio: Promise<string> | null = null;

export interface Escritorio {
  id: string;
  slug: string;
  name: string;
}

export async function escritorioPorSlug(slug: string): Promise<Escritorio | null> {
  const rows = await db()<Escritorio[]>`select id, slug, name from org_by_slug(${slug})`;
  return rows[0] ?? null;
}

/** Devolve um token de sessão novo, ou null se as credenciais falharem. */
export async function entrar(
  orgId: string,
  email: string,
  palavraPasse: string,
): Promise<string | null> {
  const emailNorm = email.trim().toLowerCase();
  return withTenant({ orgId }, async (tx) => {
    const [u] = await tx<{ id: string; password_hash: string }[]>`
      select id, password_hash from users
      where email = ${emailNorm} and active`;
    if (!u) {
      hashFicticio ??= hashPalavraPasse("ficticio-para-tempo-constante");
      await verificarPalavraPasse(palavraPasse, await hashFicticio);
      return null;
    }
    if (!(await verificarPalavraPasse(palavraPasse, u.password_hash))) return null;
    return criarSessao(tx, orgId, u.id);
  });
}

async function criarSessao(tx: Tx, orgId: string, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await tx`
    insert into sessions (token_hash, organization_id, user_id, expires_at)
    values (${hashToken(token)}, ${orgId}, ${userId},
            now() + make_interval(days => ${SESSAO_DIAS}))`;
  await tx`delete from sessions where user_id = ${userId} and expires_at < now()`;
  return token;
}

/**
 * Entrada sem palavra-passe, SÓ para a instalação de demonstração.
 * Quem chama tem de verificar que o modo demonstração está ativo e que o
 * email pertence à lista fixa de contas de demonstração.
 */
export async function entrarDemonstracao(orgId: string, email: string): Promise<string | null> {
  return withTenant({ orgId }, async (tx) => {
    const [u] = await tx<{ id: string }[]>`
      select id from users where email = ${email.toLowerCase()} and active`;
    return u ? criarSessao(tx, orgId, u.id) : null;
  });
}

export interface Utilizador {
  id: string;
  name: string;
  email: string;
  role: Papel;
}

export async function utilizadorDaSessao(
  orgId: string,
  token: string,
): Promise<Utilizador | null> {
  return withTenant({ orgId }, async (tx) => {
    const [u] = await tx<Utilizador[]>`
      select u.id, u.name, u.email, u.role
      from sessions s join users u on u.id = s.user_id
      where s.token_hash = ${hashToken(token)}
        and s.expires_at > now() and u.active`;
    return u ?? null;
  });
}

export async function sair(orgId: string, token: string): Promise<void> {
  await withTenant({ orgId }, async (tx) => {
    await tx`delete from sessions where token_hash = ${hashToken(token)}`;
  });
}
