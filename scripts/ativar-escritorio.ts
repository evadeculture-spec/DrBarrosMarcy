/**
 * Ativa um novo escritório só por configuração:
 *
 *   npm run escritorio:ativar -- config/escritorios/exemplo.json
 *
 * A palavra-passe inicial do administrador vem de ESCRITORIO_ADMIN_PASSWORD
 * ou é gerada e mostrada uma única vez.
 */
import { readFileSync } from "node:fs";
import { adminDb, closeDb } from "../src/server/db";
import { gerarPalavraPasse } from "../src/server/services/configuracao";
import { ativarEscritorio } from "../src/server/services/escritorios";

async function main() {
  const ficheiro = process.argv[2];
  if (!ficheiro) throw new Error("Indique o ficheiro de configuração do escritório.");
  const config = JSON.parse(readFileSync(ficheiro, "utf8"));
  const palavraPasse = process.env.ESCRITORIO_ADMIN_PASSWORD || gerarPalavraPasse();
  const r = await ativarEscritorio(adminDb(), config, palavraPasse);
  console.log(`Escritório «${config.nome}» ativado (${config.slug}).`);
  console.log(`Administrador: ${config.administrador.email}`);
  if (!process.env.ESCRITORIO_ADMIN_PASSWORD) {
    console.log(`Palavra-passe inicial (mostrada só agora): ${palavraPasse}`);
  }
  console.log(`id: ${r.orgId}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(closeDb);
