/**
 * Provas de aceitação do MVP de um escritório com 250 clientes, contra o
 * escritório de demonstração preparado por `prepararDemo`.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { adminDb, withTenant, type Tx } from "../src/server/db";
import { prepararDemo, pdfMinimo } from "../src/server/demo";
import type { Ctx } from "../src/server/services/comum";
import { importarCsv, listarClientesPaginado, obterCliente, preVisualizarCsv } from "../src/server/services/clientes";
import { CHAVES_INDICADORES, indicador, resumoIndicadores } from "../src/server/services/indicadores";
import { criarPrazo, confirmarPrazo } from "../src/server/services/hoje";
import { pesquisar } from "../src/server/services/pesquisa";
import { prepararPedido, registarEnvioExterno } from "../src/server/services/pedidos";
import {
  alterarItem,
  atribuirResponsavel,
  criarProcesso,
  definirBloqueio,
  definirValores,
  obterFicha,
} from "../src/server/services/processos";
import { atribuirTarefa, listarTarefas } from "../src/server/services/tarefas";
import { associarAnexo, lerAnexo, listarCaixa, moverAnexo, simularRececao } from "../src/server/services/triagem";

const PP = "palavra-passe-demo";
let joao: Ctx;
let marcia: Ctx;
let paulo: Ctx;

async function ctxDe(slug: string, email: string): Promise<Ctx> {
  const sql = adminDb();
  return sql.begin(async (tx) => {
    const [o] = await tx<{ id: string }[]>`select id from org_by_slug(${slug})`;
    await tx`select set_config('app.org_id', ${o.id}, true)`;
    const [u] = await tx<{ id: string; role: Ctx["papel"] }[]>`select id, role from users where email = ${email}`;
    return { orgId: o.id, userId: u.id, papel: u.role };
  }) as Promise<Ctx>;
}

async function contarClientes(orgId: string) {
  return withTenant({ orgId }, async (tx: Tx) => (await tx<{ n: number }[]>`select count(*)::int as n from clients`)[0].n, adminDb());
}

beforeAll(async () => {
  await prepararDemo(adminDb(), PP);
  joao = await ctxDe("demo", "joao@demo.example.pt");
  marcia = await ctxDe("demo", "marcia@demo.example.pt");
  paulo = await ctxDe("norte", "paulo@norte.example.pt");
}, 60_000);

describe("preparar a demonstração", () => {
  it("duas vezes seguidas: exatamente 250 clientes, mesmos identificadores", async () => {
    const antes = await listarClientesPaginado(joao, { q: "CLI-0001" });
    await prepararDemo(adminDb(), PP);
    joao = await ctxDe("demo", "joao@demo.example.pt");
    marcia = await ctxDe("demo", "marcia@demo.example.pt");
    paulo = await ctxDe("norte", "paulo@norte.example.pt");
    expect(await contarClientes(joao.orgId)).toBe(250);
    const depois = await listarClientesPaginado(joao, { q: "CLI-0001" });
    expect(depois.linhas[0].id).toBe(antes.linhas[0].id);
  }, 60_000);

  it("recusa apagar um escritório que não é de demonstração", async () => {
    const sql = adminDb();
    await sql`update organizations set settings = settings - 'demo' where slug = 'norte'`;
    await expect(prepararDemo(sql, PP)).rejects.toThrow(/não é de demonstração/);
    await sql`update organizations set settings = settings || '{"demo": true}' where slug = 'norte'`;
  });
});

describe("pesquisa e ficha do cliente", () => {
  it("encontra «Inês Faria» com e sem acentos e distingue homónimos", async () => {
    for (const q of ["ines", "Inês", "INES FARIA", "faria"]) {
      const r = await listarClientesPaginado(joao, { q });
      const ines = r.linhas.filter((l) => l.name === "Inês Faria");
      expect(ines.length, q).toBe(2);
      expect(new Set(ines.map((l) => l.reference)).size).toBe(2);
      expect(new Set(ines.map((l) => l.city)).size).toBe(2);
    }
    const g = await pesquisar(joao, "ines faria");
    expect(g.clientes.filter((c) => c.name === "Inês Faria").every((c) => c.homonimo)).toBe(true);
  });

  it("paginação estável: 25 por página, sem repetições entre páginas", async () => {
    const vistos = new Set<string>();
    const p1 = await listarClientesPaginado(joao, { pagina: 1 });
    expect(p1.total).toBe(250);
    expect(p1.paginas).toBe(10);
    for (let p = 1; p <= p1.paginas; p++) {
      const r = await listarClientesPaginado(joao, { pagina: p });
      r.linhas.forEach((l) => vistos.add(l.id));
    }
    expect(vistos.size).toBe(250);
  });

  it("zero resultados é claro e não falha", async () => {
    const r = await listarClientesPaginado(joao, { q: "zzzz inexistente" });
    expect(r.total).toBe(0);
    expect(r.linhas).toEqual([]);
  });

  it("a ficha mostra contactos, processos e próxima ação", async () => {
    const [ines] = (await listarClientesPaginado(joao, { q: "ines faria castelo" })).linhas;
    const f = (await obterCliente(joao, ines.id))!;
    expect(f.cliente.email).toBe("ines.faria@example.pt");
    expect(f.processos.length).toBeGreaterThan(0);
    expect(f.proximaAcao?.texto).toBeTruthy();
  });
});

describe("cartões do dashboard", () => {
  it("cada contador é igual ao comprimento da sua lista, antes e depois de alterações", async () => {
    const verificar = async (ctx: Ctx) => {
      const r = await resumoIndicadores(ctx);
      for (const k of CHAVES_INDICADORES) {
        const l = await indicador(ctx, k);
        expect(l.total, k).toBe(r[k].total);
        expect(l.linhas.length, k).toBe(l.total);
      }
      return r;
    };
    const antes = await verificar(marcia);

    // Prazo confirmado para hoje entra em «Prazos hoje»; por confirmar não.
    const [algum] = (await indicador(marcia, "ativos")).linhas;
    const { diaLisboa } = await import("../src/server/domain/datas");
    const prazo = await criarPrazo(marcia, algum.id, "Prazo de teste", diaLisboa());
    expect((await verificar(marcia)).prazos_hoje.total).toBe(antes.prazos_hoje.total);
    await confirmarPrazo(marcia, prazo.id);
    const depoisPrazo = await verificar(marcia);
    expect(depoisPrazo.prazos_hoje.total).toBe(antes.prazos_hoje.total + 1);

    // Bloqueio explícito entra em «Processos parados».
    const naoParado = (await indicador(marcia, "ativos")).linhas.find(
      (l) => !depoisPrazo.parados.linhas.some((p) => p.id === l.id),
    )!;
    await definirBloqueio(marcia, naoParado.id, { motivo: "aguarda_entidade_externa", nota: "teste", revisao: diaLisboa() });
    expect((await verificar(marcia)).parados.total).toBe(depoisPrazo.parados.total + 1);

    // Pagar a totalidade tira o processo de «Pagamentos pendentes».
    const pendente = (await indicador(marcia, "pagamentos")).linhas[0];
    const antesPag = (await verificar(marcia)).pagamentos.total;
    await definirValores(marcia, pendente.id, 100, 100);
    expect((await verificar(marcia)).pagamentos.total).toBe(antesPag - 1);
  });
});

describe("percurso: novo processo, três anexos, revisão única", () => {
  it("trata os três anexos, corrige o engano e não duplica a revisão ao repetir", async () => {
    const [ines] = (await listarClientesPaginado(marcia, { q: "ines faria castelo" })).linhas;
    const tipos = await withTenant(marcia, (tx) => tx<{ id: string; key: string }[]>`select id, key from matter_types`);
    const { id } = await criarProcesso(marcia, {
      clienteId: ines.id,
      tipoId: tipos.find((t) => t.key === "habilitacao_herdeiros")!.id,
      responsavelId: marcia.userId,
      estadoInicial: "em_conferencia",
    });

    const email = await simularRececao(marcia, id, pdfMinimo);
    expect(email.anexos.length).toBe(3);
    const caixa = (await listarCaixa(marcia)).find((e) => e.id === email.id)!;
    const proprios = caixa.anexos.filter((a) => a.sugestao?.matterId === id);
    const alheio = caixa.anexos.find((a) => a.sugestao && a.sugestao.matterId !== id)!;
    expect(proprios.length).toBe(2);
    expect(alheio).toBeTruthy();

    // Associar os dois do processo (com o documento sugerido) e, por engano, o alheio também.
    for (const a of proprios) await associarAnexo(marcia, a.id, id, a.sugestao!.itemId);
    await associarAnexo(marcia, alheio.id, id, null);
    // Corrigir o engano: mover para o processo certo, com rasto nos dois históricos.
    await moverAnexo(marcia, alheio.id, alheio.sugestao!.matterId, alheio.sugestao!.itemId);
    const f = (await obterFicha(marcia, id))!;
    expect(f.eventos.some((e) => e.kind === "anexo_movido")).toBe(true);
    expect(f.anexos.length).toBe(2);
    expect(f.faixa.falta).toBe(1); // continua a faltar um obrigatório

    const revisoes = async () =>
      (await withTenant(marcia, (tx) => tx`select status from tasks where matter_id = ${id} and kind = 'revisao_documentos'`));
    expect((await revisoes()).map((r) => r.status)).toEqual(["aberta"]);

    // Repetir a receção: continua a haver uma única revisão.
    const email2 = await simularRececao(marcia, id, pdfMinimo);
    const caixa2 = (await listarCaixa(marcia)).find((e) => e.id === email2.id)!;
    const outro = caixa2.anexos.find((a) => a.sugestao?.matterId === id && a.sugestao.itemId);
    if (outro) await associarAnexo(marcia, outro.id, id, outro.sugestao!.itemId);
    expect((await revisoes()).length).toBe(1);

    // Só a validação humana fecha a revisão; uma nova receção reabre a mesma tarefa.
    for (const i of (await obterFicha(marcia, id))!.itens.filter((x) => x.status === "recebido")) {
      await alterarItem(marcia, i.id, "conferido");
    }
    expect((await revisoes()).map((r) => r.status)).toEqual(["concluida"]);
    const emFalta = (await obterFicha(marcia, id))!.itens.find((x) => x.required && x.status === "em_falta")!;
    await alterarItem(marcia, emFalta.id, "recebido");
    expect((await revisoes()).map((r) => r.status)).toEqual(["aberta"]);

    // Um colega assume a revisão e percebe a última decisão.
    const [tarefa] = await listarTarefas(marcia, "abertas", { matterId: id });
    await atribuirTarefa(joao, tarefa.id, joao.userId);
    expect((await listarTarefas(joao, "minhas")).some((t) => t.id === tarefa.id)).toBe(true);
  });

  it("preparar um pedido sem enviar não o dá como enviado; o registo externo sim", async () => {
    const [ines] = (await listarClientesPaginado(marcia, { q: "ines faria castelo" })).linhas;
    const tipos = await withTenant(marcia, (tx) => tx<{ id: string; key: string }[]>`select id, key from matter_types`);
    const { id } = await criarProcesso(marcia, {
      clienteId: ines.id, tipoId: tipos.find((t) => t.key === "procuracao")!.id,
      responsavelId: marcia.userId, estadoInicial: "em_conferencia",
    });
    const p = await prepararPedido(marcia, id);
    let f = (await obterFicha(marcia, id))!;
    expect(f.pedidos[0].status).toBe("rascunho");
    expect(f.matter.state).toBe("em_conferencia");
    expect(f.eventos.some((e) => e.kind === "pedido_enviado")).toBe(false);
    expect(f.eventos.some((e) => e.kind === "pedido_rascunho")).toBe(true);

    await registarEnvioExterno(marcia, p.id, "enviado do email geral");
    await registarEnvioExterno(marcia, p.id, "repetido");
    f = (await obterFicha(marcia, id))!;
    expect(f.pedidos[0].status).toBe("enviado");
    expect(f.matter.state).toBe("a_aguardar_cliente");
    expect(f.eventos.filter((e) => e.kind === "pedido_enviado").length).toBe(1);
  });

  it("transferir para um colega persiste responsável, próxima ação e histórico", async () => {
    const p = (await indicador(marcia, "ativos")).linhas.find((l) => !l.detalhe.endsWith("João Barros"))!;
    await atribuirResponsavel(marcia, p.id, joao.userId);
    const f = (await obterFicha(joao, p.id))!;
    expect(f.matter.responsible_name).toBe("João Barros");
    expect(f.ultimaDecisao?.kind).toBe("responsavel");
    expect(f.faixa.proximoPasso).toBeTruthy();
  });
});

describe("dois escritórios", () => {
  it("o Norte não encontra nem abre clientes, processos ou anexos do Demo", async () => {
    const [ines] = (await listarClientesPaginado(joao, { q: "ines" })).linhas;
    expect(await obterCliente(paulo, ines.id)).toBeNull();
    expect((await listarClientesPaginado(paulo, { q: "ines" })).total).toBe(0);
    expect((await pesquisar(paulo, "ines")).clientes).toEqual([]);
    const [anexo] = await withTenant(joao, (tx) => tx<{ id: string }[]>`select id from attachments limit 1`);
    expect(await lerAnexo(paulo, anexo.id)).toBeNull();
    expect((await resumoIndicadores(paulo)).ativos.total).toBeLessThan(5);
  });
});

describe("importação CSV", () => {
  it("pré-visualiza, valida por linha e não duplica ao repetir o ficheiro", async () => {
    const csv = [
      "nome;email;telefone;nif",
      "Rúben Teste;ruben.teste@example.pt;+351 900 999 001;111111111",
      ";sem.nome@example.pt;;",
      "Inês Faria;ines.faria@example.pt;;",
      "Rúben Teste;ruben.teste@example.pt;;",
    ].join("\n");
    const pre = await preVisualizarCsv(joao, csv);
    expect(pre.linhas.map((l) => l.estado)).toEqual(["novo", "invalido", "duplicado", "duplicado"]);
    expect((await importarCsv(joao, csv)).importados).toBe(1);
    expect((await importarCsv(joao, csv)).importados).toBe(0);
    expect(await contarClientes(joao.orgId)).toBe(251);
  });
});
