import { sessaoAtual } from "@/server/sessao";
import { ErroNegocio } from "@/server/services/comum";
import { exportarProcesso } from "@/server/services/exportacao";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const s = await sessaoAtual();
  if (!s) return new Response("Sessão necessária.", { status: 401 });
  if (s.ctx.papel !== "administrador") return new Response("Só administradores.", { status: 403 });
  try {
    const dados = await exportarProcesso(s.ctx, params.id);
    const ref = String(dados.processo.reference).replace("/", "-");
    return new Response(JSON.stringify(dados), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="processo-${ref}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof ErroNegocio) return new Response(e.message, { status: 404 });
    throw e;
  }
}
