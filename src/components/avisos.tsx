"use client";

/**
 * Avisos (toasts) com «Anular». Substituem diálogos de confirmação: a ação
 * acontece logo e pode ser desfeita durante alguns segundos.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Aviso {
  id: number;
  texto: string;
  tipo: "sucesso" | "erro";
  anular?: () => Promise<void> | void;
}

interface AvisosCtx {
  avisar: (a: Omit<Aviso, "id">) => void;
}

const Ctx = createContext<AvisosCtx | null>(null);
let seq = 0;

export function AvisosProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const fechar = useCallback((id: number) => setAvisos((l) => l.filter((a) => a.id !== id)), []);
  const avisar = useCallback((a: Omit<Aviso, "id">) => {
    const id = ++seq;
    setAvisos((l) => [...l.slice(-2), { ...a, id }]);
  }, []);
  return (
    <Ctx.Provider value={{ avisar }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {avisos.map((a) => (
          <ItemAviso key={a.id} aviso={a} fechar={() => fechar(a.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ItemAviso({ aviso, fechar }: { aviso: Aviso; fechar: () => void }) {
  const [aAnular, setAAnular] = useState(false);
  const pausado = useRef(false);
  useEffect(() => {
    const ms = aviso.anular ? 12_000 : aviso.tipo === "erro" ? 10_000 : 5_000;
    const t = setInterval(() => {
      if (!pausado.current) fechar();
    }, ms);
    return () => clearInterval(t);
  }, [aviso, fechar]);
  const Icone = aviso.tipo === "erro" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={aviso.tipo === "erro" ? "alert" : "status"}
      onMouseEnter={() => (pausado.current = true)}
      onMouseLeave={() => (pausado.current = false)}
      onFocus={() => (pausado.current = true)}
      onBlur={() => (pausado.current = false)}
      className={cn(
        "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border bg-surface p-3.5 shadow-card-hover animate-fade-in",
        aviso.tipo === "erro" ? "border-red-300" : "border-border",
      )}
    >
      <Icone
        aria-hidden
        className={cn("mt-0.5 h-5 w-5 shrink-0", aviso.tipo === "erro" ? "text-danger" : "text-success")}
      />
      <p className="flex-1 text-sm text-ink">
        <span className="sr-only">{aviso.tipo === "erro" ? "Erro: " : ""}</span>
        {aviso.texto}
      </p>
      {aviso.anular && (
        <button
          type="button"
          disabled={aAnular}
          onClick={async () => {
            setAAnular(true);
            try {
              await aviso.anular!();
            } finally {
              fechar();
            }
          }}
          className="rounded-md px-2 py-1 text-sm font-semibold text-bordeaux underline-offset-2 hover:underline focus-ring disabled:opacity-50"
        >
          {aAnular ? "A anular…" : "Anular"}
        </button>
      )}
      <button type="button" onClick={fechar} aria-label="Fechar aviso" className="rounded-md p-1 text-muted hover:text-ink focus-ring">
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useAvisos(): AvisosCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAvisos fora de AvisosProvider");
  return c;
}
