"use server";

import { executar } from "@/server/acao";
import type { FormaTratamento, Papel } from "@/server/domain/papeis";
import {
  adicionarRequisito,
  adicionarTipo,
  alterarPapel,
  alternarObrigatorio,
  criarUtilizador,
  definirAtivo,
  definirFormaTratamento,
  guardarModelo,
  mudarPalavraPasse,
  removerRequisito,
  reporRequisito,
  type RequisitoRemovido,
} from "@/server/services/configuracao";
import { simularFalhasEnvio } from "@/server/services/pedidos";

export async function guardarModeloAcao(id: string, assunto: string, corpo: string) {
  return executar((ctx) => guardarModelo(ctx, id, assunto, corpo));
}
export async function adicionarTipoAcao(nome: string) {
  return executar((ctx) => adicionarTipo(ctx, nome));
}
export async function adicionarRequisitoAcao(tipoId: string, label: string, obrigatorio: boolean) {
  return executar((ctx) => adicionarRequisito(ctx, tipoId, label, obrigatorio));
}
export async function removerRequisitoAcao(id: string) {
  return executar((ctx) => removerRequisito(ctx, id));
}
export async function reporRequisitoAcao(r: RequisitoRemovido) {
  return executar((ctx) => reporRequisito(ctx, r));
}
export async function alternarObrigatorioAcao(id: string) {
  return executar((ctx) => alternarObrigatorio(ctx, id));
}
export async function criarUtilizadorAcao(dados: { nome: string; email: string; papel: string }) {
  return executar((ctx) => criarUtilizador(ctx, dados));
}
export async function alterarPapelAcao(id: string, papel: Papel) {
  return executar((ctx) => alterarPapel(ctx, id, papel));
}
export async function definirAtivoAcao(id: string, ativo: boolean) {
  return executar((ctx) => definirAtivo(ctx, id, ativo));
}
export async function mudarPalavraPasseAcao(atual: string, nova: string) {
  return executar((ctx) => mudarPalavraPasse(ctx, atual, nova));
}
export async function simularFalhasAcao(n: number) {
  return executar((ctx) => simularFalhasEnvio(ctx, n));
}
export async function formaTratamentoAcao(id: string, forma: FormaTratamento | null) {
  return executar((ctx) => definirFormaTratamento(ctx, id, forma));
}
