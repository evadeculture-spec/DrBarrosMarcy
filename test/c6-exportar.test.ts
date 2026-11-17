/**
 * Critério 6 — exportar um processo, apagá-lo e restaurá-lo devolve o mesmo
 * número de anexos com o mesmo conteúdo (comparação por SHA-256).
 */
import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { Tx } from "../src/server/db";
import { aprovarEEnviar, prepararPedido } from "../src/server/services/pedidos";
import { criarPrazo } from "../src/server/services/hoje";
import {
  apagarProcesso,
  exportarEscritorio,
  exportarProcesso,
  restaurarProcesso,
} from "../src/server/services/exportacao";
import { obterFicha, transicionar } from "../src/server/services/processos";
import { carregarNoProcesso } from "../src/server/services/triagem";
import { ler, novoEscritorio, novoProcesso, type Escritorio } from "./ajuda";

let e: Escritorio;
beforeAll(async () => {
  e = await novoEscritorio("c6");
});

async function checksumsReais(orgId: string, matterId: string) {
  return ler(orgId, async (tx: Tx) => {
    const rows = await tx<{ id: string; content: Buffer }[]>`
      select a.id, b.content from attachments a join attachment_blobs b on b.attachment_id = a.id
      where a.matter_id = ${matterId} order by a.id`;
    return rows.map((r) => ({ id: r.id, sha: createHash("sha256").update(r.content).digest("hex") }));
  });
}

describe("critério 6: exportar, apagar, restaurar", () => {
  it("devolve os mesmos anexos com o mesmo conteúdo", async () => {
    const { id } = await novoProcesso(e);
    await transicionar(e.triagem, id, "em_conferencia");
    const f = (await obterFicha(e.triagem, id))!;
    const binario = Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 37) % 256));
    await carregarNoProcesso(e.triagem, id, f.itens[0].id, { filename: "obito.pdf", mimeType: "application/pdf", content: binario });
    await carregarNoProcesso(e.triagem, id, f.itens[1].id, { filename: "cc.png", mimeType: "image/png", content: Buffer.from("png-falso") });
    await carregarNoProcesso(e.triagem, id, null, { filename: "notas.txt", mimeType: "text/plain", content: Buffer.from("olá ção") });
    await criarPrazo(e.triagem, id, "Prazo", "2030-01-01");
    const p = await prepararPedido(e.triagem, id);
    await aprovarEEnviar(e.solicitador, p.id);

    const antes = await checksumsReais(e.orgId, id);
    expect(antes.length).toBe(3);
    const fichaAntes = (await obterFicha(e.triagem, id))!;

    const exportacao = JSON.parse(JSON.stringify(await exportarProcesso(e.admin, id)));
    await expect(apagarProcesso(e.solicitador, id)).rejects.toThrow(/papel/);
    await apagarProcesso(e.admin, id);
    expect(await obterFicha(e.triagem, id)).toBeNull();
    expect(await checksumsReais(e.orgId, id)).toEqual([]);

    const r = await restaurarProcesso(e.admin, exportacao);
    expect(r.anexos).toBe(3);
    const depois = await checksumsReais(e.orgId, id);
    expect(depois).toEqual(antes);

    const fichaDepois = (await obterFicha(e.triagem, id))!;
    expect(fichaDepois.matter.reference).toBe(fichaAntes.matter.reference);
    expect(fichaDepois.matter.state).toBe(fichaAntes.matter.state);
    expect(fichaDepois.itens.map((i) => [i.label, i.status])).toEqual(fichaAntes.itens.map((i) => [i.label, i.status]));
    expect(fichaDepois.prazos.length).toBe(1);
    expect(fichaDepois.pedidos.length).toBe(1);
    expect(fichaDepois.eventos.length).toBe(fichaAntes.eventos.length + 1);
  });

  it("recusa um anexo adulterado sem escrever nada", async () => {
    const { id } = await novoProcesso(e, { cliente: "Adulterado", email: "ad@example.pt" });
    await carregarNoProcesso(e.triagem, id, null, { filename: "a.pdf", mimeType: "application/pdf", content: Buffer.from("original") });
    const exp = JSON.parse(JSON.stringify(await exportarProcesso(e.admin, id)));
    await apagarProcesso(e.admin, id);
    exp.anexos[0].conteudo_base64 = Buffer.from("alterado").toString("base64");
    await expect(restaurarProcesso(e.admin, exp)).rejects.toThrow(/corrompido/);
    expect(await obterFicha(e.triagem, id)).toBeNull();
  });

  it("recusa restaurar num escritório diferente", async () => {
    const outro = await novoEscritorio("c6b");
    const { id } = await novoProcesso(e, { cliente: "Z", email: "z@example.pt" });
    const exp = JSON.parse(JSON.stringify(await exportarProcesso(e.admin, id)));
    await expect(restaurarProcesso(outro.admin, exp)).rejects.toThrow(/outro escritório/);
  });

  it("exporta todos os dados do escritório, sem palavras-passe", async () => {
    const tudo = await exportarEscritorio(e.admin);
    expect(tudo.processos.length).toBeGreaterThan(0);
    expect(tudo.anexos.every((a) => typeof a.conteudo_base64 === "string")).toBe(true);
    expect(JSON.stringify(tudo)).not.toContain("scrypt$");
    await expect(exportarEscritorio(e.triagem)).rejects.toThrow(/papel/);
  });
});
