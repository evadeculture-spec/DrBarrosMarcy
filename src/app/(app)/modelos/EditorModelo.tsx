"use client";

import { useEffect, useRef, useState } from "react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { formatarDataHora } from "@/server/domain/datas";
import type { Modelo } from "@/server/services/configuracao";
import { guardarModeloAcao } from "../configuracoes/acoes";

export function EditorModelo({ modelo, editavel }: { modelo: Modelo; editavel: boolean }) {
  const [assunto, setAssunto] = useState(modelo.subject);
  const [corpo, setCorpo] = useState(modelo.body);
  const [estado, setEstado] = useState<{ t: "ok" | "a_guardar" | "erro"; em?: string; erro?: string }>({ t: "ok", em: modelo.updated_at });
  const primeira = useRef(true);

  useEffect(() => {
    if (!editavel) return;
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    setEstado({ t: "a_guardar" });
    const h = setTimeout(async () => {
      const r = await guardarModeloAcao(modelo.id, assunto, corpo);
      setEstado(r.ok ? { t: "ok", em: r.dados.guardadoEm } : { t: "erro", erro: r.erro });
    }, 800);
    return () => clearTimeout(h);
  }, [assunto, corpo, editavel, modelo.id]);

  return (
    <section aria-labelledby={`m-${modelo.id}`} className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`m-${modelo.id}`} className="text-base font-semibold text-ink">{modelo.name}</h2>
        <p className="text-xs text-muted" aria-live="polite">
          {estado.t === "a_guardar" ? "A guardar…" : estado.t === "erro" ? estado.erro : `Guardado · ${estado.em ? formatarDataHora(estado.em) : ""}`}
        </p>
      </div>
      <div>
        <Label htmlFor={`ma-${modelo.id}`}>Assunto</Label>
        <Input id={`ma-${modelo.id}`} value={assunto} readOnly={!editavel} onChange={(e) => setAssunto(e.target.value)} />
      </div>
      <div>
        <Label htmlFor={`mc-${modelo.id}`}>Texto</Label>
        <Textarea id={`mc-${modelo.id}`} rows={12} value={corpo} readOnly={!editavel} onChange={(e) => setCorpo(e.target.value)} />
      </div>
    </section>
  );
}
