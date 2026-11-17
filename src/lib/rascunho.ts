"use client";

import { useEffect, useState } from "react";

/**
 * Rascunho guardado automaticamente no browser (por utilizador e ecrã).
 * Serve só como conveniência local: o que conta fica guardado no servidor.
 */
export function useRascunhoLocal<T extends object>(chave: string, inicial: T) {
  const [valor, setValor] = useState<T>(inicial);
  const [recuperado, setRecuperado] = useState(false);
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(chave);
      if (guardado) {
        setValor({ ...inicial, ...JSON.parse(guardado) });
        setRecuperado(true);
      }
    } catch {
      /* armazenamento indisponível */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(chave, JSON.stringify(valor));
      } catch {
        /* ignorar */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [chave, valor]);
  const limpar = () => {
    try {
      window.localStorage.removeItem(chave);
    } catch {
      /* ignorar */
    }
    setValor(inicial);
    setRecuperado(false);
  };
  return { valor, setValor, recuperado, limpar };
}
