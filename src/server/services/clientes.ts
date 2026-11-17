/**
 * Clientes: pesquisa sem acentos, paginação estável, ficha, criação,
 * edição e importação CSV com prevenção de duplicados.
 */
import { z } from "zod";
import { withTenant, type Tx } from "../db";
import { calcularFaixa } from "../domain/faixa";
import type { Estado } from "../domain/estados";
import { ErroNegocio, exigirUuid, registarEvento, type Ctx } from "./comum";

export const POR_PAGINA = 25;

/** Mesma normalização que a função SQL sf_normalizar (minúsculas, sem acentos). */
export function normalizar(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Termos de pesquisa: cada palavra (sem acentos) tem de aparecer, em
 * qualquer ordem. «ines castelo» encontra «Inês Faria … Castelo Branco».
 */
export function padroesPesquisa(q: string | undefined | null): string[] {
  const t = normalizar((q ?? "").trim().slice(0, 100));
  return t
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((w) => `%${w.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
}

/** Próxima referência interna (CLI-0001…), sem colisões entre pedidos simultâneos. */
export async function proximaReferenciaCliente(tx: Tx, orgId: string): Promise<string> {
  await tx`select pg_advisory_xact_lock(hashtext(${"cli:" + orgId}))`;
  const [{ n }] = await tx<{ n: number }[]>`
    select coalesce(max(substring(reference from '^CLI-(\\d+)$')::int), 0) + 1 as n
    from clients`;
  return `CLI-${String(n).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

export interface LinhaCliente {
  id: string;
  reference: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  nif: string | null;
  processos_ativos: number;
  processos_total: number;
}

export interface PaginaClientes {
  linhas: LinhaCliente[];
  total: number;
  pagina: number;
  paginas: number;
}

export async function listarClientesPaginado(
  ctx: Ctx,
  opcoes: { q?: string; pagina?: number; porPagina?: number } = {},
): Promise<PaginaClientes> {
  const padroes = padroesPesquisa(opcoes.q);
  const semFiltro = padroes.length === 0;
  const porPagina = Math.min(Math.max(opcoes.porPagina ?? POR_PAGINA, 5), 100);
  return withTenant(ctx, async (tx) => {
    const [{ total }] = await tx<{ total: number }[]>`
      select count(*)::int as total from clients
      where (${semFiltro} or pesquisa like all(${padroes}::text[]))`;
    const paginas = Math.max(1, Math.ceil(total / porPagina));
    const pagina = Math.min(Math.max(Math.floor(opcoes.pagina ?? 1), 1), paginas);
    const linhas = await tx<LinhaCliente[]>`
      select c.id, c.reference, c.name, c.email, c.phone, c.city, c.nif,
             count(m.id) filter (where m.state <> 'concluido')::int as processos_ativos,
             count(m.id)::int as processos_total
      from clients c left join matters m on m.client_id = c.id
      where (${semFiltro} or c.pesquisa like all(${padroes}::text[]))
      group by c.id
      order by c.name, c.reference, c.id
      limit ${porPagina} offset ${(pagina - 1) * porPagina}`;
    return { linhas: [...linhas], total, pagina, paginas };
  });
}

// ---------------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------------

export interface FichaCliente {
  cliente: {
    id: string;
    reference: string;
    name: string;
    email: string | null;
    phone: string | null;
    nif: string | null;
    city: string | null;
    address: string | null;
    notes: string | null;
    created_at: string;
  };
  processos: {
    id: string;
    reference: string;
    title: string;
    state: Estado;
    responsible_name: string;
    follow_up_on: string | null;
    proximo_passo: string;
    falta: number;
  }[];
  proximaAcao: { texto: string; processoId: string; reference: string; quem: string; quando: string | null } | null;
}

export async function obterCliente(ctx: Ctx, id: string): Promise<FichaCliente | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return withTenant(ctx, async (tx) => {
    const [c] = await tx<FichaCliente["cliente"][]>`
      select id, reference, name, email, phone, nif, city, address, notes, created_at
      from clients where id = ${id}`;
    if (!c) return null;
    const ms = await tx<{
      id: string; reference: string; title: string; state: Estado; state_since: string;
      responsible_name: string; follow_up_on: string | null; proxima_acao: string | null;
      falta: number;
    }[]>`
      select m.id, m.reference, m.title, m.state, m.state_since, u.name as responsible_name,
             m.follow_up_on, m.proxima_acao,
             count(i.*) filter (where i.required and i.status in ('em_falta','rejeitado'))::int as falta
      from matters m join users u on u.id = m.responsible_id
      left join matter_items i on i.matter_id = m.id
      where m.client_id = ${id}
      group by m.id, u.name
      order by (m.state = 'concluido'), m.follow_up_on nulls last, m.year desc, m.number desc`;
    const processos = ms.map((m) => {
      const f = calcularFaixa({ estado: m.state, desde: m.state_since, responsavel: m.responsible_name, cliente: c.name, itens: [] });
      return {
        id: m.id,
        reference: m.reference,
        title: m.title,
        state: m.state,
        responsible_name: m.responsible_name,
        follow_up_on: m.follow_up_on,
        proximo_passo: m.proxima_acao || f.proximoPasso,
        falta: m.falta,
      };
    });
    const ativo = processos.find((p) => p.state !== "concluido");
    return {
      cliente: c,
      processos,
      proximaAcao: ativo
        ? { texto: ativo.proximo_passo, processoId: ativo.id, reference: ativo.reference, quem: ativo.responsible_name, quando: ativo.follow_up_on }
        : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Criar e editar
// ---------------------------------------------------------------------------

const vazioParaNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const ClienteSchema = z.object({
  nome: z.string().trim().min(1, "Indique o nome.").max(200),
  email: z.preprocess(vazioParaNull, z.string().trim().toLowerCase().email("Email inválido.").nullable().optional()),
  telefone: z.preprocess(vazioParaNull, z.string().trim().max(40).nullable().optional()),
  nif: z.preprocess(
    vazioParaNull,
    z.string().trim().regex(/^\d{9}$/, "O NIF tem 9 algarismos.").nullable().optional(),
  ),
  localidade: z.preprocess(vazioParaNull, z.string().trim().max(120).nullable().optional()),
  morada: z.preprocess(vazioParaNull, z.string().trim().max(300).nullable().optional()),
  notas: z.preprocess(vazioParaNull, z.string().trim().max(2000).nullable().optional()),
});

export type DadosCliente = z.input<typeof ClienteSchema>;

function validar(bruto: unknown) {
  const r = ClienteSchema.safeParse(bruto);
  if (!r.success) throw new ErroNegocio(r.error.issues[0].message);
  return r.data;
}

async function nifEmUso(tx: Tx, nif: string | null | undefined, excetoId: string | null) {
  if (!nif) return;
  const [d] = await tx<{ reference: string; name: string }[]>`
    select reference, name from clients where nif = ${nif} and (${excetoId}::uuid is null or id <> ${excetoId})`;
  if (d) throw new ErroNegocio(`Já existe um cliente com este NIF: ${d.name} (${d.reference}).`);
}

export async function criarClienteTx(tx: Tx, ctx: Ctx, bruto: unknown): Promise<{ id: string; reference: string }> {
  const d = validar(bruto);
  await nifEmUso(tx, d.nif, null);
  const reference = await proximaReferenciaCliente(tx, ctx.orgId);
  const [c] = await tx<{ id: string; reference: string }[]>`
    insert into clients (organization_id, reference, name, email, phone, nif, city, address, notes)
    values (${ctx.orgId}, ${reference}, ${d.nome}, ${d.email ?? null}, ${d.telefone ?? null},
            ${d.nif ?? null}, ${d.localidade ?? null}, ${d.morada ?? null}, ${d.notas ?? null})
    returning id, reference`;
  await registarEvento(tx, ctx, { matterId: null, kind: "cliente", summary: `Cliente ${reference} criado: ${d.nome}.` });
  return c;
}

export async function criarCliente(ctx: Ctx, bruto: unknown) {
  return withTenant(ctx, (tx) => criarClienteTx(tx, ctx, bruto));
}

export async function editarCliente(ctx: Ctx, id: string, bruto: unknown) {
  exigirUuid(id, "Cliente");
  const d = validar(bruto);
  await withTenant(ctx, async (tx) => {
    await nifEmUso(tx, d.nif, id);
    const r = await tx<{ reference: string }[]>`
      update clients set name = ${d.nome}, email = ${d.email ?? null}, phone = ${d.telefone ?? null},
             nif = ${d.nif ?? null}, city = ${d.localidade ?? null}, address = ${d.morada ?? null},
             notes = ${d.notas ?? null}, updated_at = now()
      where id = ${id} returning reference`;
    if (r.length === 0) throw new ErroNegocio("Cliente não encontrado.", "nao_encontrado");
    await registarEvento(tx, ctx, { matterId: null, kind: "cliente", summary: `Cliente ${r[0].reference} atualizado.` });
  });
}

// ---------------------------------------------------------------------------
// Importação CSV
// ---------------------------------------------------------------------------

export const COLUNAS_CSV = ["nome", "email", "telefone", "nif", "localidade", "morada", "notas"] as const;

export const EXEMPLO_CSV = [
  "nome;email;telefone;nif;localidade;morada;notas",
  "Teresa Antunes;teresa.antunes@example.pt;+351 900 100 001;100000001;Covilhã;Rua das Flores, 3;Cliente por indicação",
  "Hugo Pinheiro;hugo.pinheiro@example.pt;+351 900 100 002;;Fundão;;",
  "Sílvia Gaspar;;+351 900 100 003;100000003;Castelo Branco;;Prefere contacto telefónico",
].join("\n");

/** Divide uma linha CSV com aspas, aceitando «;» ou «,» como separador. */
export function dividirLinhaCsv(linha: string, sep: string): string[] {
  const out: string[] = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (aspas) {
      if (ch === '"' && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else atual += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) {
      out.push(atual);
      atual = "";
    } else atual += ch;
  }
  out.push(atual);
  return out.map((c) => c.trim());
}

export interface LinhaImportacao {
  linha: number;
  dados: Record<string, string>;
  estado: "novo" | "duplicado" | "invalido";
  mensagens: string[];
}

export interface PreVisualizacao {
  linhas: LinhaImportacao[];
  novos: number;
  duplicados: number;
  invalidos: number;
  erroGeral?: string;
}

function analisarCsv(texto: string): { cabecalho: string[]; linhas: { n: number; celulas: string[] }[]; sep: string } {
  const limpo = texto.replace(/^﻿/, "");
  const brutas = limpo.split(/\r?\n/);
  const primeira = brutas.find((l) => l.trim()) ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: { n: number; celulas: string[] }[] = [];
  let cabecalho: string[] = [];
  brutas.forEach((l, i) => {
    if (!l.trim()) return;
    const celulas = dividirLinhaCsv(l, sep);
    if (cabecalho.length === 0) cabecalho = celulas.map((c) => normalizar(c));
    else linhas.push({ n: i + 1, celulas });
  });
  return { cabecalho, linhas, sep };
}

export async function preVisualizarCsv(ctx: Ctx, texto: string): Promise<PreVisualizacao> {
  if (texto.length > 2_000_000) return { linhas: [], novos: 0, duplicados: 0, invalidos: 0, erroGeral: "Ficheiro demasiado grande (máx. 2 MB)." };
  const { cabecalho, linhas } = analisarCsv(texto);
  if (!cabecalho.includes("nome")) {
    return { linhas: [], novos: 0, duplicados: 0, invalidos: 0, erroGeral: "Falta a coluna «nome» na primeira linha." };
  }
  if (linhas.length > 2000) {
    return { linhas: [], novos: 0, duplicados: 0, invalidos: 0, erroGeral: "No máximo 2000 linhas por importação." };
  }
  return withTenant(ctx, async (tx) => {
    const existentes = await tx<{ nif: string | null; email: string | null; name: string; phone: string | null }[]>`
      select nif, lower(email) as email, name, phone from clients`;
    const nifs = new Set(existentes.map((e) => e.nif).filter(Boolean));
    const emails = new Set(existentes.map((e) => e.email).filter(Boolean));
    const nomeTel = new Set(existentes.map((e) => `${normalizar(e.name)}|${(e.phone ?? "").replace(/\s/g, "")}`));
    const vistosNif = new Set<string>();
    const vistosEmail = new Set<string>();
    const vistosNomeTel = new Set<string>();

    const resultado: LinhaImportacao[] = linhas.map(({ n, celulas }) => {
      const dados: Record<string, string> = {};
      cabecalho.forEach((h, i) => {
        if ((COLUNAS_CSV as readonly string[]).includes(h)) dados[h] = celulas[i] ?? "";
      });
      const r = ClienteSchema.safeParse({
        nome: dados.nome, email: dados.email, telefone: dados.telefone, nif: dados.nif,
        localidade: dados.localidade, morada: dados.morada, notas: dados.notas,
      });
      if (!r.success) {
        return { linha: n, dados, estado: "invalido" as const, mensagens: r.error.issues.map((i) => i.message) };
      }
      const nif = r.data.nif ?? null;
      const email = r.data.email ?? null;
      const chaveNomeTel = `${normalizar(r.data.nome)}|${(r.data.telefone ?? "").replace(/\s/g, "")}`;
      const mensagens: string[] = [];
      if (nif && (nifs.has(nif) || vistosNif.has(nif))) mensagens.push(`NIF ${nif} já existe.`);
      else if (email && (emails.has(email) || vistosEmail.has(email))) mensagens.push(`Email ${email} já existe.`);
      else if (!nif && !email && (nomeTel.has(chaveNomeTel) || vistosNomeTel.has(chaveNomeTel))) {
        mensagens.push("Já existe um cliente com o mesmo nome e telefone.");
      }
      if (nif) vistosNif.add(nif);
      if (email) vistosEmail.add(email);
      vistosNomeTel.add(chaveNomeTel);
      return { linha: n, dados, estado: mensagens.length ? ("duplicado" as const) : ("novo" as const), mensagens };
    });
    return {
      linhas: resultado,
      novos: resultado.filter((l) => l.estado === "novo").length,
      duplicados: resultado.filter((l) => l.estado === "duplicado").length,
      invalidos: resultado.filter((l) => l.estado === "invalido").length,
    };
  });
}

/** Importa só as linhas novas e válidas. Repetir o mesmo ficheiro não cria duplicados. */
export async function importarCsv(ctx: Ctx, texto: string): Promise<{ importados: number; ignorados: number }> {
  const pre = await preVisualizarCsv(ctx, texto);
  if (pre.erroGeral) throw new ErroNegocio(pre.erroGeral);
  const novos = pre.linhas.filter((l) => l.estado === "novo");
  await withTenant(ctx, async (tx) => {
    // Bloqueio por escritório: duas importações simultâneas não duplicam.
    await tx`select pg_advisory_xact_lock(hashtext(${"import:" + ctx.orgId}))`;
    for (const l of novos) {
      const d = l.dados;
      if (d.nif) {
        const [ja] = await tx`select 1 from clients where nif = ${d.nif}`;
        if (ja) continue;
      }
      await criarClienteTx(tx, ctx, {
        nome: d.nome, email: d.email, telefone: d.telefone, nif: d.nif,
        localidade: d.localidade, morada: d.morada, notas: d.notas,
      });
    }
    await registarEvento(tx, ctx, {
      matterId: null, kind: "importacao",
      summary: `Importação CSV: ${novos.length} clientes novos, ${pre.linhas.length - novos.length} linhas ignoradas.`,
    });
  });
  return { importados: novos.length, ignorados: pre.linhas.length - novos.length };
}
