/**
 * Sessão do pedido atual (só no servidor).
 */
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { garantirBaseDeDados } from "./arranque";
import { escritorioPorSlug, utilizadorDaSessao, type Escritorio, type Utilizador } from "./services/auth";
import type { Ctx } from "./services/comum";

export const COOKIE_SESSAO = "sf_sessao";

export const escritorioAtual = cache(async (): Promise<Escritorio | null> => {
  const slug = headers().get("x-sf-escritorio");
  if (!slug) return null;
  await garantirBaseDeDados();
  return escritorioPorSlug(slug);
});

export interface Sessao {
  escritorio: Escritorio;
  utilizador: Utilizador;
  ctx: Ctx;
}

export const sessaoAtual = cache(async (): Promise<Sessao | null> => {
  const escritorio = await escritorioAtual();
  if (!escritorio) return null;
  const token = cookies().get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  const utilizador = await utilizadorDaSessao(escritorio.id, token);
  if (!utilizador) return null;
  return {
    escritorio,
    utilizador,
    ctx: { orgId: escritorio.id, userId: utilizador.id, papel: utilizador.role },
  };
});

export async function exigirSessao(): Promise<Sessao> {
  const s = await sessaoAtual();
  if (!s) redirect("/entrar");
  return s;
}
