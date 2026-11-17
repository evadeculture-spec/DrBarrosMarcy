"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { CONTAS_DEMO, entradaRapidaAtiva } from "@/server/contas-demo";
import { entrar, entrarDemonstracao, sair, SESSAO_DIAS } from "@/server/services/auth";
import { COOKIE_SESSAO, escritorioAtual } from "@/server/sessao";

export interface EstadoEntrar {
  erro?: string;
  email?: string;
}

// Limite simples por processo contra tentativas repetidas (por email+escritório).
const tentativas = new Map<string, { n: number; ate: number }>();

export async function entrarAcao(_: EstadoEntrar, form: FormData): Promise<EstadoEntrar> {
  const escritorio = await escritorioAtual();
  if (!escritorio) return { erro: "Este endereço não corresponde a nenhum escritório." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const palavraPasse = String(form.get("palavraPasse") ?? "");
  if (!email || !palavraPasse) return { erro: "Indique o email e a palavra-passe.", email };

  const chave = `${escritorio.id}:${email}`;
  const t = tentativas.get(chave);
  if (t && t.n >= 5 && t.ate > Date.now()) {
    return { erro: "Demasiadas tentativas. Aguarde um minuto e tente de novo.", email };
  }

  const token = await entrar(escritorio.id, email, palavraPasse);
  if (!token) {
    const n = (t && t.ate > Date.now() ? t.n : 0) + 1;
    tentativas.set(chave, { n, ate: Date.now() + 60_000 });
    return { erro: "Email ou palavra-passe incorretos.", email };
  }
  tentativas.delete(chave);
  guardarSessao(token);
  redirect("/hoje");
}

function guardarSessao(token: string) {
  const seguro = (headers().get("x-forwarded-proto") ?? "").includes("https") || process.env.NODE_ENV === "production";
  cookies().set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: seguro,
    path: "/",
    maxAge: SESSAO_DIAS * 86_400,
  });
}

/** Entrada rápida da demonstração (sem palavra-passe). Validada aqui, no servidor. */
export async function entrarDemoAcao(email: string): Promise<EstadoEntrar> {
  const escritorio = await escritorioAtual();
  if (!escritorio || !entradaRapidaAtiva(escritorio.slug)) {
    return { erro: "A entrada rápida só existe na demonstração." };
  }
  if (!CONTAS_DEMO.some((c) => c.email === email)) return { erro: "Conta de demonstração desconhecida." };
  const token = await entrarDemonstracao(escritorio.id, email);
  if (!token) return { erro: "Esta conta de demonstração não está disponível." };
  guardarSessao(token);
  redirect("/hoje");
}

export async function sairAcao() {
  const escritorio = await escritorioAtual();
  const token = cookies().get(COOKIE_SESSAO)?.value;
  if (escritorio && token) await sair(escritorio.id, token);
  cookies().delete(COOKIE_SESSAO);
  redirect("/entrar");
}
