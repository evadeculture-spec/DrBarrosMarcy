import { Clock, Inbox, Search, ShieldCheck, CheckCheck, CircleCheck, TriangleAlert, MessageSquareReply } from "lucide-react";
import { ESTADO_ROTULO, type Estado } from "@/server/domain/estados";
import { cn } from "@/lib/utils";

/** O estado tem sempre texto e ícone; a cor é só reforço. */
const ESTILO: Record<Estado, { classe: string; Icone: typeof Clock }> = {
  por_triar: { classe: "bg-slate-100 text-slate-800 border-slate-300", Icone: Inbox },
  em_conferencia: { classe: "bg-blue-50 text-blue-900 border-blue-200", Icone: Search },
  a_aguardar_aprovacao: { classe: "bg-violet-50 text-violet-900 border-violet-200", Icone: ShieldCheck },
  a_aguardar_cliente: { classe: "bg-amber-50 text-amber-900 border-amber-200", Icone: Clock },
  resposta_por_conferir: { classe: "bg-cyan-50 text-cyan-900 border-cyan-200", Icone: MessageSquareReply },
  completo: { classe: "bg-emerald-50 text-emerald-900 border-emerald-200", Icone: CheckCheck },
  concluido: { classe: "bg-gray-100 text-gray-700 border-gray-300", Icone: CircleCheck },
  envio_falhado: { classe: "bg-red-50 text-red-900 border-red-300", Icone: TriangleAlert },
};

export function EstadoProcesso({ estado, className }: { estado: Estado; className?: string }) {
  const { classe, Icone } = ESTILO[estado];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        classe,
        className,
      )}
    >
      <Icone aria-hidden className="h-3.5 w-3.5" />
      {ESTADO_ROTULO[estado]}
    </span>
  );
}

