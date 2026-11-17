/**
 * Critério 3 — simular uma falha de envio e reenviar três vezes resulta num
 * único pedido registado (e numa única mensagem saída).
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { Tx } from "../src/server/db";
import type { Remetente } from "../src/server/services/envio";
import {
  aprovarEEnviar,
  prepararPedido,
  simularFalhasEnvio,
  submeterPedido,
} from "../src/server/services/pedidos";
import { obterFicha, transicionar } from "../src/server/services/processos";
import { ler, novoEscritorio, novoProcesso, type Escritorio } from "./ajuda";

let e: Escritorio;
beforeAll(async () => {
  e = await novoEscritorio("c3");
});

async function contagens(orgId: string, matterId: string) {
  return ler(orgId, async (tx: Tx) => {
    const [r] = await tx<{ pedidos: number; saidas: number; tentativas: number; falhas: number }[]>`
      select
        (select count(*) from client_requests where matter_id = ${matterId})::int as pedidos,
        (select count(*) from outbound_messages o join client_requests r on r.id = o.request_id
          where r.matter_id = ${matterId})::int as saidas,
        (select count(*) from send_attempts s join client_requests r on r.id = s.request_id
          where r.matter_id = ${matterId})::int as tentativas,
        (select count(*) from send_attempts s join client_requests r on r.id = s.request_id
          where r.matter_id = ${matterId} and not s.ok)::int as falhas`;
    return r;
  });
}

describe("critério 3: idempotência do envio", () => {
  it("falha + três reenvios = um pedido, uma mensagem", async () => {
    const { id } = await novoProcesso(e);
    await transicionar(e.triagem, id, "em_conferencia");
    const pedido = await prepararPedido(e.triagem, id);
    await submeterPedido(e.triagem, pedido.id);

    await simularFalhasEnvio(e.admin, 1);
    const r1 = await aprovarEEnviar(e.solicitador, pedido.id);
    expect(r1.enviado).toBe(false);
    expect((await obterFicha(e.triagem, id))!.matter.state).toBe("envio_falhado");

    const reenvios = [];
    for (let i = 0; i < 3; i++) reenvios.push(await aprovarEEnviar(e.solicitador, pedido.id));
    expect(reenvios.map((r) => r.enviado)).toEqual([true, true, true]);
    expect(reenvios.map((r) => r.jaEnviado)).toEqual([false, true, true]);

    expect(await contagens(e.orgId, id)).toEqual({ pedidos: 1, saidas: 1, tentativas: 2, falhas: 1 });
    expect((await obterFicha(e.triagem, id))!.matter.state).toBe("a_aguardar_cliente");
  });

  it("reenvios simultâneos também resultam numa única mensagem", async () => {
    const { id } = await novoProcesso(e);
    await transicionar(e.triagem, id, "em_conferencia");
    const pedido = await prepararPedido(e.triagem, id);
    await simularFalhasEnvio(e.admin, 1);
    expect((await aprovarEEnviar(e.solicitador, pedido.id)).enviado).toBe(false);

    let chamadas = 0;
    const lento: Remetente = async () => {
      chamadas++;
      await new Promise((r) => setTimeout(r, 50));
      return { ok: true };
    };
    const resultados = await Promise.all([1, 2, 3].map(() => aprovarEEnviar(e.solicitador, pedido.id, lento)));
    expect(resultados.every((r) => r.enviado)).toBe(true);
    expect(chamadas).toBe(1);
    const c = await contagens(e.orgId, id);
    expect(c.pedidos).toBe(1);
    expect(c.saidas).toBe(1);
  });

  it("voltar a «preparar pedido» reutiliza o pedido em curso", async () => {
    const { id } = await novoProcesso(e);
    await transicionar(e.triagem, id, "em_conferencia");
    const a = await prepararPedido(e.triagem, id);
    const b = await prepararPedido(e.triagem, id);
    expect(b.id).toBe(a.id);
  });

  it("só quem tem papel de aprovação envia", async () => {
    const { id } = await novoProcesso(e);
    await transicionar(e.triagem, id, "em_conferencia");
    const p = await prepararPedido(e.triagem, id);
    await expect(aprovarEEnviar(e.triagem, p.id)).rejects.toThrow(/papel/);
    expect((await contagens(e.orgId, id)).saidas).toBe(0);
  });
});
