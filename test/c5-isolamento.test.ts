/**
 * Critério 5 — um utilizador do escritório A não acede a nada do B:
 * por id direto, pesquisa ou ligação de anexo. O isolamento é imposto pela
 * base de dados (RLS + chaves compostas), não por filtros na aplicação.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { db, withTenant } from "../src/server/db";
import { entrar, utilizadorDaSessao } from "../src/server/services/auth";
import { exportarProcesso } from "../src/server/services/exportacao";
import { pesquisar } from "../src/server/services/pesquisa";
import { prepararPedido } from "../src/server/services/pedidos";
import { listarProcessos, obterFicha, transicionar } from "../src/server/services/processos";
import { associarAnexo, carregarEmail, lerAnexo, listarCaixa, moverAnexo } from "../src/server/services/triagem";
import { ficheiro, novoEscritorio, novoProcesso, PALAVRA_PASSE, type Escritorio } from "./ajuda";

let A: Escritorio;
let B: Escritorio;
let processoB: string;
let anexoB: string;

beforeAll(async () => {
  A = await novoEscritorio("a");
  B = await novoEscritorio("b");
  processoB = (await novoProcesso(B, { cliente: "Cliente Secreto do B", email: "secreto@example.pt" })).id;
  const email = await carregarEmail(B.triagem, {
    remetenteNome: "Cliente Secreto do B",
    assunto: "Assunto secreto",
    ficheiros: [ficheiro("secreto.pdf")],
  });
  anexoB = email.anexos[0];
  await associarAnexo(B.triagem, anexoB, processoB, null);
  await novoProcesso(A, { cliente: "Cliente do A", email: "a@example.pt" });
});

describe("critério 5: isolamento entre escritórios", () => {
  it("URL direto do processo e do anexo: não existe para A", async () => {
    expect(await obterFicha(A.admin, processoB)).toBeNull();
    expect(await lerAnexo(A.admin, anexoB)).toBeNull();
    await expect(exportarProcesso(A.admin, processoB)).rejects.toThrow(/não encontrado/);
  });

  it("pesquisa e listagens de A não mostram nada de B", async () => {
    const r = await pesquisar(A.admin, "Secreto");
    expect(r.processos).toEqual([]);
    expect(r.emails).toEqual([]);
    expect((await listarProcessos(A.admin, { q: "secreto" }))).toEqual([]);
    expect((await listarCaixa(A.admin)).some((x) => x.subject.includes("secreto"))).toBe(false);
  });

  it("ações de A sobre ids de B falham sem efeito", async () => {
    await expect(transicionar(A.admin, processoB, "em_conferencia")).rejects.toThrow(/não encontrado/);
    await expect(prepararPedido(A.admin, processoB)).rejects.toThrow(/não encontrado/);
    const meu = await novoProcesso(A, { cliente: "Outro", email: "o@example.pt" });
    await expect(moverAnexo(A.admin, anexoB, meu.id, null)).rejects.toThrow(/não encontrado/);
    const emailA = await carregarEmail(A.triagem, { remetenteNome: "X", ficheiros: [ficheiro("a.pdf")] });
    await expect(associarAnexo(A.triagem, emailA.anexos[0], processoB, null)).rejects.toThrow(/não encontrado/);
    expect((await obterFicha(B.admin, processoB))!.matter.state).toBe("em_conferencia");
  });

  it("mesmo SQL direto com o papel da aplicação não atravessa escritórios", async () => {
    const lidos = await withTenant({ orgId: A.orgId }, (tx) => tx`
      select (select count(*) from matters where id = ${processoB})::int as m,
             (select count(*) from attachment_blobs where attachment_id = ${anexoB})::int as b,
             (select count(*) from organizations where id = ${B.orgId})::int as o`, db());
    expect(lidos[0]).toEqual({ m: 0, b: 0, o: 0 });

    await expect(withTenant({ orgId: A.orgId }, (tx) => tx`
      insert into clients (organization_id, name) values (${B.orgId}, 'intruso')`, db()))
      .rejects.toThrow(/row-level security/);

    const atualizados = await withTenant({ orgId: A.orgId }, (tx) => tx`
      update matters set title = 'alterado por A' where id = ${processoB} returning id`, db());
    expect(atualizados.length).toBe(0);

    // Chaves compostas: A não consegue ligar um registo seu a um cliente de B.
    const [cliB] = await withTenant({ orgId: B.orgId }, (tx) => tx`select client_id from matters where id = ${processoB}`, db());
    await expect(withTenant({ orgId: A.orgId }, async (tx) => {
      const [t] = await tx`select id from matter_types limit 1`;
      await tx`insert into matters (organization_id, year, number, client_id, matter_type_id, title,
                                    state, responsible_id)
               values (${A.orgId}, 2099, 1, ${cliB.client_id}, ${t.id}, 'x', 'por_triar', ${A.admin.userId})`;
    }, db())).rejects.toThrow(/foreign key/);
  });

  it("sem escritório definido não se vê nada", async () => {
    const r = await db()`select count(*)::int as n from matters`;
    expect(r[0].n).toBe(0);
  });

  it("credenciais e sessões de B não servem em A", async () => {
    const emailB = `admin@${B.slug}.example.pt`;
    expect(await entrar(A.orgId, emailB, PALAVRA_PASSE)).toBeNull();
    const tokenB = await entrar(B.orgId, emailB, PALAVRA_PASSE);
    expect(tokenB).toBeTruthy();
    expect(await utilizadorDaSessao(B.orgId, tokenB!)).not.toBeNull();
    expect(await utilizadorDaSessao(A.orgId, tokenB!)).toBeNull();
  });
});
