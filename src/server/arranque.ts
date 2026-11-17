/**
 * Arranque em alojamentos sem passo de migração próprio (ex.: Netlify
 * Database): com AUTO_MIGRAR=1, a primeira utilização em cada instância
 * garante o papel restrito da aplicação, aplica migrações pendentes e,
 * com DEMO_SEED=1 e a base de dados vazia, cria os dados de demonstração.
 */
import { adminDb } from "./db";
import { migrate } from "./migrate";

let pronto: Promise<void> | null = null;

async function preparar(): Promise<void> {
  const papel = process.env.DATABASE_SET_ROLE;
  if (!papel || !/^[a-z_][a-z0-9_]*$/.test(papel)) {
    throw new Error("AUTO_MIGRAR exige DATABASE_SET_ROLE.");
  }
  const sql = adminDb();
  const [existe] = await sql`select 1 from pg_roles where rolname = ${papel}`;
  if (!existe) {
    await sql.unsafe(`create role ${papel} nologin`).catch(() => undefined);
  }
  await sql.unsafe(`grant ${papel} to current_user with set true, inherit false`).catch(() => undefined);
  await migrate(sql, papel);

  if (process.env.DEMO_SEED === "1") {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from organizations`;
    const palavraPasse = process.env.SEED_DEMO_PASSWORD;
    if (n === 0 && palavraPasse && palavraPasse.length >= 10) {
      const { criarDadosDemo } = await import("./demo");
      await criarDadosDemo(sql, palavraPasse);
    }
  }
}

export function garantirBaseDeDados(): Promise<void> {
  if (process.env.AUTO_MIGRAR !== "1") return Promise.resolve();
  pronto ??= preparar().catch((e) => {
    pronto = null;
    throw e;
  });
  return pronto;
}
