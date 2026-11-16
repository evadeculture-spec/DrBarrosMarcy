/**
 * Envio de mensagens ao cliente.
 *
 * Modo «registo» (o único implementado): a mensagem fica registada na
 * aplicação como enviada, sem sair por email. Serve a demonstração e os
 * testes. Permite simular falhas (Configurações → Envio) para treinar o
 * reenvio. Um fornecedor real (SMTP/API) implementa a mesma interface e
 * recebe `chaveIdempotencia` para não duplicar envios do seu lado.
 */
import type { Tx } from "../db";
import type { Ctx } from "./comum";

export interface MensagemSaida {
  chaveIdempotencia: string;
  para: string;
  assunto: string;
  corpo: string;
}

export type ResultadoEnvio = { ok: true } | { ok: false; erro: string };

export type Remetente = (tx: Tx, ctx: Ctx, m: MensagemSaida) => Promise<ResultadoEnvio>;

/** Modo registo: falha se o escritório tiver falhas simuladas pendentes. */
export const remetenteRegisto: Remetente = async (tx) => {
  const [r] = await tx<{ falhas: number }[]>`
    select coalesce((settings->>'falhasEnvioSimuladas')::int, 0) as falhas
    from organizations where id = app_org() for update`;
  if (r && r.falhas > 0) {
    await tx`
      update organizations
      set settings = jsonb_set(settings, '{falhasEnvioSimuladas}', to_jsonb(${r.falhas - 1}::int))
      where id = app_org()`;
    return { ok: false, erro: "Falha simulada do servidor de email (demonstração)." };
  }
  return { ok: true };
};

let remetenteAtual: Remetente = remetenteRegisto;

export function remetente(): Remetente {
  return remetenteAtual;
}

/** Só para testes: substituir o remetente. */
export function definirRemetente(r: Remetente | null): void {
  remetenteAtual = r ?? remetenteRegisto;
}
