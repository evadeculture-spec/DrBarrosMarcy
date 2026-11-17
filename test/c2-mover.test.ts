/**
 * Critério 2 — mover um anexo e anular deixa os dois processos exatamente
 * como estavam (estado, desde quando, itens, anexos). A única diferença
 * permitida é o histórico, que regista o movimento e a anulação.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { Tx } from "../src/server/db";
import { alterarItem, obterFicha, transicionar } from "../src/server/services/processos";
import {
  anularOperacao,
  associarAnexo,
  carregarEmail,
  moverAnexo,
} from "../src/server/services/triagem";
import { ficheiro, ler, novoEscritorio, novoProcesso, type Escritorio } from "./ajuda";

let e: Escritorio;
beforeAll(async () => {
  e = await novoEscritorio("c2");
});

async function fotografia(orgId: string, ids: string[]) {
  return ler(orgId, async (tx: Tx) => ({
    processos: await tx`
      select id, state, state_since::text, updated_at::text, follow_up_on, responsible_id, title
      from matters where id = any(${ids}::uuid[]) order by id`,
    itens: await tx`
      select id, matter_id, label, required, status, updated_at::text
      from matter_items where matter_id = any(${ids}::uuid[]) order by id`,
    anexos: await tx`
      select id, matter_id, item_id, filename, sha256 from attachments
      where matter_id = any(${ids}::uuid[]) order by id`,
  }));
}

async function contarEventos(orgId: string, ids: string[]) {
  return ler(orgId, async (tx: Tx) => {
    const [r] = await tx<{ n: number }[]>`select count(*)::int as n from events where matter_id = any(${ids}::uuid[])`;
    return r.n;
  });
}

describe("critério 2: mover e anular", () => {
  it("repõe exatamente os dois processos, incluindo estados alterados pelo movimento", async () => {
    const a = await novoProcesso(e, { cliente: "Rui Fonseca", tipo: "procuracao" });
    const b = await novoProcesso(e, { cliente: "Sara Gomes", email: "sara@example.pt" });
    await transicionar(e.triagem, a.id, "em_conferencia");
    const fa = (await obterFicha(e.triagem, a.id))!;

    // Processo A completo, com um anexo ligado a um item obrigatório.
    const email = await carregarEmail(e.triagem, {
      remetenteNome: "Rui Fonseca",
      assunto: "Documentos",
      ficheiros: [ficheiro("CC_Rui.pdf")],
    });
    await associarAnexo(e.triagem, email.anexos[0], a.id, fa.itens[0].id);
    for (const i of fa.itens) await alterarItem(e.triagem, i.id, "conferido");
    await transicionar(e.triagem, a.id, "completo");
    const fb = (await obterFicha(e.triagem, b.id))!;

    const antes = await fotografia(e.orgId, [a.id, b.id]);
    const eventosAntes = await contarEventos(e.orgId, [a.id, b.id]);

    const { eventoId } = await moverAnexo(e.triagem, email.anexos[0], b.id, fb.itens[1].id);

    // O movimento produz efeitos reais…
    const meio = await fotografia(e.orgId, [a.id, b.id]);
    expect(meio).not.toEqual(antes);
    expect((await obterFicha(e.triagem, a.id))!.matter.state).toBe("em_conferencia");
    expect((await obterFicha(e.triagem, b.id))!.matter.state).toBe("em_conferencia");
    const histA = (await obterFicha(e.triagem, a.id))!.eventos.find((x) => x.kind === "anexo_movido")!;
    expect(histA.data).toMatchObject({ origem: { id: a.id }, destino: { id: b.id } });
    expect(histA.actor_name).toBe("Carolina Folgado");

    // …e «Anular» repõe tudo.
    await anularOperacao(e.triagem, eventoId);
    expect(await fotografia(e.orgId, [a.id, b.id])).toEqual(antes);

    const eventosDepois = await contarEventos(e.orgId, [a.id, b.id]);
    const kinds = (await obterFicha(e.triagem, a.id))!.eventos.map((x) => x.kind);
    expect(kinds).toContain("anulado");
    expect(eventosDepois).toBeGreaterThan(eventosAntes); // só o histórico cresce
  });

  it("não anula duas vezes nem por cima de alterações posteriores", async () => {
    const a = await novoProcesso(e);
    const b = await novoProcesso(e, { cliente: "Beatriz Carvalho", email: "b@example.pt" });
    const c = await novoProcesso(e, { cliente: "Carla Nogueira", email: "c@example.pt" });
    const email = await carregarEmail(e.triagem, { remetenteNome: "X", ficheiros: [ficheiro("x.pdf")] });
    await associarAnexo(e.triagem, email.anexos[0], a.id, null);

    const op = await moverAnexo(e.triagem, email.anexos[0], b.id, null);
    await anularOperacao(e.triagem, op.eventoId);
    await expect(anularOperacao(e.triagem, op.eventoId)).rejects.toThrow(/já foi anulada/);

    const op2 = await moverAnexo(e.triagem, email.anexos[0], b.id, null);
    await moverAnexo(e.triagem, email.anexos[0], c.id, null);
    await expect(anularOperacao(e.triagem, op2.eventoId)).rejects.toThrow(/já não é possível/);
  });

  it("associar a partir da triagem também se anula e devolve o anexo à caixa", async () => {
    const a = await novoProcesso(e);
    await transicionar(e.triagem, a.id, "em_conferencia");
    const pedidoEnviado = await import("../src/server/services/pedidos");
    const p = await pedidoEnviado.prepararPedido(e.triagem, a.id);
    await pedidoEnviado.aprovarEEnviar(e.solicitador, p.id);
    const antes = await fotografia(e.orgId, [a.id]);

    const email = await carregarEmail(e.triagem, { remetenteNome: "Rui", ficheiros: [ficheiro("cert.pdf")] });
    const fa = (await obterFicha(e.triagem, a.id))!;
    const op = await associarAnexo(e.triagem, email.anexos[0], a.id, fa.itens[0].id);
    expect((await obterFicha(e.triagem, a.id))!.matter.state).toBe("resposta_por_conferir");

    await anularOperacao(e.triagem, op.eventoId);
    expect(await fotografia(e.orgId, [a.id])).toEqual(antes);
    const [anexo] = await ler(e.orgId, (tx: Tx) => tx`select matter_id from attachments where id = ${email.anexos[0]}`);
    expect(anexo.matter_id).toBeNull();
  });
});
