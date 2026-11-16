/**
 * Pedido ao cliente: rascunho → aprovação → envio.
 *
 * Idempotência: o id do pedido é a chave. Aprovar/enviar e reenviar
 * trabalham sempre sobre o mesmo pedido, bloqueado com SELECT … FOR UPDATE;
 * um pedido já enviado devolve sucesso sem voltar a enviar. A BD garante no
 * máximo uma mensagem saída por pedido e um pedido em curso por processo.
 */
import { withTenant, type Tx } from "../db";
import { diaLisboa, somarDias } from "../domain/datas";
import { preencherModelo } from "../domain/modelos";
import { pode } from "../domain/papeis";
import {
  bloquearProcesso,
  ErroNegocio,
  exigir,
  exigirUuid,
  mudarEstadoSistema,
  registarEvento,
  type Ctx,
} from "./comum";
import { remetente, type Remetente } from "./envio";

export const DIAS_SEGUIMENTO = 7;

export type EstadoPedido =
  | "rascunho"
  | "a_aguardar_aprovacao"
  | "enviado"
  | "falhado"
  | "devolvido"
  | "cancelado";

export const ESTADO_PEDIDO_ROTULO: Record<EstadoPedido, string> = {
  rascunho: "Rascunho",
  a_aguardar_aprovacao: "A aguardar aprovação",
  enviado: "Enviado",
  falhado: "Envio falhado",
  devolvido: "Devolvido",
  cancelado: "Cancelado",
};

interface PedidoLock {
  id: string;
  matter_id: string;
  status: EstadoPedido;
  to_email: string;
  subject: string;
  body: string;
  item_ids: string[];
}

async function bloquearPedido(tx: Tx, id: string): Promise<PedidoLock> {
  const [p] = await tx<PedidoLock[]>`
    select id, matter_id, status, to_email, subject, body, item_ids
    from client_requests where id = ${id} for update`;
  if (!p) throw new ErroNegocio("Pedido não encontrado.", "nao_encontrado");
  return p;
}

/** Abre o pedido em curso do processo, ou cria um rascunho a partir do modelo. */
export async function prepararPedido(ctx: Ctx, matterId: string): Promise<{ id: string }> {
  exigirUuid(matterId, "Processo");
  return withTenant(ctx, async (tx) => {
    const m = await bloquearProcesso(tx, matterId);
    const [aberto] = await tx<{ id: string }[]>`
      select id from client_requests
      where matter_id = ${matterId} and status in ('rascunho','a_aguardar_aprovacao','falhado')`;
    if (aberto) return aberto;
    if (m.state === "concluido") throw new ErroNegocio("O processo está concluído.");

    const [dados] = await tx<{
      title: string; client_name: string; client_email: string | null;
      responsible_name: string; org_name: string;
    }[]>`
      select m.title, c.name as client_name, c.email as client_email,
             u.name as responsible_name, o.name as org_name
      from matters m join clients c on c.id = m.client_id
      join users u on u.id = m.responsible_id
      join organizations o on o.id = m.organization_id
      where m.id = ${matterId}`;
    const emFalta = await tx<{ id: string; label: string }[]>`
      select id, label from matter_items
      where matter_id = ${matterId} and status in ('em_falta','rejeitado')
      order by required desc, position`;
    const [modelo] = await tx<{ subject: string; body: string }[]>`
      select subject, body from message_templates where key = 'pedido_documentos'`;
    const valores = {
      CLIENTE: dados.client_name,
      PROCESSO: dados.title,
      REFERENCIA: m.reference,
      DOCUMENTOS_EM_FALTA: emFalta.map((i) => `• ${i.label}`).join("\n"),
      RESPONSAVEL: dados.responsible_name,
      ESCRITORIO: dados.org_name,
    };
    const [novo] = await tx<{ id: string }[]>`
      insert into client_requests (organization_id, matter_id, status, to_email, subject,
                                   body, item_ids, created_by)
      values (${ctx.orgId}, ${matterId}, 'rascunho', ${dados.client_email ?? ""},
              ${preencherModelo(modelo?.subject ?? "Processo [REFERENCIA]", valores)},
              ${preencherModelo(modelo?.body ?? "[DOCUMENTOS_EM_FALTA]", valores)},
              ${emFalta.map((i) => i.id)}::uuid[], ${ctx.userId})
      returning id`;
    await registarEvento(tx, ctx, {
      matterId,
      kind: "pedido_rascunho",
      summary: `Rascunho de pedido ao cliente criado (${emFalta.length} documentos em falta).`,
      data: { pedidoId: novo.id },
    });
    return novo;
  });
}

export interface AlteracoesRascunho {
  para?: string;
  assunto?: string;
  corpo?: string;
}

/** Guardado automático do rascunho. */
export async function guardarRascunho(
  ctx: Ctx,
  pedidoId: string,
  alt: AlteracoesRascunho,
): Promise<{ guardadoEm: string }> {
  exigirUuid(pedidoId, "Pedido");
  return withTenant(ctx, async (tx) => {
    const p = await bloquearPedido(tx, pedidoId);
    if (p.status !== "rascunho") {
      throw new ErroNegocio("Este pedido já não é um rascunho e não pode ser editado.", "conflito");
    }
    const [r] = await tx<{ updated_at: Date }[]>`
      update client_requests set
        to_email = ${(alt.para ?? p.to_email).trim().slice(0, 320)},
        subject = ${(alt.assunto ?? p.subject).slice(0, 300)},
        body = ${(alt.corpo ?? p.body).slice(0, 20000)},
        updated_at = now()
      where id = ${pedidoId} returning updated_at`;
    return { guardadoEm: new Date(r.updated_at).toISOString() };
  });
}

function validarConteudo(p: PedidoLock) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.to_email)) {
    throw new ErroNegocio("Indique um email de destino válido.");
  }
  if (!p.subject.trim()) throw new ErroNegocio("O pedido precisa de um assunto.");
  if (!p.body.trim()) throw new ErroNegocio("O pedido precisa de texto.");
  if (/\[[A-Z_]+\]/.test(p.subject + p.body)) {
    throw new ErroNegocio("Ainda há campos por preencher no texto (entre parênteses retos).");
  }
}

async function submeterTx(tx: Tx, ctx: Ctx, p: PedidoLock) {
  validarConteudo(p);
  const m = await bloquearProcesso(tx, p.matter_id);
  await mudarEstadoSistema(tx, ctx, m, "a_aguardar_aprovacao", "pedido submetido");
  await tx`
    update client_requests set status = 'a_aguardar_aprovacao', submitted_at = now(),
                               updated_at = now()
    where id = ${p.id}`;
  await registarEvento(tx, ctx, {
    matterId: p.matter_id,
    kind: "pedido_submetido",
    summary: "Pedido ao cliente submetido para aprovação.",
    data: { pedidoId: p.id },
  });
  p.status = "a_aguardar_aprovacao";
}

export async function submeterPedido(ctx: Ctx, pedidoId: string) {
  exigirUuid(pedidoId, "Pedido");
  await withTenant(ctx, async (tx) => {
    const p = await bloquearPedido(tx, pedidoId);
    if (p.status !== "rascunho") throw new ErroNegocio("Só um rascunho pode ser submetido.");
    await submeterTx(tx, ctx, p);
  });
}

export async function devolverPedido(ctx: Ctx, pedidoId: string, motivo: string) {
  exigirUuid(pedidoId, "Pedido");
  exigir(ctx, "aprovar_pedido");
  await withTenant(ctx, async (tx) => {
    const p = await bloquearPedido(tx, pedidoId);
    if (p.status !== "a_aguardar_aprovacao") {
      throw new ErroNegocio("Só se pode devolver um pedido que aguarda aprovação.");
    }
    const m = await bloquearProcesso(tx, p.matter_id);
    await tx`update client_requests set status = 'rascunho', updated_at = now() where id = ${p.id}`;
    await mudarEstadoSistema(tx, ctx, m, "em_conferencia", "pedido devolvido");
    await registarEvento(tx, ctx, {
      matterId: p.matter_id,
      kind: "pedido_devolvido",
      summary: `Pedido devolvido para correção${motivo.trim() ? `: ${motivo.trim().slice(0, 300)}` : "."}`,
      data: { pedidoId: p.id },
    });
  });
}

export interface ResultadoAprovacao {
  enviado: boolean;
  jaEnviado: boolean;
  erro?: string;
}

/**
 * Aprovar e enviar (ou reenviar após falha). Idempotente pelo id do pedido.
 * Uma falha de envio não é exceção: fica registada e o processo passa a
 * «Envio falhado».
 */
export async function aprovarEEnviar(
  ctx: Ctx,
  pedidoId: string,
  enviar: Remetente = remetente(),
): Promise<ResultadoAprovacao> {
  exigirUuid(pedidoId, "Pedido");
  exigir(ctx, "aprovar_pedido");
  return withTenant(ctx, async (tx) => {
    const p = await bloquearPedido(tx, pedidoId);
    if (p.status === "enviado") return { enviado: true, jaEnviado: true };
    if (p.status === "rascunho") await submeterTx(tx, ctx, p);
    if (p.status !== "a_aguardar_aprovacao" && p.status !== "falhado") {
      throw new ErroNegocio(`Este pedido está «${ESTADO_PEDIDO_ROTULO[p.status]}» e não pode ser enviado.`);
    }
    validarConteudo(p);
    const m = await bloquearProcesso(tx, p.matter_id);

    await tx`
      update client_requests set approved_by = coalesce(approved_by, ${ctx.userId}),
             approved_at = coalesce(approved_at, now()), attempts = attempts + 1,
             updated_at = now()
      where id = ${p.id}`;

    const r = await enviar(tx, ctx, {
      chaveIdempotencia: p.id,
      para: p.to_email,
      assunto: p.subject,
      corpo: p.body,
    });

    await tx`
      insert into send_attempts (organization_id, request_id, ok, error)
      values (${ctx.orgId}, ${p.id}, ${r.ok}, ${r.ok ? null : r.erro})`;

    if (!r.ok) {
      await tx`
        update client_requests set status = 'falhado', last_error = ${r.erro}, updated_at = now()
        where id = ${p.id}`;
      await mudarEstadoSistema(tx, ctx, m, "envio_falhado", "envio falhou");
      await registarEvento(tx, ctx, {
        matterId: p.matter_id,
        kind: "pedido_falhou",
        summary: `O envio do pedido falhou: ${r.erro}`,
        data: { pedidoId: p.id },
      });
      return { enviado: false, jaEnviado: false, erro: r.erro };
    }

    await tx`
      insert into outbound_messages (organization_id, request_id, to_email, subject, body)
      values (${ctx.orgId}, ${p.id}, ${p.to_email}, ${p.subject}, ${p.body})`;
    await tx`
      update client_requests set status = 'enviado', sent_at = now(), last_error = null,
                                 updated_at = now()
      where id = ${p.id}`;
    const seguimento = somarDias(diaLisboa(), DIAS_SEGUIMENTO);
    await tx`update matters set follow_up_on = ${seguimento} where id = ${p.matter_id}`;
    await mudarEstadoSistema(tx, ctx, m, "a_aguardar_cliente", "pedido enviado");
    await registarEvento(tx, ctx, {
      matterId: p.matter_id,
      kind: "pedido_enviado",
      summary: `Pedido enviado para ${p.to_email}. Seguimento a ${seguimento.split("-").reverse().join("/")}.`,
      data: { pedidoId: p.id, seguimento },
    });
    return { enviado: true, jaEnviado: false };
  });
}

export async function cancelarPedido(ctx: Ctx, pedidoId: string) {
  exigirUuid(pedidoId, "Pedido");
  await withTenant(ctx, async (tx) => {
    const p = await bloquearPedido(tx, pedidoId);
    if (!["rascunho", "a_aguardar_aprovacao", "falhado"].includes(p.status)) {
      throw new ErroNegocio("Este pedido já não pode ser cancelado.");
    }
    if (p.status !== "rascunho" && !pode(ctx.papel, "aprovar_pedido")) {
      throw new ErroNegocio("Só um solicitador pode cancelar um pedido submetido.", "proibido");
    }
    const m = await bloquearProcesso(tx, p.matter_id);
    await tx`update client_requests set status = 'cancelado', updated_at = now() where id = ${p.id}`;
    if (m.state === "a_aguardar_aprovacao" || m.state === "envio_falhado") {
      await mudarEstadoSistema(tx, ctx, m, "em_conferencia", "pedido cancelado");
    }
    await registarEvento(tx, ctx, {
      matterId: p.matter_id,
      kind: "pedido_cancelado",
      summary: "Pedido ao cliente cancelado.",
      data: { pedidoId: p.id },
    });
  });
}

/** Configuração da demonstração: simular falhas nos próximos envios. */
export async function simularFalhasEnvio(ctx: Ctx, n: number) {
  exigir(ctx, "gerir_escritorio");
  const valor = Math.max(0, Math.min(10, Math.floor(n)));
  await withTenant(ctx, async (tx) => {
    await tx`
      update organizations
      set settings = jsonb_set(settings, '{falhasEnvioSimuladas}', to_jsonb(${valor}::int))
      where id = ${ctx.orgId}`;
  });
}
