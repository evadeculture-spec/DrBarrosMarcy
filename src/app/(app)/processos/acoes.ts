"use server";

import { executar } from "@/server/acao";
import {
  adicionarItem,
  alterarItem,
  atribuirResponsavel,
  criarProcesso,
  definirBloqueio,
  definirProximaAcao,
  definirSeguimento,
  definirValores,
  guardarPosicao,
  transicionar,
  type NovoProcesso,
} from "@/server/services/processos";
import { confirmarPrazo, criarPrazo, removerPrazoPorConfirmar } from "@/server/services/hoje";
import {
  aprovarEEnviar,
  cancelarPedido,
  devolverPedido,
  guardarRascunho,
  prepararPedido,
  registarEnvioExterno,
  submeterPedido,
  type AlteracoesRascunho,
} from "@/server/services/pedidos";
import { anularOperacao, carregarNoProcesso, moverAnexo, simularRececao } from "@/server/services/triagem";
import { withTenant } from "@/server/db";
import { sessaoAtual } from "@/server/sessao";
import { ErroNegocio } from "@/server/services/comum";
import { apagarProcesso, exportarProcesso, restaurarProcesso } from "@/server/services/exportacao";

export async function criarProcessoAcao(input: NovoProcesso) {
  return executar((ctx) => criarProcesso(ctx, input));
}
export async function transicionarAcao(id: string, para: string) {
  return executar((ctx) => transicionar(ctx, id, para));
}
export async function alterarItemAcao(itemId: string, status: string) {
  return executar((ctx) => alterarItem(ctx, itemId, status));
}
export async function adicionarItemAcao(matterId: string, label: string, obrigatorio: boolean) {
  return executar((ctx) => adicionarItem(ctx, matterId, label, obrigatorio));
}
export async function seguimentoAcao(matterId: string, data: string | null) {
  return executar((ctx) => definirSeguimento(ctx, matterId, data));
}
export async function responsavelAcao(matterId: string, userId: string) {
  return executar((ctx) => atribuirResponsavel(ctx, matterId, userId));
}
export async function posicaoAcao(matterId: string, separador: string) {
  const s = await sessaoAtual();
  if (s) await guardarPosicao(s.ctx, matterId, separador);
}
export async function criarPrazoAcao(matterId: string, label: string, data: string) {
  return executar((ctx) => criarPrazo(ctx, matterId, label, data));
}
export async function confirmarPrazoAcao(id: string) {
  return executar((ctx) => confirmarPrazo(ctx, id));
}
export async function removerPrazoAcao(id: string) {
  return executar((ctx) => removerPrazoPorConfirmar(ctx, id));
}
export async function prepararPedidoAcao(matterId: string) {
  return executar((ctx) => prepararPedido(ctx, matterId));
}
export async function guardarRascunhoAcao(id: string, alt: AlteracoesRascunho) {
  return executar((ctx) => guardarRascunho(ctx, id, alt));
}
export async function submeterPedidoAcao(id: string) {
  return executar((ctx) => submeterPedido(ctx, id));
}
export async function aprovarEnviarAcao(id: string) {
  return executar(async (ctx) => {
    const r = await aprovarEEnviar(ctx, id);
    if (!r.enviado) throw new ErroNegocio(`O envio falhou: ${r.erro}. O pedido ficou guardado; pode reenviar.`);
    return r;
  });
}
export async function devolverPedidoAcao(id: string, motivo: string) {
  return executar((ctx) => devolverPedido(ctx, id, motivo));
}
export async function cancelarPedidoAcao(id: string) {
  return executar((ctx) => cancelarPedido(ctx, id));
}
export async function moverAnexoAcao(anexoId: string, destinoId: string, itemId: string | null) {
  return executar((ctx) => moverAnexo(ctx, anexoId, destinoId, itemId));
}
export async function anularAcao(eventoId: string) {
  return executar((ctx) => anularOperacao(ctx, eventoId));
}
export async function carregarNoProcessoAcao(form: FormData) {
  return executar(async (ctx) => {
    const ficheiro = form.get("ficheiro");
    const matterId = String(form.get("matterId") ?? "");
    const itemId = String(form.get("itemId") ?? "") || null;
    if (!(ficheiro instanceof File) || ficheiro.size === 0) throw new ErroNegocio("Escolha um ficheiro.");
    return carregarNoProcesso(ctx, matterId, itemId, {
      filename: ficheiro.name,
      mimeType: ficheiro.type || "application/octet-stream",
      content: Buffer.from(await ficheiro.arrayBuffer()),
    });
  });
}
/** Exporta e apaga: devolve a exportação para o browser a descarregar e para «Anular». */
export async function apagarProcessoAcao(id: string) {
  return executar(async (ctx) => {
    const exportacao = JSON.parse(JSON.stringify(await exportarProcesso(ctx, id)));
    if (JSON.stringify(exportacao).length > 25 * 1024 * 1024) {
      throw new ErroNegocio("Processo demasiado grande para apagar aqui. Exporte-o primeiro e apague-o depois.");
    }
    await apagarProcesso(ctx, id);
    return exportacao as unknown;
  });
}
export async function restaurarDadosAcao(dados: unknown) {
  return executar((ctx) => restaurarProcesso(ctx, dados));
}
export async function restaurarProcessoAcao(form: FormData) {
  return executar(async (ctx) => {
    const f = form.get("ficheiro");
    if (!(f instanceof File) || f.size === 0) throw new ErroNegocio("Escolha o ficheiro de exportação.");
    let dados: unknown;
    try {
      dados = JSON.parse(await f.text());
    } catch {
      throw new ErroNegocio("O ficheiro não é JSON válido.");
    }
    return restaurarProcesso(ctx, dados);
  });
}

export async function proximaAcaoAcao(matterId: string, texto: string | null) {
  return executar((ctx) => definirProximaAcao(ctx, matterId, texto));
}
export async function bloqueioAcao(matterId: string, b: { motivo: string; nota?: string | null; revisao: string } | null) {
  return executar((ctx) => definirBloqueio(ctx, matterId, b));
}
export async function valoresAcao(matterId: string, previsto: number | null, pago: number) {
  return executar((ctx) => definirValores(ctx, matterId, previsto, pago));
}
export async function registarEnvioExternoAcao(pedidoId: string, nota: string) {
  return executar((ctx) => registarEnvioExterno(ctx, pedidoId, nota));
}
/** Só em escritórios de demonstração (verificado no servidor). */
export async function simularRececaoAcao(matterId: string) {
  return executar(async (ctx) => {
    const [org] = await withTenant(ctx, (tx) => tx<{ demo: boolean }[]>`
      select coalesce((settings->>'demo')::boolean, false) as demo from organizations where id = ${ctx.orgId}`);
    if (!org?.demo) throw new ErroNegocio("A simulação só existe no escritório de demonstração.");
    const { pdfMinimo } = await import("@/server/demo");
    const r = await simularRececao(ctx, matterId, pdfMinimo);
    return { anexos: r.anexos.length };
  });
}
