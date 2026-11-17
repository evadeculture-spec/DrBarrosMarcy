/**
 * Acesso à base de dados.
 *
 * Toda a leitura e escrita da aplicação passa por `withTenant`, que abre uma
 * transação e define `app.org_id` / `app.user_id`. As políticas RLS da base
 * de dados usam esses valores: sem eles, nenhuma linha é visível.
 */
import postgres from "postgres";

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;

const g = globalThis as unknown as { __sfSql?: Sql; __sfAdminSql?: Sql };

const types = {
  // Datas (sem hora) ficam como texto "AAAA-MM-DD": evita desvios de fuso.
  date: {
    to: 1082,
    from: [1082],
    serialize: (x: string) => x,
    parse: (x: string) => x,
  },
};

function connect(url: string | undefined, name: string): Sql {
  if (!url) {
    throw new Error(
      `Falta a variável de ambiente ${name}. Veja .env.example.`,
    );
  }
  return postgres(url, {
    max: process.env.NETLIFY_DB_URL ? 3 : 10,
    // Poolers em modo transação (ex.: «-pooler» da Neon) não guardam statements preparados.
    prepare: !/-pooler\./.test(url),
    idle_timeout: 20,
    onnotice: () => {},
    types,
  });
}

/** Ligação do papel da aplicação (sujeito a RLS). */
export function db(): Sql {
  if (!g.__sfSql) {
    g.__sfSql = connect(process.env.DATABASE_URL || process.env.NETLIFY_DB_URL, "DATABASE_URL");
  }
  return g.__sfSql;
}

/** Ligação do dono do esquema — só scripts (migrações, seed, ativação). */
export function adminDb(): Sql {
  if (!g.__sfAdminSql) {
    g.__sfAdminSql = connect(
      process.env.DATABASE_ADMIN_URL || process.env.NETLIFY_DB_URL,
      "DATABASE_ADMIN_URL",
    );
  }
  return g.__sfAdminSql;
}

export async function closeDb(): Promise<void> {
  await Promise.all([g.__sfSql?.end(), g.__sfAdminSql?.end()]);
  g.__sfSql = undefined;
  g.__sfAdminSql = undefined;
}

export interface TenantScope {
  orgId: string;
  userId?: string | null;
}

/** Executa `fn` numa transação restrita ao escritório indicado. */
export async function withTenant<T>(
  scope: TenantScope,
  fn: (tx: Tx) => Promise<T>,
  sql: Sql = db(),
): Promise<T> {
  const papel = process.env.DATABASE_SET_ROLE;
  const result = await sql.begin(async (tx) => {
    // Quando a ligação é a do dono (ex.: Netlify Database), cada transação
    // assume o papel restrito da aplicação, sujeito a RLS e sem DELETE no histórico.
    if (papel) {
      if (!/^[a-z_][a-z0-9_]*$/.test(papel)) throw new Error("DATABASE_SET_ROLE inválido.");
      await tx.unsafe(`set local role ${papel}`);
    }
    await tx`select set_config('app.org_id', ${scope.orgId}, true),
                    set_config('app.user_id', ${scope.userId ?? ""}, true)`;
    return fn(tx);
  });
  return result as T;
}
