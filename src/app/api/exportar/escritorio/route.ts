import { sessaoAtual } from "@/server/sessao";
import { exportarEscritorio } from "@/server/services/exportacao";
import { diaLisboa } from "@/server/domain/datas";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await sessaoAtual();
  if (!s) return new Response("Sessão necessária.", { status: 401 });
  if (s.ctx.papel !== "administrador") return new Response("Só administradores.", { status: 403 });
  const dados = await exportarEscritorio(s.ctx);
  return new Response(JSON.stringify(dados), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="escritorio-${s.escritorio.slug}-${diaLisboa()}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
