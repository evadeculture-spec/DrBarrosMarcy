/** Recria a base de dados de testes e aplica as migrações. */
import postgres from "postgres";
import { migrate } from "../src/server/migrate";

export default async function preparar() {
  const url = process.env.DATABASE_ADMIN_URL;
  const papel = process.env.DATABASE_APP_ROLE;
  if (!url || !papel || !process.env.DATABASE_URL) {
    throw new Error(
      "Testes precisam de DATABASE_URL, DATABASE_ADMIN_URL e DATABASE_APP_ROLE (ver .env.example).",
    );
  }
  if (!/test/.test(url)) {
    throw new Error("Por segurança, a base de dados de testes tem de ter «test» no nome.");
  }
  const sql = postgres(url, { onnotice: () => {} });
  try {
    await sql.unsafe(`drop schema if exists public cascade; create schema public;
                      grant usage on schema public to ${papel};`);
    await migrate(sql, papel);
  } finally {
    await sql.end();
  }
}
