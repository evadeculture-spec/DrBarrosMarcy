"use server";

import { executar } from "@/server/acao";
import { atribuirTarefa, concluirTarefa, criarTarefa } from "@/server/services/tarefas";

export async function criarTarefaAcao(input: { matterId?: string | null; titulo: string; responsavelId: string; data?: string | null }) {
  return executar((ctx) => criarTarefa(ctx, input));
}
export async function atribuirTarefaAcao(id: string, userId: string) {
  return executar((ctx) => atribuirTarefa(ctx, id, userId));
}
export async function concluirTarefaAcao(id: string, concluida: boolean) {
  return executar((ctx) => concluirTarefa(ctx, id, concluida));
}
