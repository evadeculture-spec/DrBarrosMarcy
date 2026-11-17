"use server";

import { executar } from "@/server/acao";
import { criarCliente, editarCliente, importarCsv, preVisualizarCsv } from "@/server/services/clientes";

export async function criarClienteAcao(dados: Record<string, string>) {
  return executar((ctx) => criarCliente(ctx, dados));
}
export async function editarClienteAcao(id: string, dados: Record<string, string>) {
  return executar((ctx) => editarCliente(ctx, id, dados));
}
export async function preVisualizarCsvAcao(texto: string) {
  return executar((ctx) => preVisualizarCsv(ctx, texto));
}
export async function importarCsvAcao(texto: string) {
  return executar((ctx) => importarCsv(ctx, texto));
}
