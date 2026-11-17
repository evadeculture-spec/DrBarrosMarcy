/**
 * Dados de demonstração, sempre relativos à data de hoje.
 *
 *   npm run db:seed            (apaga e recria a base de dados local!)
 *
 * Recusa correr com NODE_ENV=production.
 */
import { adminDb, closeDb, type Sql } from "../src/server/db";
import { migrate } from "../src/server/migrate";
import { prepararDemo } from "../src/server/demo";

async function reset(sql: Sql, papel: string) {
  await sql.unsafe(`
    drop schema if exists public cascade;
    create schema public;
    grant usage on schema public to ${papel};
  `);
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("O seed não corre em produção.");
  const palavraPasse = process.env.SEED_DEMO_PASSWORD;
  if (!palavraPasse || palavraPasse.length < 10) {
    throw new Error("Defina SEED_DEMO_PASSWORD (mínimo 10 caracteres) em .env.local.");
  }
  const papel = process.env.DATABASE_APP_ROLE;
  if (!papel || !/^[a-z_][a-z0-9_]*$/.test(papel)) throw new Error("Falta DATABASE_APP_ROLE.");
  const sql = adminDb();
  await reset(sql, papel);
  await migrate(sql, papel);
  await prepararDemo(sql, palavraPasse);
  console.log("Dados de demonstração criados (escritórios «demo» e «norte»).");
  console.log("Entrar: http://demo.localhost:3000 — marcia@ / joao@ / carolina@demo.example.pt");
}

if (process.argv[1]?.endsWith("seed.ts")) {
  main()
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    })
    .finally(closeDb);
}
