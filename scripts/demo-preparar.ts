/**
 * Prepara o escritório de demonstração com exatamente 250 clientes fictícios.
 *
 *   npm run demo:preparar
 *
 * Restrições: exige DEMO_SEED=1; recusa NODE_ENV=production; só apaga e
 * recria escritórios marcados como demonstração («demo» e «norte»). Repetir
 * o comando mantém a contagem (250) e os identificadores dos clientes.
 */
import { adminDb, closeDb } from "../src/server/db";
import { migrate } from "../src/server/migrate";
import { prepararDemo } from "../src/server/demo";

async function main() {
  if (process.env.DEMO_SEED !== "1") throw new Error("Recusado: defina DEMO_SEED=1 (só em ambientes de demonstração).");
  if (process.env.NODE_ENV === "production") throw new Error("Recusado em NODE_ENV=production.");
  const palavraPasse = process.env.SEED_DEMO_PASSWORD;
  if (!palavraPasse || palavraPasse.length < 10) throw new Error("Defina SEED_DEMO_PASSWORD (mínimo 10 caracteres).");
  const papel = process.env.DATABASE_APP_ROLE;
  if (!papel) throw new Error("Falta DATABASE_APP_ROLE.");
  const sql = adminDb();
  await migrate(sql, papel);
  await prepararDemo(sql, palavraPasse);
  const n = await sql.begin(async (tx) => {
    await tx`select set_config('app.org_id', (select id::text from org_by_slug('demo')), true)`;
    const [r] = await tx<{ n: number }[]>`select count(*)::int as n from clients`;
    return r.n;
  });
  console.log(`Escritório de demonstração pronto: ${n} clientes.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(closeDb);
