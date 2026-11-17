/**
 * Critério 7 — ativar um segundo escritório não exige alterar código:
 * basta um ficheiro de configuração (o mesmo formato que
 * `npm run escritorio:ativar` usa).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adminDb } from "../src/server/db";
import { entrar, escritorioPorSlug, utilizadorDaSessao } from "../src/server/services/auth";
import { ativarEscritorio } from "../src/server/services/escritorios";
import { listarProcessos, listarTipos } from "../src/server/services/processos";
import { novoEscritorio } from "./ajuda";

describe("critério 7: novo escritório só por configuração", () => {
  it("o ficheiro de exemplo ativa um escritório funcional e isolado", async () => {
    const existente = await novoEscritorio("c7");
    const config = JSON.parse(readFileSync("config/escritorios/exemplo.json", "utf8"));
    config.slug = `exemplo-${Date.now().toString(36)}`;
    config.tiposDeProcesso = [
      { chave: "divorcio", nome: "Divórcio por mútuo consentimento", documentos: [{ nome: "Certidão de casamento", obrigatorio: true }] },
    ];
    const r = await ativarEscritorio(adminDb(), config, "palavra-passe-inicial");

    const org = await escritorioPorSlug(config.slug);
    expect(org?.id).toBe(r.orgId);
    const token = await entrar(r.orgId, config.administrador.email, "palavra-passe-inicial");
    const u = await utilizadorDaSessao(r.orgId, token!);
    expect(u?.role).toBe("administrador");

    const ctx = { orgId: r.orgId, userId: u!.id, papel: u!.role };
    expect((await listarTipos(ctx)).map((t) => t.name)).toEqual(["Divórcio por mútuo consentimento"]);
    expect(await listarProcessos(ctx)).toEqual([]);
    expect((await listarTipos(existente.admin)).some((t) => t.key === "divorcio")).toBe(false);
  });

  it("recusa configurações inválidas", async () => {
    await expect(ativarEscritorio(adminDb(), { slug: "Com Espaços", nome: "x", administrador: { nome: "a", email: "a@b.pt" } }, "palavra-passe-inicial"))
      .rejects.toThrow();
    await expect(ativarEscritorio(adminDb(), { slug: "curta", nome: "x", administrador: { nome: "a", email: "a@b.pt" } }, "123"))
      .rejects.toThrow(/palavra-passe/);
  });
});
