import { execFileSync } from "node:child_process";

/** Recria os dados de demonstração na base de dados de e2e. */
function preparar() {
  if (!/e2e/.test(process.env.DATABASE_ADMIN_URL ?? "")) {
    throw new Error("A base de dados de e2e tem de ter «e2e» no nome.");
  }
  execFileSync("npx", ["tsx", "scripts/seed.ts"], { stdio: "inherit", env: process.env });
}

preparar();
