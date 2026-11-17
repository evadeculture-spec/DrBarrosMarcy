/**
 * Critério 1 — quem nunca viu o processo diz o que falta e quem age, só
 * com a faixa da ficha. O teste lê apenas o texto da faixa (como uma
 * pessoa faria) e compara com a verdade guardada na base de dados.
 * Também cobre: estados validados no servidor e histórico imutável.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { db, withTenant } from "../src/server/db";
import { formatarData } from "../src/server/domain/datas";
import { aprovarEEnviar, prepararPedido } from "../src/server/services/pedidos";
import { alterarItem, obterFicha, transicionar } from "../src/server/services/processos";
import { novoEscritorio, novoProcesso, type Escritorio } from "./ajuda";

/** Lê a faixa como texto e extrai os três factos. */
function lerFaixa(texto: string) {
  const m = texto.match(/^Falta: (nada|1 documento|(\d+) documentos) · Aguarda: (.+?)(?: desde (\d{2}\/\d{2}\/\d{4}))? · Responsável: (.+)$/);
  if (!m) throw new Error(`Faixa ilegível: ${texto}`);
  const falta = m[1] === "nada" ? 0 : m[1] === "1 documento" ? 1 : Number(m[2]);
  return { falta, aguarda: m[3], desde: m[4] ?? null, responsavel: m[5] };
}

let e: Escritorio;
beforeAll(async () => {
  e = await novoEscritorio("c1");
});

describe("critério 1: a faixa basta", () => {
  it("em conferência: N em falta, age o responsável, desde a entrada no estado", async () => {
    const { id } = await novoProcesso(e);
    await transicionar(e.triagem, id, "em_conferencia");
    const ficha = (await obterFicha(e.triagem, id))!;
    await alterarItem(e.triagem, ficha.itens[0].id, "recebido");

    const f = (await obterFicha(e.triagem, id))!;
    const lido = lerFaixa(f.faixa.texto);
    const verdade = f.itens.filter((i) => i.required && ["em_falta", "rejeitado"].includes(i.status)).length;
    expect(lido.falta).toBe(verdade);
    expect(lido.aguarda).toBe("João Barros");
    expect(lido.responsavel).toBe("João Barros");
    expect(lido.desde).toBe(formatarData(new Date(f.matter.state_since)));
  });

  it("depois de enviado o pedido, a faixa diz que age o cliente", async () => {
    const { id } = await novoProcesso(e, { cliente: "Ana Sofia Lemos", email: "ana@example.pt" });
    await transicionar(e.triagem, id, "em_conferencia");
    const pedido = await prepararPedido(e.triagem, id);
    expect((await aprovarEEnviar(e.solicitador, pedido.id)).enviado).toBe(true);

    const f = (await obterFicha(e.triagem, id))!;
    const lido = lerFaixa(f.faixa.texto);
    expect(lido.aguarda).toBe("Ana Sofia Lemos (cliente)");
    expect(lido.falta).toBe(3);
    expect(f.faixa.proximoPasso).toMatch(/resposta do cliente/);
  });

  it("à espera de aprovação, age um solicitador", async () => {
    const { id } = await novoProcesso(e);
    await transicionar(e.triagem, id, "em_conferencia");
    const pedido = await prepararPedido(e.triagem, id);
    const { submeterPedido } = await import("../src/server/services/pedidos");
    await submeterPedido(e.triagem, pedido.id);
    expect(lerFaixa((await obterFicha(e.triagem, id))!.faixa.texto).aguarda).toBe("aprovação de um solicitador");
  });
});

describe("estados validados no servidor", () => {
  it("recusa saltos não permitidos e não deixa rasto", async () => {
    const { id } = await novoProcesso(e);
    const antes = (await obterFicha(e.triagem, id))!;
    await expect(transicionar(e.triagem, id, "concluido")).rejects.toThrow(/Não é possível/);
    await expect(transicionar(e.triagem, id, "a_aguardar_cliente")).rejects.toThrow();
    const depois = (await obterFicha(e.triagem, id))!;
    expect(depois.matter.state).toBe("por_triar");
    expect(depois.eventos.length).toBe(antes.eventos.length);
  });

  it("só marca completo com tudo conferido; triagem não conclui", async () => {
    const { id } = await novoProcesso(e, { tipo: "procuracao" });
    await transicionar(e.triagem, id, "em_conferencia");
    await expect(transicionar(e.triagem, id, "completo")).rejects.toThrow(/conferidos/);
    const f = (await obterFicha(e.triagem, id))!;
    for (const i of f.itens) await alterarItem(e.triagem, i.id, "conferido");
    await transicionar(e.triagem, id, "completo");
    await expect(transicionar(e.triagem, id, "concluido")).rejects.toThrow(/papel/);
    await transicionar(e.solicitador, id, "concluido");
    await expect(alterarItem(e.triagem, f.itens[0].id, "em_falta")).rejects.toThrow(/Reabra/);
  });

  it("um documento que deixa de estar conferido tira o processo de «Completo»", async () => {
    const { id } = await novoProcesso(e, { tipo: "procuracao" });
    await transicionar(e.triagem, id, "em_conferencia");
    const f = (await obterFicha(e.triagem, id))!;
    for (const i of f.itens) await alterarItem(e.triagem, i.id, "conferido");
    await transicionar(e.triagem, id, "completo");
    await alterarItem(e.triagem, f.itens[1].id, "rejeitado");
    expect((await obterFicha(e.triagem, id))!.matter.state).toBe("em_conferencia");
  });
});

describe("histórico imutável", () => {
  it("regista quem fez o quê e quando", async () => {
    const { id } = await novoProcesso(e);
    await transicionar(e.triagem, id, "em_conferencia");
    const ev = (await obterFicha(e.triagem, id))!.eventos;
    expect(ev.map((x) => x.kind)).toEqual(["estado", "criado"]);
    expect(ev[0].actor_name).toBe("Carolina Folgado");
    expect(ev[0].summary).toBe("Estado: Por triar → Em conferência");
  });

  it("a aplicação não consegue alterar nem apagar eventos", async () => {
    const { id } = await novoProcesso(e);
    await expect(
      withTenant({ orgId: e.orgId }, (tx) => tx`update events set summary = 'x' where matter_id = ${id}`, db()),
    ).rejects.toThrow(/permission denied/);
    await expect(
      withTenant({ orgId: e.orgId }, (tx) => tx`delete from events where matter_id = ${id}`, db()),
    ).rejects.toThrow(/permission denied/);
  });

  it("nem o dono do esquema altera eventos fora de uma purga", async () => {
    const { adminDb } = await import("../src/server/db");
    const { id } = await novoProcesso(e);
    await expect(
      withTenant({ orgId: e.orgId }, (tx) => tx`update events set summary = 'x' where matter_id = ${id}`, adminDb()),
    ).rejects.toThrow(/imutável/);
  });
});
