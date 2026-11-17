/**
 * Dados de demonstração, sempre relativos ao dia em que são criados.
 * Nomes, emails e telefones são fictícios; os emails usam o domínio
 * reservado example.pt.
 */
import { withTenant, type Sql, type Tx } from "./db";
import { hashPalavraPasse } from "./services/auth";
import { ativarEscritorio } from "./services/escritorios";
import { sha256 } from "./services/triagem";
import { diaLisboa, somarDias } from "./domain/datas";
import type { Estado } from "./domain/estados";

const DIA = 86_400_000;
let agora = Date.now();
/** Instante há `d` dias (e `h` horas). */
const ha = (d: number, h = 0) => new Date(agora - d * DIA - h * 3_600_000);
let hoje = diaLisboa();
const dia = (offset: number) => somarDias(hoje, offset);

/** PDF mínimo válido com uma linha de texto (para os anexos de exemplo). */
export function pdfMinimo(texto: string): Buffer {
  const t = texto.replace(/[()\\]/g, "");
  const stream = `BT /F1 14 Tf 72 720 Td (${t}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

interface Ctx { orgId: string; userId: string }

async function evento(tx: Tx, c: Ctx, matterId: string | null, quando: Date, actor: string | null, kind: string, summary: string, data: object = {}) {
  await tx`
    insert into events (organization_id, matter_id, actor_id, kind, summary, data, created_at)
    values (${c.orgId}, ${matterId}, ${actor}, ${kind}, ${summary}, ${tx.json(data as never)}, ${quando})`;
}

async function anexo(tx: Tx, c: Ctx, nome: string, opts: { matterId?: string; itemId?: string | null; inboxId?: string; quando: Date; autor: string }) {
  const conteudo = pdfMinimo(`Documento de demonstracao: ${nome}`);
  const [a] = await tx<{ id: string }[]>`
    insert into attachments (organization_id, inbox_message_id, matter_id, item_id, filename,
                             mime_type, size_bytes, sha256, created_by, created_at)
    values (${c.orgId}, ${opts.inboxId ?? null}, ${opts.matterId ?? null}, ${opts.itemId ?? null},
            ${nome}, 'application/pdf', ${conteudo.length}, ${sha256(conteudo)}, ${opts.autor},
            ${opts.quando})
    returning id`;
  await tx`insert into attachment_blobs (attachment_id, organization_id, content)
           values (${a.id}, ${c.orgId}, ${conteudo})`;
  return a.id;
}

type EstadoItem = "em_falta" | "recebido" | "conferido" | "rejeitado";

interface Especificacao {
  numero: number;
  cliente: { nome: string; email: string; telefone: string };
  tipo: string;
  estado: Estado;
  desde: Date;
  criado: number; // dias atrás
  responsavel: string;
  seguimento: number | null; // offset em dias face a hoje
  itens: EstadoItem[]; // pela ordem da lista documental
  historico: [number, string, string, string][]; // [dias atrás, autor, tipo, resumo]
  prazos?: { label: string; offset: number; confirmado: boolean }[];
  pedido?: { status: string; dias: number; tentativas?: number; erro?: string };
  anexoErrado?: { nome: string; item: number };
}

async function criarDemo(sql: Sql, palavraPasse: string) {
  const { orgId, adminId } = await ativarEscritorio(sql, {
    slug: "demo",
    nome: "Solicitadoria Exemplo (demonstração)",
    administrador: { nome: "Inês Moura", email: "ines@demo.example.pt" },
  }, palavraPasse);

  await withTenant({ orgId }, async (tx) => {
    const hash = await hashPalavraPasse(palavraPasse);
    const [marcia] = await tx<{ id: string }[]>`
      insert into users (organization_id, email, name, role, password_hash)
      values (${orgId}, 'marcia@demo.example.pt', 'Márcia Tavares', 'solicitador', ${hash}) returning id`;
    const [tiago] = await tx<{ id: string }[]>`
      insert into users (organization_id, email, name, role, password_hash)
      values (${orgId}, 'tiago@demo.example.pt', 'Tiago Correia', 'triagem', ${hash}) returning id`;
    const U: Record<string, string> = { marcia: marcia.id, tiago: tiago.id, ines: adminId };
    const c = { orgId, userId: adminId };

    const tipos = Object.fromEntries(
      (await tx<{ id: string; key: string }[]>`select id, key from matter_types`).map((t) => [t.key, t.id]),
    );
    const ano = Number(hoje.slice(0, 4));

    const specs: Especificacao[] = [
      {
        numero: 41, cliente: { nome: "Rui Fonseca", email: "rui.fonseca@example.pt", telefone: "+351 900 000 101" },
        tipo: "habilitacao_herdeiros", estado: "resposta_por_conferir", desde: ha(0, 3), criado: 16,
        responsavel: "marcia", seguimento: 7, itens: ["conferido", "recebido", "em_falta", "em_falta"],
        historico: [
          [16, "tiago", "criado", "Processo criado (Habilitação de herdeiros)."],
          [15, "marcia", "item", "«Certidão de óbito»: Recebido → Conferido"],
          [6, "marcia", "pedido_enviado", "Pedido enviado para rui.fonseca@example.pt."],
          [0, "tiago", "anexo_associado", "Anexo «Identificacao_herdeiros.pdf» associado a «Documentos de identificação dos herdeiros»."],
        ],
        pedido: { status: "enviado", dias: 6 },
      },
      {
        numero: 38, cliente: { nome: "Ana Sofia Lemos", email: "ana.lemos@example.pt", telefone: "+351 900 000 102" },
        tipo: "registo_predial", estado: "em_conferencia", desde: ha(2), criado: 4,
        responsavel: "marcia", seguimento: null, itens: ["recebido", "recebido", "conferido", "em_falta", "em_falta"],
        historico: [
          [4, "tiago", "criado", "Processo criado (Registo predial)."],
          [2, "tiago", "anexo_associado", "Documentos iniciais associados."],
        ],
        prazos: [{ label: "Entrega do pedido na conservatória", offset: 2, confirmado: true }],
        anexoErrado: { nome: "Caderneta_predial_Sara_Gomes.pdf", item: 1 },
      },
      {
        numero: 36, cliente: { nome: "Joaquim Pires", email: "joaquim.pires@example.pt", telefone: "+351 900 000 103" },
        tipo: "procuracao", estado: "a_aguardar_cliente", desde: ha(3), criado: 8,
        responsavel: "marcia", seguimento: 4, itens: ["em_falta", "recebido", "conferido"],
        historico: [
          [8, "tiago", "criado", "Processo criado (Procuração)."],
          [3, "marcia", "pedido_enviado", "Pedido enviado para joaquim.pires@example.pt."],
        ],
        pedido: { status: "enviado", dias: 3 },
      },
      {
        numero: 33, cliente: { nome: "Beatriz Carvalho", email: "beatriz.carvalho@example.pt", telefone: "+351 900 000 104" },
        tipo: "arrendamento", estado: "a_aguardar_cliente", desde: ha(9), criado: 15,
        responsavel: "ines", seguimento: -1, itens: ["conferido", "em_falta", "em_falta", "em_falta"],
        historico: [
          [15, "tiago", "criado", "Processo criado (Contrato de arrendamento)."],
          [9, "ines", "pedido_enviado", "Pedido enviado para beatriz.carvalho@example.pt."],
        ],
        prazos: [{ label: "Data indicada pela cliente para assinatura", offset: 5, confirmado: false }],
        pedido: { status: "enviado", dias: 9 },
      },
      {
        numero: 39, cliente: { nome: "Herdeiros de Manuel Antunes", email: "familia.antunes@example.pt", telefone: "+351 900 000 105" },
        tipo: "habilitacao_herdeiros", estado: "a_aguardar_aprovacao", desde: ha(0, 2), criado: 3,
        responsavel: "marcia", seguimento: null, itens: ["conferido", "em_falta", "em_falta", "em_falta"],
        historico: [
          [3, "tiago", "criado", "Processo criado (Habilitação de herdeiros)."],
          [0, "tiago", "pedido_submetido", "Pedido ao cliente submetido para aprovação."],
        ],
        pedido: { status: "a_aguardar_aprovacao", dias: 0 },
      },
      {
        numero: 40, cliente: { nome: "Carla Nogueira", email: "carla.nogueira@example.pt", telefone: "+351 900 000 106" },
        tipo: "nif_nao_residente", estado: "envio_falhado", desde: ha(0, 1), criado: 2,
        responsavel: "ines", seguimento: null, itens: ["recebido", "em_falta", "em_falta"],
        historico: [
          [2, "tiago", "criado", "Processo criado (NIF para não residente)."],
          [0, "ines", "pedido_falhou", "O envio do pedido falhou: servidor de email indisponível."],
        ],
        pedido: { status: "falhado", dias: 0, tentativas: 1, erro: "Servidor de email indisponível (demonstração)." },
      },
      {
        numero: 35, cliente: { nome: "Fernando Batista", email: "fernando.batista@example.pt", telefone: "+351 900 000 107" },
        tipo: "registo_predial", estado: "completo", desde: ha(1), criado: 12,
        responsavel: "marcia", seguimento: null, itens: ["conferido", "conferido", "conferido", "conferido", "em_falta"],
        historico: [
          [12, "tiago", "criado", "Processo criado (Registo predial)."],
          [1, "marcia", "estado", "Estado: Em conferência → Completo"],
        ],
        prazos: [{ label: "Escritura agendada", offset: 10, confirmado: true }],
      },
      {
        numero: 31, cliente: { nome: "Patrícia Rocha", email: "patricia.rocha@example.pt", telefone: "+351 900 000 108" },
        tipo: "procuracao", estado: "concluido", desde: ha(10), criado: 25,
        responsavel: "ines", seguimento: null, itens: ["conferido", "conferido", "conferido"],
        historico: [
          [25, "tiago", "criado", "Processo criado (Procuração)."],
          [10, "ines", "estado", "Estado: Completo → Concluído"],
        ],
      },
      {
        numero: 42, cliente: { nome: "Hortas do Zêzere, Lda.", email: "geral@hortas-zezere.example.pt", telefone: "+351 900 000 109" },
        tipo: "arrendamento", estado: "por_triar", desde: ha(0, 1), criado: 0,
        responsavel: "marcia", seguimento: null, itens: ["em_falta", "em_falta", "em_falta", "em_falta"],
        historico: [[0, "tiago", "criado", "Processo criado (Contrato de arrendamento)."]],
      },
      {
        numero: 37, cliente: { nome: "Luís Matias", email: "luis.matias@example.pt", telefone: "+351 900 000 110" },
        tipo: "nif_nao_residente", estado: "a_aguardar_cliente", desde: ha(7), criado: 10,
        responsavel: "marcia", seguimento: 0, itens: ["conferido", "em_falta", "rejeitado"],
        historico: [
          [10, "tiago", "criado", "Processo criado (NIF para não residente)."],
          [7, "marcia", "item", "«Procuração assinada»: Recebido → Rejeitado (assinatura em falta)"],
          [7, "marcia", "pedido_enviado", "Pedido enviado para luis.matias@example.pt."],
        ],
        pedido: { status: "enviado", dias: 7 },
      },
      {
        numero: 34, cliente: { nome: "Sara Gomes", email: "sara.gomes@example.pt", telefone: "+351 900 000 111" },
        tipo: "registo_predial", estado: "em_conferencia", desde: ha(5), criado: 6,
        responsavel: "ines", seguimento: 1, itens: ["conferido", "em_falta", "recebido", "em_falta", "em_falta"],
        historico: [[6, "tiago", "criado", "Processo criado (Registo predial)."]],
        prazos: [{ label: "Resposta à notificação (data dita por telefone)", offset: -2, confirmado: false }],
      },
    ];

    for (const s of specs) {
      const [cli] = await tx<{ id: string }[]>`
        insert into clients (organization_id, name, email, phone, created_at)
        values (${orgId}, ${s.cliente.nome}, ${s.cliente.email}, ${s.cliente.telefone}, ${ha(s.criado)})
        returning id`;
      const tipoNome = (await tx<{ name: string }[]>`select name from matter_types where id = ${tipos[s.tipo]}`)[0].name;
      const [m] = await tx<{ id: string; reference: string }[]>`
        insert into matters (organization_id, year, number, client_id, matter_type_id, title, state,
                             state_since, responsible_id, follow_up_on, created_at, updated_at)
        values (${orgId}, ${ano}, ${s.numero}, ${cli.id}, ${tipos[s.tipo]},
                ${`${tipoNome} — ${s.cliente.nome}`}, ${s.estado}, ${s.desde}, ${U[s.responsavel]},
                ${s.seguimento === null ? null : dia(s.seguimento)}, ${ha(s.criado)}, ${s.desde})
        returning id, reference`;
      const reqs = await tx<{ label: string; required: boolean; position: number }[]>`
        select label, required, position from document_requirements
        where matter_type_id = ${tipos[s.tipo]} order by position`;
      const itemIds: string[] = [];
      for (const [i, r] of reqs.entries()) {
        const status = s.itens[i] ?? "em_falta";
        const [it] = await tx<{ id: string }[]>`
          insert into matter_items (organization_id, matter_id, label, required, position, status)
          values (${orgId}, ${m.id}, ${r.label}, ${r.required}, ${r.position}, ${status})
          returning id`;
        itemIds.push(it.id);
        if (status === "recebido" || status === "conferido" || status === "rejeitado") {
          const nome = `${r.label.replace(/[^A-Za-zÀ-ÿ0-9]+/g, "_")}_${s.cliente.nome.split(" ")[0]}.pdf`;
          await anexo(tx, c, nome, { matterId: m.id, itemId: it.id, quando: ha(Math.max(s.criado - 1, 0)), autor: U.tiago });
        }
      }
      if (s.anexoErrado) {
        await anexo(tx, c, s.anexoErrado.nome, {
          matterId: m.id, itemId: itemIds[s.anexoErrado.item], quando: ha(2), autor: U.tiago,
        });
      }
      for (const [d, autor, kind, resumo] of s.historico) {
        await evento(tx, c, m.id, ha(d, kind === "criado" ? 0 : 1), U[autor], kind, resumo);
      }
      for (const p of s.prazos ?? []) {
        await tx`
          insert into deadlines (organization_id, matter_id, label, due_on, status, created_by,
                                 confirmed_by, confirmed_at)
          values (${orgId}, ${m.id}, ${p.label}, ${dia(p.offset)},
                  ${p.confirmado ? "confirmado" : "por_confirmar"}, ${U.tiago},
                  ${p.confirmado ? U.marcia : null}, ${p.confirmado ? ha(1) : null})`;
      }
      if (s.pedido) {
        const emFalta = reqs
          .map((r, i) => ({ r, st: s.itens[i] ?? "em_falta" }))
          .filter((x) => x.st === "em_falta" || x.st === "rejeitado");
        const corpo =
          `Caro(a) ${s.cliente.nome},\n\nPara darmos seguimento ao processo ${m.reference}, precisamos ainda dos seguintes documentos:\n\n` +
          emFalta.map((x) => `• ${x.r.label}`).join("\n") +
          `\n\nPode responder a este email com os documentos em anexo.\n\nCom os melhores cumprimentos,\nSolicitadoria Exemplo`;
        const assunto = `Processo ${m.reference} — documentos em falta`;
        const enviado = s.pedido.status === "enviado";
        const [r] = await tx<{ id: string }[]>`
          insert into client_requests (organization_id, matter_id, status, to_email, subject, body,
                                       created_by, submitted_at, approved_by, approved_at, sent_at,
                                       attempts, last_error, created_at, updated_at)
          values (${orgId}, ${m.id}, ${s.pedido.status}, ${s.cliente.email}, ${assunto}, ${corpo},
                  ${U.tiago}, ${ha(s.pedido.dias, 2)},
                  ${s.pedido.status === "a_aguardar_aprovacao" ? null : U.marcia},
                  ${s.pedido.status === "a_aguardar_aprovacao" ? null : ha(s.pedido.dias, 1)},
                  ${enviado ? ha(s.pedido.dias, 1) : null}, ${enviado ? 1 : (s.pedido.tentativas ?? 0)},
                  ${s.pedido.erro ?? null}, ${ha(s.pedido.dias, 3)}, ${ha(s.pedido.dias, 1)})
          returning id`;
        if (enviado) {
          await tx`insert into outbound_messages (organization_id, request_id, to_email, subject, body, sent_at)
                   values (${orgId}, ${r.id}, ${s.cliente.email}, ${assunto}, ${corpo}, ${ha(s.pedido.dias, 1)})`;
          await tx`insert into send_attempts (organization_id, request_id, attempted_at, ok)
                   values (${orgId}, ${r.id}, ${ha(s.pedido.dias, 1)}, true)`;
        } else if (s.pedido.status === "falhado") {
          await tx`insert into send_attempts (organization_id, request_id, attempted_at, ok, error)
                   values (${orgId}, ${r.id}, ${ha(0, 1)}, false, ${s.pedido.erro ?? null})`;
        }
      }
    }

    // Caixa de entrada: dois emails por triar.
    const [e1] = await tx<{ id: string }[]>`
      insert into inbox_messages (organization_id, from_name, from_email, subject, body, received_at, created_by)
      values (${orgId}, 'Joaquim Pires', 'joaquim.pires@example.pt', 'Documento pedido',
              ${"Bom dia,\n\nSegue em anexo o meu cartão de cidadão, como pediram.\n\nJoaquim Pires"},
              ${ha(0, 2)}, ${U.tiago}) returning id`;
    await anexo(tx, c, "Cartao_cidadao_Joaquim_Pires.pdf", { inboxId: e1.id, quando: ha(0, 2), autor: U.tiago });
    const [e2] = await tx<{ id: string }[]>`
      insert into inbox_messages (organization_id, from_name, from_email, subject, body, received_at, created_by)
      values (${orgId}, 'Teresa Vaz', 'teresa.vaz@example.pt', 'Pedido de registo de moradia',
              ${"Boa tarde,\n\nGostaria de tratar do registo da moradia que comprei. Envio já a caderneta e a certidão.\n\nObrigada,\nTeresa Vaz"},
              ${ha(0, 5)}, ${U.tiago}) returning id`;
    await anexo(tx, c, "Caderneta_predial_Teresa_Vaz.pdf", { inboxId: e2.id, quando: ha(0, 5), autor: U.tiago });
    await anexo(tx, c, "Certidao_permanente_Teresa_Vaz.pdf", { inboxId: e2.id, quando: ha(0, 5), autor: U.tiago });
  });
  return orgId;
}

async function criarSegundoEscritorio(sql: Sql, palavraPasse: string) {
  const { orgId, adminId } = await ativarEscritorio(sql, {
    slug: "norte",
    nome: "Gabinete Norte (demonstração)",
    administrador: { nome: "Paulo Sequeira", email: "paulo@norte.example.pt" },
  }, palavraPasse);
  await withTenant({ orgId }, async (tx) => {
    const [tipo] = await tx<{ id: string; name: string }[]>`
      select id, name from matter_types where key = 'procuracao'`;
    const [cli] = await tx<{ id: string }[]>`
      insert into clients (organization_id, name, email) values (${orgId}, 'Diogo Barreto', 'diogo.barreto@example.pt')
      returning id`;
    const [m] = await tx<{ id: string }[]>`
      insert into matters (organization_id, year, number, client_id, matter_type_id, title, state,
                           state_since, responsible_id)
      values (${orgId}, ${Number(hoje.slice(0, 4))}, 7, ${cli.id}, ${tipo.id},
              ${`${tipo.name} — Diogo Barreto`}, 'em_conferencia', ${ha(1)}, ${adminId})
      returning id`;
    await tx`
      insert into matter_items (organization_id, matter_id, label, required, position)
      select ${orgId}, ${m.id}, label, required, position from document_requirements
      where matter_type_id = ${tipo.id}`;
    await evento(tx, { orgId, userId: adminId }, m.id, ha(1), adminId, "criado", "Processo criado (Procuração).");
  });
}

/** Cria os escritórios de demonstração «demo» e «norte» numa BD já migrada. */
export async function criarDadosDemo(sql: Sql, palavraPasse: string): Promise<void> {
  agora = Date.now();
  hoje = diaLisboa();
  await criarDemo(sql, palavraPasse);
  await criarSegundoEscritorio(sql, palavraPasse);
}
