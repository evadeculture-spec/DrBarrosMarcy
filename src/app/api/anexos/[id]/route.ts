import { sessaoAtual } from "@/server/sessao";
import { lerAnexo } from "@/server/services/triagem";

export const dynamic = "force-dynamic";

/** Descarrega um anexo. A leitura passa por RLS: anexos de outro escritório não existem. */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const s = await sessaoAtual();
  if (!s) return new Response("Sessão necessária.", { status: 401 });
  const a = await lerAnexo(s.ctx, params.id);
  if (!a) return new Response("Não encontrado.", { status: 404 });
  const nome = encodeURIComponent(a.filename);
  return new Response(new Uint8Array(a.content), {
    headers: {
      "Content-Type": a.mime_type,
      "Content-Disposition": `attachment; filename*=UTF-8''${nome}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ETag: `"${a.sha256}"`,
    },
  });
}
