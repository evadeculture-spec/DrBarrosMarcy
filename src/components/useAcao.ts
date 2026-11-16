"use client";

import { useTransition } from "react";
import type { Resultado } from "@/server/acao";
import { useAvisos } from "./avisos";

/**
 * Corre uma Server Action, mostra erros e, opcionalmente, um aviso de
 * sucesso com «Anular».
 */
export function useAcao() {
  const [pendente, iniciar] = useTransition();
  const { avisar } = useAvisos();

  function correr<T>(
    acao: () => Promise<Resultado<T>>,
    opcoes: {
      sucesso?: string | ((dados: T) => string);
      anular?: (dados: T) => Promise<Resultado<unknown>>;
      depois?: (dados: T) => void;
    } = {},
  ) {
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) {
        avisar({ tipo: "erro", texto: r.erro });
        return;
      }
      opcoes.depois?.(r.dados);
      if (opcoes.sucesso) {
        const texto = typeof opcoes.sucesso === "function" ? opcoes.sucesso(r.dados) : opcoes.sucesso;
        avisar({
          tipo: "sucesso",
          texto,
          anular: opcoes.anular
            ? async () => {
                const a = await opcoes.anular!(r.dados);
                avisar(a.ok ? { tipo: "sucesso", texto: "Anulado." } : { tipo: "erro", texto: a.erro });
              }
            : undefined,
        });
      }
    });
  }

  return { pendente, correr };
}
