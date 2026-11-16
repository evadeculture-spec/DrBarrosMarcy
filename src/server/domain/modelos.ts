/** Preenche [VARIAVEIS] de um modelo. Variáveis sem valor ficam visíveis. */
export function preencherModelo(
  texto: string,
  valores: Record<string, string | undefined>,
): string {
  return texto.replace(/\[([A-Z_]+)\]/g, (original, chave: string) => {
    const v = valores[chave];
    return v !== undefined && v !== "" ? v : original;
  });
}

export const VARIAVEIS_MODELO = [
  "CLIENTE",
  "PROCESSO",
  "REFERENCIA",
  "DOCUMENTOS_EM_FALTA",
  "RESPONSAVEL",
  "ESCRITORIO",
] as const;
