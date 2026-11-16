/**
 * Invólucro das Server Actions: exige sessão, converte erros de negócio em
 * mensagens e nunca expõe detalhes internos ao browser.
 */
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { ErroNegocio, type Ctx } from "./services/comum";
import { sessaoAtual } from "./sessao";

export type Resultado<T = undefined> =
  | { ok: true; dados: T }
  | { ok: false; erro: string };

export async function executar<T>(fn: (ctx: Ctx) => Promise<T>): Promise<Resultado<T>> {
  const s = await sessaoAtual();
  if (!s) return { ok: false, erro: "A sua sessão terminou. Entre novamente." };
  try {
    const dados = await fn(s.ctx);
    revalidatePath("/", "layout");
    return { ok: true, dados };
  } catch (e) {
    if (e instanceof ErroNegocio) {
      // Uma recusa pode ter deixado estado registado (ex.: tentativa de envio falhada).
      revalidatePath("/", "layout");
      return { ok: false, erro: e.message };
    }
    if (e instanceof ZodError) return { ok: false, erro: e.issues[0]?.message ?? "Dados inválidos." };
    console.error("[acao]", e);
    return { ok: false, erro: "Ocorreu um erro inesperado. Tente de novo; se persistir, avise o administrador." };
  }
}
