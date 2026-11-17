import { describe, expect, it } from "vitest";
import {
  acoesManuais,
  ESTADOS,
  TRANSICOES,
  validarTransicaoManual,
  validarTransicaoSistema,
} from "../src/server/domain/estados";
import { calcularFaixa } from "../src/server/domain/faixa";
import { calcularHoje, linhaProcesso, type ProcessoHoje } from "../src/server/domain/hoje";
import { slugDoHost } from "../src/server/domain/subdominio";
import { preencherModelo } from "../src/server/domain/modelos";
import { diaLisboa, somarDias, formatarData } from "../src/server/domain/datas";
import { rotuloPapel } from "../src/server/domain/papeis";

describe("máquina de estados", () => {
  it("recusa qualquer transição que não esteja na tabela", () => {
    const permitidas = new Set(TRANSICOES.map((t) => `${t.de}>${t.para}`));
    for (const de of ESTADOS) {
      for (const para of ESTADOS) {
        if (permitidas.has(`${de}>${para}`)) continue;
        expect(validarTransicaoManual(de, para, "administrador").ok).toBe(false);
        expect(validarTransicaoSistema(de, para).ok).toBe(false);
      }
    }
  });

  it("transições só de sistema não podem ser pedidas por um utilizador", () => {
    expect(validarTransicaoManual("a_aguardar_aprovacao", "a_aguardar_cliente", "administrador").ok).toBe(false);
    expect(validarTransicaoManual("em_conferencia", "a_aguardar_aprovacao", "solicitador").ok).toBe(false);
    expect(validarTransicaoManual("envio_falhado", "a_aguardar_cliente", "solicitador").ok).toBe(false);
  });

  it("só solicitadores e administradores concluem e reabrem", () => {
    expect(validarTransicaoManual("completo", "concluido", "triagem").ok).toBe(false);
    expect(validarTransicaoManual("completo", "concluido", "solicitador").ok).toBe(true);
    expect(validarTransicaoManual("concluido", "em_conferencia", "triagem").ok).toBe(false);
    expect(validarTransicaoManual("concluido", "em_conferencia", "administrador").ok).toBe(true);
  });

  it("mostra só os botões que o papel pode usar", () => {
    expect(acoesManuais("completo", "triagem")).toEqual([]);
    expect(acoesManuais("completo", "solicitador").map((a) => a.para).sort()).toEqual(["concluido", "em_conferencia"]);
  });
});

describe("faixa da ficha", () => {
  const base = {
    desde: "2026-11-12T10:00:00Z",
    responsavel: "Márcia Raposo",
    cliente: "Rui Fonseca",
    itens: [
      { required: true, status: "conferido" as const },
      { required: true, status: "em_falta" as const },
      { required: true, status: "rejeitado" as const },
      { required: false, status: "em_falta" as const },
    ],
  };

  it("conta só obrigatórios em falta ou rejeitados", () => {
    const f = calcularFaixa({ ...base, estado: "em_conferencia" });
    expect(f.falta).toBe(2);
    expect(f.texto).toBe(
      "Falta: 2 documentos · Aguarda: Márcia Raposo desde 12/11/2026 · Responsável: Márcia Raposo",
    );
  });

  it("diz que é o cliente quem age quando o pedido foi enviado", () => {
    const f = calcularFaixa({ ...base, estado: "a_aguardar_cliente" });
    expect(f.texto).toContain("Aguarda: Rui Fonseca (cliente) desde 12/11/2026");
    expect(f.aguardaTipo).toBe("cliente");
  });

  it("singular e «nada»", () => {
    expect(calcularFaixa({ ...base, estado: "completo", itens: [{ required: true, status: "em_falta" }] }).texto)
      .toMatch(/^Falta: 1 documento ·/);
    expect(calcularFaixa({ ...base, estado: "concluido", itens: [] }).texto)
      .toBe("Falta: nada · Aguarda: ninguém · Responsável: Márcia Raposo");
  });
});

describe("vista Hoje (regras puras)", () => {
  const hoje = "2026-11-16";
  const p = (o: Partial<ProcessoHoje>): ProcessoHoje => ({
    id: "1", reference: "2026/041", estado: "resposta_por_conferir", stateSince: "2026-11-15T09:00:00Z",
    followUpOn: "2026-11-23", responsavelId: "u", responsavelNome: "Márcia Raposo",
    clienteNome: "Rui Fonseca", falta: 1, totalObrigatorios: 3, ...o,
  });

  it("produz a linha no formato combinado", () => {
    expect(linhaProcesso(p({}), hoje)?.texto).toBe(
      "Conferir resposta de Rui Fonseca · 2026/041 · falta 1 de 3 · Márcia · seguimento 23/11",
    );
  });

  it("desaparece quando a bola está no cliente e regressa no seguimento", () => {
    expect(linhaProcesso(p({ estado: "a_aguardar_cliente", followUpOn: "2026-11-20" }), hoje)).toBeNull();
    expect(linhaProcesso(p({ estado: "a_aguardar_cliente", followUpOn: null }), hoje)).toBeNull();
    const noDia = linhaProcesso(p({ estado: "a_aguardar_cliente", followUpOn: hoje }), hoje);
    expect(noDia?.verbo).toBe("Fazer seguimento com");
    expect(noDia?.atrasada).toBe(false);
    expect(linhaProcesso(p({ estado: "a_aguardar_cliente", followUpOn: "2026-11-10" }), hoje)?.atrasada).toBe(true);
  });

  it("processos concluídos nunca aparecem", () => {
    expect(linhaProcesso(p({ estado: "concluido" }), hoje)).toBeNull();
  });

  it("critério 4: prazo por confirmar não gera alerta nem conta", () => {
    const v = calcularHoje({
      hoje,
      processos: [],
      emails: [],
      prazos: [
        { id: "a", matterId: "1", reference: "2026/041", clienteNome: "Rui", label: "Vencido por confirmar", dueOn: "2026-11-01", status: "por_confirmar" },
        { id: "b", matterId: "1", reference: "2026/041", clienteNome: "Rui", label: "Amanhã por confirmar", dueOn: "2026-11-17", status: "por_confirmar" },
        { id: "c", matterId: "1", reference: "2026/041", clienteNome: "Rui", label: "Confirmado amanhã", dueOn: "2026-11-17", status: "confirmado" },
      ],
    });
    expect(v.contadores.prazos).toBe(1);
    expect(v.contadores.prazosVencidos).toBe(0);
    expect(v.prazos.map((x) => x.id)).toEqual(["c"]);
    expect(v.prazos[0].alerta).toBe("proximo");
    expect(v.prazosPorConfirmar.map((x) => x.id)).toEqual(["a", "b"]);
    expect(v.prazosPorConfirmar.every((x) => x.alerta === null)).toBe(true);
  });

  it("seguimento nunca entra no contador de prazos", () => {
    const v = calcularHoje({
      hoje,
      processos: [p({ estado: "a_aguardar_cliente", followUpOn: "2026-11-10" })],
      emails: [],
      prazos: [],
    });
    expect(v.contadores.acoes).toBe(1);
    expect(v.contadores.prazos).toBe(0);
    expect(v.contadores.prazosVencidos).toBe(0);
  });
});

describe("utilitários", () => {
  it("resolve o escritório pelo subdomínio", () => {
    const o = { dominioBase: "solicitaflow.pt", omissao: "demo" };
    expect(slugDoHost("norte.localhost:3000", o)).toBe("norte");
    expect(slugDoHost("norte.solicitaflow.pt", o)).toBe("norte");
    expect(slugDoHost("solicitaflow.pt", o)).toBe("demo");
    expect(slugDoHost("localhost:3000", o)).toBe("demo");
    expect(slugDoHost("app.vercel.app", { omissao: null })).toBeNull();
    expect(slugDoHost("a.b.localhost", o)).toBeNull();
  });

  it("preenche modelos e deixa visível o que falta", () => {
    expect(preencherModelo("Olá [CLIENTE], [X]", { CLIENTE: "Rui" })).toBe("Olá Rui, [X]");
  });

  it("datas em Lisboa", () => {
    expect(diaLisboa(new Date("2026-11-16T23:30:00Z"))).toBe("2026-11-16");
    expect(diaLisboa(new Date("2026-07-16T23:30:00Z"))).toBe("2026-07-17");
    expect(somarDias("2026-12-30", 3)).toBe("2027-01-02");
    expect(formatarData("2026-11-05")).toBe("05/11/2026");
  });
});

describe("rótulo do papel", () => {
  it("usa a forma de tratamento escolhida e é neutro sem ela", () => {
    expect(rotuloPapel("solicitador", "feminino")).toBe("Solicitadora");
    expect(rotuloPapel("administrador", "feminino")).toBe("Administradora");
    expect(rotuloPapel("solicitador", "masculino")).toBe("Solicitador");
    expect(rotuloPapel("solicitador", null)).toBe("Solicitador");
  });
});
