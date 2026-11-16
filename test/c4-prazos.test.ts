/**
 * Critério 4 — um prazo por confirmar não gera alertas nem entra nos
 * contadores de prazos; depois de confirmado por um solicitador, entra.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { diaLisboa, somarDias } from "../src/server/domain/datas";
import { confirmarPrazo, criarPrazo, vistaHoje } from "../src/server/services/hoje";
import { definirSeguimento, transicionar } from "../src/server/services/processos";
import { novoEscritorio, novoProcesso, type Escritorio } from "./ajuda";

let e: Escritorio;
beforeAll(async () => {
  e = await novoEscritorio("c4");
});

describe("critério 4: prazos por confirmar", () => {
  it("não alertam nem contam até serem confirmados", async () => {
    const hoje = diaLisboa();
    const { id } = await novoProcesso(e);
    const vencido = await criarPrazo(e.triagem, id, "Prazo dito ao telefone", somarDias(hoje, -3));
    const amanha = await criarPrazo(e.triagem, id, "Entrega amanhã", somarDias(hoje, 1));

    let v = await vistaHoje(e.triagem, hoje);
    expect(v.contadores.prazos).toBe(0);
    expect(v.contadores.prazosVencidos).toBe(0);
    expect(v.prazos).toEqual([]);
    expect(v.prazosPorConfirmar.map((p) => p.id).sort()).toEqual([vencido.id, amanha.id].sort());
    expect(v.prazosPorConfirmar.every((p) => p.alerta === null)).toBe(true);

    await expect(confirmarPrazo(e.triagem, vencido.id)).rejects.toThrow(/papel/);
    await confirmarPrazo(e.solicitador, vencido.id);
    await confirmarPrazo(e.solicitador, amanha.id);

    v = await vistaHoje(e.triagem, hoje);
    expect(v.contadores.prazos).toBe(2);
    expect(v.contadores.prazosVencidos).toBe(1);
    expect(v.prazos.find((p) => p.id === vencido.id)?.alerta).toBe("vencido");
    expect(v.prazosPorConfirmar).toEqual([]);
  });

  it("o seguimento é editável por todos e nunca conta como prazo", async () => {
    const hoje = diaLisboa();
    const { id } = await novoProcesso(e, { cliente: "Seguimento Teste", email: "s@example.pt" });
    await transicionar(e.triagem, id, "em_conferencia");
    await definirSeguimento(e.triagem, id, somarDias(hoje, -2));
    const v = await vistaHoje(e.triagem, hoje);
    const linha = v.acoes.find((a) => a.href === `/processos/${id}`);
    expect(linha?.atrasada).toBe(true);
    const prazosDoProcesso = [...v.prazos, ...v.prazosPorConfirmar].filter((p) => p.href.includes(id));
    expect(prazosDoProcesso).toEqual([]);
  });
});
