/**
 * Arranque em alojamentos sem passo de migração próprio (ex.: Netlify
 * Database): com AUTO_MIGRAR=1, a primeira utilização em cada instância
 * garante o papel restrito da aplicação, aplica migrações pendentes e,
 * com DEMO_SEED=1 e a base de dados vazia, cria os dados de demonstração.
 *
 * Só em instalações de demonstração (DEMO_SEED=1): mudar DEMO_REINICIAR para
 * um valor novo apaga o esquema e recria a demonstração uma única vez.
 */
import { adminDb, type Sql } from "./db";
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
  if (process.env.DEMO_SEED === "1" && process.env.DEMO_REINICIAR) {
    await reiniciarDemo(sql, papel, process.env.DEMO_REINICIAR);
  }
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

/** Apaga o esquema da demonstração se o marcador DEMO_REINICIAR mudou. */
async function reiniciarDemo(sql: Sql, papel: string, marcador: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('solicitaflow:reiniciar-demo'))`;
    await tx`create schema if not exists sf_meta`;
    await tx`create table if not exists sf_meta.reinicio (marcador text not null)`;
    const [atual] = await tx<{ marcador: string }[]>`select marcador from sf_meta.reinicio limit 1`;
    if (atual?.marcador === marcador) return;
    await tx.unsafe(`drop schema if exists public cascade; create schema public;
                     grant usage on schema public to ${papel};`);
    await tx`delete from sf_meta.reinicio`;
    await tx`insert into sf_meta.reinicio (marcador) values (${marcador})`;
  });
}
