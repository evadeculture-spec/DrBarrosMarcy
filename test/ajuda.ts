import { randomBytes } from "node:crypto";
import { adminDb, withTenant } from "../src/server/db";
import { hashPalavraPasse } from "../src/server/services/auth";
import type { Ctx } from "../src/server/services/comum";
import { ativarEscritorio } from "../src/server/services/escritorios";
import { criarProcesso } from "../src/server/services/processos";
import type { Papel } from "../src/server/domain/papeis";

export const PALAVRA_PASSE = "teste-palavra-passe";
let hash: Promise<string> | null = null;

export interface Escritorio {
  orgId: string;
  slug: string;
  admin: Ctx;
  solicitador: Ctx;
  triagem: Ctx;
  tipos: Record<string, string>;
  nomes: Record<string, string>;
}

export async function novoEscritorio(prefixo = "t"): Promise<Escritorio> {
  const slug = `${prefixo}-${randomBytes(4).toString("hex")}`;
  const { orgId, adminId } = await ativarEscritorio(adminDb(), {
    slug,
    nome: `Escritório ${slug}`,
    administrador: { nome: "Alda Admin", email: `admin@${slug}.example.pt` },
  }, PALAVRA_PASSE);
  hash ??= hashPalavraPasse(PALAVRA_PASSE);
  const h = await hash;
  const criar = async (nome: string, papel: Papel) =>
    withTenant({ orgId }, async (tx) => {
      const [u] = await tx<{ id: string }[]>`
        insert into users (organization_id, email, name, role, password_hash)
        values (${orgId}, ${`${papel}@${slug}.example.pt`}, ${nome}, ${papel}, ${h}) returning id`;
      return u.id;
    }, adminDb());
  const solicitadorId = await criar("Márcia Solicitadora", "solicitador");
  const triagemId = await criar("Tiago Triagem", "triagem");
  const tipos = await withTenant({ orgId }, async (tx) =>
    Object.fromEntries((await tx<{ id: string; key: string }[]>`select id, key from matter_types`).map((t) => [t.key, t.id])),
    adminDb(),
  );
  return {
    orgId,
    slug,
    admin: { orgId, userId: adminId, papel: "administrador" },
    solicitador: { orgId, userId: solicitadorId, papel: "solicitador" },
    triagem: { orgId, userId: triagemId, papel: "triagem" },
    tipos,
    nomes: { [adminId]: "Alda Admin", [solicitadorId]: "Márcia Solicitadora", [triagemId]: "Tiago Triagem" },
  };
}

export async function novoProcesso(
  e: Escritorio,
  opcoes: { tipo?: string; cliente?: string; email?: string; responsavel?: Ctx } = {},
) {
  return criarProcesso(e.triagem, {
    novoCliente: {
      nome: opcoes.cliente ?? "Rui Fonseca",
      email: opcoes.email ?? "rui.fonseca@example.pt",
    },
    tipoId: e.tipos[opcoes.tipo ?? "habilitacao_herdeiros"],
    responsavelId: (opcoes.responsavel ?? e.solicitador).userId,
  });
}

/** Leitura direta (como o dono do esquema, dentro do escritório). */
export function ler<T>(orgId: string, fn: Parameters<typeof withTenant<T>>[1]) {
  return withTenant({ orgId }, fn, adminDb());
}

export function ficheiro(nome: string, texto = nome) {
  return { filename: nome, mimeType: "application/pdf", content: Buffer.from(`%PDF-1.4 ${texto}`) };
}
