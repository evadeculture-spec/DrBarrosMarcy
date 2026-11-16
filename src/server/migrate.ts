import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Sql } from "./db";

const DIR = path.join(process.cwd(), "db", "migrations");

/** Aplica, por ordem, as migrações ainda não aplicadas. */
export async function migrate(sql: Sql, appRole: string): Promise<string[]> {
  if (!/^[a-z_][a-z0-9_]*$/.test(appRole)) {
    throw new Error(`Nome de papel inválido: ${appRole}`);
  }
  await sql`create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set(
    (await sql<{ name: string }[]>`select name from schema_migrations`).map(
      (r) => r.name,
    ),
  );
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const text = (await readFile(path.join(DIR, file), "utf8")).replaceAll(
      "{{APP_ROLE}}",
      appRole,
    );
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    applied.push(file);
  }
  return applied;
}
