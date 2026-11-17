/**
 * Peças partilhadas pelos serviços: contexto do pedido, erros de negócio,
 * histórico e mudança de estado.
 */
import type { Tx } from "../db";
import {
  ESTADO_ROTULO,
  validarTransicaoManual,
  validarTransicaoSistema,
  type Estado,
} from "../domain/estados";
import { pode, type Papel, type Permissao } from "../domain/papeis";

export interface Ctx {
  orgId: string;
  userId: string;
  papel: Papel;
}

/** Erro previsível, com mensagem em português para mostrar ao utilizador. */
export class ErroNegocio extends Error {
  constructor(
    message: string,
    public readonly codigo: string = "invalido",
  ) {
    super(message);
    this.name = "ErroNegocio";
  }
}

export function exigir(ctx: Ctx, permissao: Permissao): void {
  if (!pode(ctx.papel, permissao)) {
    throw new ErroNegocio("O seu papel não permite esta ação.", "proibido");
  }
}

export interface NovoEvento {
  matterId: string | null;
  kind: string;
  summary: string;
  data?: Record<string, unknown>;
}

export async function registarEvento(
  tx: Tx,
  ctx: Ctx,
  e: NovoEvento,
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into events (organization_id, matter_id, actor_id, kind, summary, data)
    values (${ctx.orgId}, ${e.matterId}, ${ctx.userId}, ${e.kind}, ${e.summary},
            ${tx.json((e.data ?? {}) as never)})
    returning id`;
  return row.id;
}

export interface MatterLock {
  id: string;
  state: Estado;
  reference: string;
}

/** Lê e bloqueia o processo até ao fim da transação. */
export async function bloquearProcesso(tx: Tx, matterId: string): Promise<MatterLock> {
  const [m] = await tx<MatterLock[]>`
    select id, state, reference from matters where id = ${matterId} for update`;
  if (!m) throw new ErroNegocio("Processo não encontrado.", "nao_encontrado");
  return m;
}

async function aplicarEstado(
  tx: Tx,
  ctx: Ctx,
  m: MatterLock,
  para: Estado,
  motivo: string | null,
): Promise<void> {
  if (m.state === para) return;
  await tx`
    update matters set state = ${para}, state_since = now(), updated_at = now()
    where id = ${m.id}`;
  await registarEvento(tx, ctx, {
    matterId: m.id,
    kind: "estado",
    summary: `Estado: ${ESTADO_ROTULO[m.state]} → ${ESTADO_ROTULO[para]}${motivo ? ` (${motivo})` : ""}`,
    data: { de: m.state, para, motivo },
  });
  m.state = para;
}

/** Mudança de estado pedida por um utilizador. */
export async function mudarEstadoManual(
  tx: Tx,
  ctx: Ctx,
  m: MatterLock,
  para: Estado,
): Promise<void> {
  const r = validarTransicaoManual(m.state, para, ctx.papel);
  if (!r.ok) throw new ErroNegocio(r.erro, "transicao");
  await aplicarEstado(tx, ctx, m, para, null);
}

/** Mudança de estado em consequência de outra ação. */
export async function mudarEstadoSistema(
  tx: Tx,
  ctx: Ctx,
  m: MatterLock,
  para: Estado,
  motivo: string,
): Promise<void> {
  if (m.state === para) return;
  const r = validarTransicaoSistema(m.state, para);
  if (!r.ok) throw new ErroNegocio(r.erro, "transicao");
  await aplicarEstado(tx, ctx, m, para, motivo);
}

export function eUuid(valor: unknown): valor is string {
  return (
    typeof valor === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)
  );
}

/** Garante que um id é um UUID; caso contrário, trata como inexistente. */
export function exigirUuid(valor: unknown, oQue = "Registo"): string {
  if (!eUuid(valor)) throw new ErroNegocio(`${oQue} não encontrado.`, "nao_encontrado");
  return valor;
}
