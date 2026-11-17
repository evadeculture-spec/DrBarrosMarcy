/** Aplica as migrações pendentes: `npm run db:migrar` */
import { adminDb, closeDb } from "../src/server/db";
import { migrate } from "../src/server/migrate";

async function main() {
  const papel = process.env.DATABASE_APP_ROLE;
  if (!papel) throw new Error("Falta DATABASE_APP_ROLE.");
  const aplicadas = await migrate(adminDb(), papel);
  console.log(aplicadas.length ? `Aplicadas: ${aplicadas.join(", ")}` : "Sem migrações pendentes.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(closeDb);
