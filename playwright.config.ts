import { defineConfig } from "@playwright/test";

// Base de dados própria (.env.e2e.local ou variáveis de ambiente), recriada pelo seed.
try {
  process.loadEnvFile(".env.e2e.local");
} catch {
  /* usa o ambiente */
}

const PORTA = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: `http://demo.localhost:${PORTA}`,
    launchOptions: { args: ["--no-proxy-server"] },
  },
  webServer: {
    // Recria os dados de demonstração (base de dados de e2e) e serve o build.
    command: `npx tsx e2e/preparar.ts && npx next start -p ${PORTA}`,
    url: `http://localhost:${PORTA}/entrar`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: Object.fromEntries(
      Object.entries({ ...process.env, DEFAULT_ORG_SLUG: "demo", ENVIO_MODO: "registo" }).filter(
        (e): e is [string, string] => typeof e[1] === "string",
      ),
    ),
  },
});
