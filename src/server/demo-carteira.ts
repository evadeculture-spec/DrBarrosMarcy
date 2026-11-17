/**
 * Carteira de demonstração: exatamente 250 clientes fictícios com
 * identificadores estáveis (referência CLI-0001… e UUID derivado do número),
 * homónimos, nomes acentuados, clientes com vários processos e sem processos.
 * Os processos gerados têm tarefas, prazos, bloqueios e pagamentos coerentes.
 * Tudo é determinístico (gerador pseudoaleatório com semente fixa); só as
 * datas dependem do dia da preparação (Europe/Lisbon).
 */
import { createHash } from "node:crypto";
import type { Tx } from "./db";
import type { Estado } from "./domain/estados";

export const TOTAL_CLIENTES = 250;

/** UUID estável a partir de um prefixo e de um número. */
export function uuidEstavel(prefixo: string, n: number): string {
  const h = createHash("sha256").update(`${prefixo}:${n}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function gerador(semente: number) {
  let a = semente >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOMES = [
  "Ana", "António", "Beatriz", "Bruno", "Carla", "Catarina", "Daniel", "Diana", "Eduardo", "Filipa",
  "Francisco", "Gonçalo", "Helena", "Hugo", "Inês", "Joana", "Jorge", "José", "Leonor", "Luís",
  "Mafalda", "Manuel", "Marta", "Miguel", "Mónica", "Nuno", "Patrícia", "Paulo", "Raquel", "Ricardo",
  "Rita", "Rodrigo", "Sandra", "Sérgio", "Sónia", "Tânia", "Tiago", "Vasco", "Vera", "Vítor",
];
const APELIDOS = [
  "Almeida", "Antunes", "Araújo", "Barbosa", "Brás", "Cardoso", "Castro", "Conceição", "Correia", "Cunha",
  "Duarte", "Esteves", "Faria", "Fernandes", "Ferreira", "Figueiredo", "Fonseca", "Gaspar", "Gonçalves", "Henriques",
  "Jesus", "Lopes", "Lourenço", "Machado", "Magalhães", "Marques", "Matos", "Mendes", "Monteiro", "Morais",
  "Neves", "Nunes", "Paiva", "Pereira", "Pinto", "Quintela", "Ribeiro", "Simões", "Sousa", "Valente",
];
const LOCALIDADES = [
  "Castelo Branco", "Covilhã", "Fundão", "Idanha-a-Nova", "Proença-a-Nova", "Sertã",
  "Lisboa", "Porto", "Coimbra", "Guarda",
];

/** NIF fictício: 9 algarismos com dígito de controlo propositadamente inválido. */
export function nifFicticio(n: number): string {
  const base = String(29_000_000 + n * 1_973).padStart(8, "0").slice(0, 8);
  const soma = base.split("").reduce((s, d, i) => s + Number(d) * (9 - i), 0);
  const resto = soma % 11;
  const valido = resto < 2 ? 0 : 11 - resto;
  return base + String((valido + 1) % 10);
}

function emailDe(nome: string, n: number): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim()
    .split(/\s+/);
  return `${limpo[0]}.${limpo[limpo.length - 1]}${n}@example.pt`;
}

export interface ClienteDemo {
  n: number;
  id: string;
  reference: string;
  name: string;
  email: string | null;
  phone: string;
  nif: string | null;
  city: string;
  notes: string | null;
}

/**
 * Lista completa dos 250 clientes. Os primeiros são os do percurso e dos
 * exemplos fixos; os restantes são gerados.
 */
export function clientesDemo(fixos: { nome: string; email: string; cidade?: string; nota?: string }[]): ClienteDemo[] {
  const lista: { nome: string; email: string | null; cidade: string; nota: string | null }[] = [
    { nome: "Inês Faria", email: "ines.faria@example.pt", cidade: "Castelo Branco", nota: "Cliente do percurso de demonstração." },
    { nome: "Inês Faria", email: "ines.faria.lx@example.pt", cidade: "Lisboa", nota: "Homónima — confirmar pela referência ou NIF." },
    ...fixos.map((f) => ({ nome: f.nome, email: f.email, cidade: f.cidade ?? "Castelo Branco", nota: f.nota ?? null })),
    { nome: "José Silva", email: "jose.silva@example.pt", cidade: "Covilhã", nota: null },
    { nome: "José Silva", email: null, cidade: "Porto", nota: "Homónimo; sem email registado." },
  ];
  const usados = new Set(lista.map((l) => l.nome));
  const rnd = gerador(250);
  let i = 0;
  while (lista.length < TOTAL_CLIENTES) {
    const nome = `${NOMES[i % NOMES.length]} ${APELIDOS[(i * 7 + Math.floor(i / NOMES.length)) % APELIDOS.length]}`;
    const composto = usados.has(nome) ? `${nome} ${APELIDOS[(i * 3 + 11) % APELIDOS.length]}` : nome;
    i++;
    if (usados.has(composto)) continue;
    usados.add(composto);
    lista.push({
      nome: composto,
      email: rnd() < 0.85 ? "" : null,
      cidade: LOCALIDADES[Math.floor(rnd() * LOCALIDADES.length)],
      nota: null,
    });
  }
  return lista.map((l, idx) => {
    const n = idx + 1;
    return {
      n,
      id: uuidEstavel("cliente-demo", n),
      reference: `CLI-${String(n).padStart(4, "0")}`,
      name: l.nome,
      email: l.email === "" ? emailDe(l.nome, n) : l.email,
      phone: `+351 900 ${String(100 + Math.floor(n / 1000)).slice(-3)} ${String(n).padStart(3, "0")}`,
      nif: n % 5 === 0 ? null : nifFicticio(n),
      city: l.cidade,
      notes: l.nota,
    };
  });
}

type EstadoItem = "em_falta" | "recebido" | "conferido" | "rejeitado";

interface Contexto {
  orgId: string;
  utilizadores: string[]; // ids
  tipos: { id: string; key: string; name: string; requisitos: { label: string; required: boolean; position: number }[] }[];
  ano: number;
  ha: (dias: number, horas?: number) => Date;
  dia: (offset: number) => string;
  pdf: (texto: string) => Buffer;
  sha256: (b: Buffer) => string;
}

/** Gera processos e restante atividade para os clientes de `alvos`, em bloco. */
export async function gerarAtividade(tx: Tx, ctx: Contexto, alvos: ClienteDemo[], primeiroNumero: number): Promise<number> {
  const rnd = gerador(2026);
  const escolher = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const ESTADOS: [Estado, number][] = [
    ["em_conferencia", 22], ["a_aguardar_cliente", 24], ["resposta_por_conferir", 8], ["completo", 6],
    ["concluido", 26], ["por_triar", 6], ["a_aguardar_aprovacao", 5], ["envio_falhado", 3],
  ];
  const totalPeso = ESTADOS.reduce((s, [, p]) => s + p, 0);
  const sortearEstado = (): Estado => {
    let x = rnd() * totalPeso;
    for (const [e, p] of ESTADOS) {
      if ((x -= p) < 0) return e;
    }
    return "em_conferencia";
  };

  const matters: Record<string, unknown>[] = [];
  const items: Record<string, unknown>[] = [];
  const anexos: Record<string, unknown>[] = [];
  const blobs: Record<string, unknown>[] = [];
  const eventos: Record<string, unknown>[] = [];
  const tarefas: Record<string, unknown>[] = [];
  const prazos: Record<string, unknown>[] = [];
  let numero = primeiroNumero;
  let k = 0;

  for (const cliente of alvos) {
    // Vários processos para alguns clientes.
    const quantos = cliente.n % 17 === 0 ? 3 : cliente.n % 6 === 0 ? 2 : 1;
    for (let q = 0; q < quantos; q++) {
      k++;
      const id = uuidEstavel("processo-demo", numero);
      const tipo = escolher(ctx.tipos);
      const estado = sortearEstado();
      const responsavel = ctx.utilizadores[k % ctx.utilizadores.length];
      const criado = 3 + Math.floor(rnd() * 60);
      const desde = Math.min(criado - 1, Math.floor(rnd() * 20));
      let seguimento: string | null = null;
      if (estado === "a_aguardar_cliente") seguimento = ctx.dia(-3 + Math.floor(rnd() * 14));
      else if (estado !== "concluido" && rnd() < 0.25) seguimento = ctx.dia(Math.floor(rnd() * 10));

      // Estados dos itens coerentes com o estado do processo.
      const estadosItens: EstadoItem[] = tipo.requisitos.map((r, i) => {
        if (estado === "concluido" || estado === "completo") return r.required ? "conferido" : rnd() < 0.5 ? "conferido" : "em_falta";
        if (estado === "por_triar") return "em_falta";
        if (estado === "resposta_por_conferir" && i === 0) return "recebido";
        if (["a_aguardar_cliente", "a_aguardar_aprovacao", "envio_falhado"].includes(estado) && i === tipo.requisitos.length - 1) return "em_falta";
        const x = rnd();
        return x < 0.35 ? "conferido" : x < 0.5 ? "recebido" : x < 0.55 ? "rejeitado" : "em_falta";
      });
      if (["a_aguardar_cliente", "a_aguardar_aprovacao", "envio_falhado"].includes(estado)) {
        // Garante pelo menos um obrigatório em falta (é por isso que se espera pelo cliente).
        const idx = tipo.requisitos.findIndex((r) => r.required);
        if (idx >= 0 && !estadosItens.some((s, i) => tipo.requisitos[i].required && (s === "em_falta" || s === "rejeitado"))) {
          estadosItens[idx] = "em_falta";
        }
      }

      const temValores = rnd() < 0.7;
      const previsto = temValores ? 80 + Math.floor(rnd() * 165) * 5 : null;
      const pago = previsto === null ? 0 : estado === "concluido" ? (rnd() < 0.8 ? previsto : Math.floor(previsto / 2)) : rnd() < 0.4 ? 0 : rnd() < 0.5 ? Math.floor(previsto / 2) : previsto;

      let bloqueio: { motivo: string; nota: string; revisao: string } | null = null;
      if (estado !== "concluido" && rnd() < 0.09) {
        const motivo = escolher(["aguarda_entidade_externa", "aguarda_pagamento", "aguarda_revisao_interna", "aguarda_decisao_cliente"] as const);
        const notas: Record<string, string> = {
          aguarda_entidade_externa: "Pedido pendente na conservatória.",
          aguarda_pagamento: "Provisão de despesas por liquidar.",
          aguarda_revisao_interna: "Minuta a rever por um solicitador.",
          aguarda_decisao_cliente: "Cliente a decidir entre duas opções.",
        };
        bloqueio = { motivo, nota: notas[motivo], revisao: ctx.dia(-2 + Math.floor(rnd() * 12)) };
      }

      matters.push({
        id,
        organization_id: ctx.orgId,
        year: ctx.ano,
        number: numero,
        client_id: cliente.id,
        matter_type_id: tipo.id,
        title: `${tipo.name} — ${cliente.name}`,
        state: estado,
        state_since: ctx.ha(desde, 2),
        responsible_id: responsavel,
        follow_up_on: seguimento,
        created_at: ctx.ha(criado),
        updated_at: ctx.ha(desde, 2),
        valor_previsto: previsto,
        valor_pago: pago,
        bloqueio_motivo: bloqueio?.motivo ?? null,
        bloqueio_nota: bloqueio?.nota ?? null,
        bloqueio_revisao: bloqueio?.revisao ?? null,
      });
      eventos.push({
        organization_id: ctx.orgId, matter_id: id, actor_id: responsavel, kind: "criado",
        summary: `Processo criado (${tipo.name}).`, data: {}, created_at: ctx.ha(criado),
      });
      if (estado !== "por_triar") {
        eventos.push({
          organization_id: ctx.orgId, matter_id: id, actor_id: responsavel, kind: "estado",
          summary: `Estado atual desde a preparação da demonstração.`, data: { para: estado }, created_at: ctx.ha(desde, 2),
        });
      }
      if (bloqueio) {
        eventos.push({
          organization_id: ctx.orgId, matter_id: id, actor_id: responsavel, kind: "bloqueio",
          summary: `Processo parado: ${bloqueio.nota}`, data: {}, created_at: ctx.ha(desde, 1),
        });
      }

      tipo.requisitos.forEach((r, i) => {
        const itemId = uuidEstavel(`item-demo-${numero}`, i);
        const status = estadosItens[i];
        items.push({
          id: itemId, organization_id: ctx.orgId, matter_id: id, label: r.label,
          required: r.required, position: r.position, status,
        });
        if (status !== "em_falta") {
          const conteudo = ctx.pdf(`${r.label} - ${cliente.name} (demonstracao)`);
          const anexoId = uuidEstavel(`anexo-demo-${numero}`, i);
          anexos.push({
            id: anexoId, organization_id: ctx.orgId, matter_id: id, item_id: itemId,
            filename: `${r.label.replace(/[^A-Za-zÀ-ÿ0-9]+/g, "_")}_${cliente.name.replace(/\s+/g, "_")}.pdf`,
            mime_type: "application/pdf", size_bytes: conteudo.length, sha256: ctx.sha256(conteudo),
            created_by: responsavel, created_at: ctx.ha(Math.max(desde, 1)),
          });
          blobs.push({ attachment_id: anexoId, organization_id: ctx.orgId, content: conteudo });
        }
      });

      // Uma tarefa de revisão por processo com documentos recebidos por rever.
      if (estadosItens.includes("recebido") && estado !== "concluido") {
        tarefas.push({
          id: uuidEstavel("revisao-demo", numero), organization_id: ctx.orgId, matter_id: id,
          kind: "revisao_documentos", title: `Rever documentos recebidos (${ctx.ano}/${String(numero).padStart(3, "0")})`,
          assignee_id: responsavel, due_on: ctx.dia(-Math.min(desde, 3)), status: "aberta",
          completed_by: null, completed_at: null, created_at: ctx.ha(desde),
        });
      }
      // Tarefas manuais.
      if (estado !== "concluido" && rnd() < 0.3) {
        const concluida = rnd() < 0.25;
        tarefas.push({
          id: uuidEstavel("tarefa-demo", numero), organization_id: ctx.orgId, matter_id: id, kind: "manual",
          title: escolher(["Telefonar ao cliente a confirmar dados", "Confirmar morada do imóvel", "Pedir certidão online", "Rever minuta", "Agendar assinatura"]),
          assignee_id: ctx.utilizadores[(k + 1) % ctx.utilizadores.length],
          due_on: ctx.dia(-4 + Math.floor(rnd() * 12)),
          status: concluida ? "concluida" : "aberta",
          completed_by: concluida ? responsavel : null,
          completed_at: concluida ? ctx.ha(1) : null,
          created_at: ctx.ha(desde),
        });
      }
      // Prazos: confirmados (alguns vencidos/hoje) e por confirmar.
      if (estado !== "concluido" && rnd() < 0.22) {
        const confirmado = rnd() < 0.75;
        prazos.push({
          organization_id: ctx.orgId, matter_id: id,
          label: escolher(["Entrega na conservatória", "Resposta a notificação", "Assinatura da escritura", "Pagamento de imposto"]),
          due_on: ctx.dia(-5 + Math.floor(rnd() * 25)),
          status: confirmado ? "confirmado" : "por_confirmar",
          created_by: responsavel,
          confirmed_by: confirmado ? responsavel : null,
          confirmed_at: confirmado ? ctx.ha(1) : null,
        });
      }
      numero++;
    }
  }

  const emBlocos = async (tabela: string, linhas: Record<string, unknown>[], tamanho = 200) => {
    for (let i = 0; i < linhas.length; i += tamanho) {
      const bloco = linhas.slice(i, i + tamanho);
      await tx`insert into ${tx(tabela)} ${tx(bloco as never[])}`;
    }
  };
  await emBlocos("matters", matters);
  await emBlocos("matter_items", items);
  await emBlocos("attachments", anexos);
  await emBlocos("attachment_blobs", blobs, 100);
  await emBlocos("tasks", tarefas);
  await emBlocos("deadlines", prazos);
  await emBlocos("events", eventos.map((e) => ({ ...e, data: tx.json(e.data as never) })));
  return matters.length;
}
