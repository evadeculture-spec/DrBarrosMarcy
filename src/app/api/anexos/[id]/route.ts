import { sessaoAtual } from "@/server/sessao";
import { lerAnexo } from "@/server/services/triagem";

export const dynamic = "force-dynamic";

const PRE_VISUALIZAVEL = /^(application\/pdf|image\/(png|jpeg|gif|webp))$/;

/**
 * Descarrega (ou pré-visualiza, com ?ver=1) um anexo. A leitura passa por
 * RLS: anexos de outro escritório não existem. Só PDF e imagens abrem no
 * browser, sempre com CSP em sandbox; o resto é descarregado.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const s = await sessaoAtual();
  if (!s) return new Response("Sessão necessária.", { status: 401 });
  const a = await lerAnexo(s.ctx, params.id);
  if (!a) return new Response("Não encontrado.", { status: 404 });
  const nome = encodeURIComponent(a.filename);
  const ver = new URL(req.url).searchParams.get("ver") === "1" && PRE_VISUALIZAVEL.test(a.mime_type);
  return new Response(new Uint8Array(a.content), {
    headers: {
      "Content-Type": a.mime_type,
      "Content-Disposition": `${ver ? "inline" : "attachment"}; filename*=UTF-8''${nome}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // O visualizador de PDF do browser não funciona em sandbox; imagens e downloads vão em sandbox.
      ...(ver && a.mime_type === "application/pdf"
        ? {}
        : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
      ETag: `"${a.sha256}"`,
    },
  });
}
