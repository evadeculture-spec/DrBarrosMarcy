import { defineConfig } from "vitest/config";
import path from "node:path";

// Base de dados de testes: variáveis de ambiente ou .env.test.local (não versionado).
try {
  process.loadEnvFile(".env.test.local");
} catch {
  /* sem ficheiro: usa o ambiente (ex.: CI) */
}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    globalSetup: ["test/preparar-bd.ts"],
    setupFiles: ["test/fechar.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
