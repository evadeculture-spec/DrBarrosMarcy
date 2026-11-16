"use server";

import { executar } from "@/server/acao";
import { ErroNegocio } from "@/server/services/comum";
import { criarProcessoTx, type NovoProcesso } from "@/server/services/processos";
import { withTenant } from "@/server/db";
import {
  anularOperacao,
  arquivarEmail,
  associarAnexo,
  associarAnexoTx,
  carregarEmail,
  type FicheiroNovo,
} from "@/server/services/triagem";

export async function carregarEmailAcao(form: FormData) {
  return executar(async (ctx) => {
    const ficheiros: FicheiroNovo[] = [];
    for (const f of form.getAll("ficheiros")) {
      if (f instanceof File && f.size > 0) {
        ficheiros.push({
          filename: f.name,
          mimeType: f.type || "application/octet-stream",
          content: Buffer.from(await f.arrayBuffer()),
        });
      }
    }
    return carregarEmail(ctx, {
      remetenteNome: String(form.get("remetenteNome") ?? ""),
      remetenteEmail: String(form.get("remetenteEmail") ?? ""),
      assunto: String(form.get("assunto") ?? ""),
      corpo: String(form.get("corpo") ?? ""),
      recebidoEm: String(form.get("recebidoEm") ?? "") || null,
      ficheiros,
    });
  });
}

export async function associarAcao(anexoId: string, matterId: string, itemId: string | null) {
  return executar((ctx) => associarAnexo(ctx, anexoId, matterId, itemId));
}

export async function anularTriagemAcao(eventoId: string) {
  return executar((ctx) => anularOperacao(ctx, eventoId));
}

export async function arquivarAcao(id: string, arquivar: boolean) {
  return executar((ctx) => arquivarEmail(ctx, id, arquivar));
}

/** Cria um processo a partir de um email e associa-lhe todos os anexos por triar. */
export async function processoDeEmailAcao(emailId: string, input: NovoProcesso) {
  return executar(async (ctx) =>
    withTenant(ctx, async (tx) => {
      const [email] = await tx`select id from inbox_messages where id = ${emailId}`;
      if (!email) throw new ErroNegocio("Email não encontrado.", "nao_encontrado");
      const m = await criarProcessoTx(tx, ctx, input);
      const anexos = await tx<{ id: string }[]>`
        select id from attachments where inbox_message_id = ${emailId} and matter_id is null`;
      for (const a of anexos) await associarAnexoTx(tx, ctx, a.id, m.id, null);
      return { id: m.id, reference: m.reference, anexos: anexos.length };
    }),
  );
}
