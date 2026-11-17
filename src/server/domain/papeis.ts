export const PAPEIS = ["triagem", "solicitador", "administrador"] as const;
export type Papel = (typeof PAPEIS)[number];

export const PAPEL_ROTULO: Record<Papel, string> = {
  triagem: "Triagem",
  solicitador: "Solicitador",
  administrador: "Administrador",
};

export type Permissao =
  | "aprovar_pedido"
  | "confirmar_prazo"
  | "concluir_processo"
  | "reabrir_processo"
  | "gerir_escritorio"
  | "apagar_processo"
  | "editar_modelos";

const MATRIZ: Record<Permissao, readonly Papel[]> = {
  aprovar_pedido: ["solicitador", "administrador"],
  confirmar_prazo: ["solicitador", "administrador"],
  concluir_processo: ["solicitador", "administrador"],
  reabrir_processo: ["solicitador", "administrador"],
  gerir_escritorio: ["administrador"],
  apagar_processo: ["administrador"],
  editar_modelos: ["solicitador", "administrador"],
};

export function pode(papel: Papel, permissao: Permissao): boolean {
  return MATRIZ[permissao].includes(papel);
}

export type FormaTratamento = "masculino" | "feminino";

const ROTULO_FEMININO: Record<Papel, string> = {
  triagem: "Triagem",
  solicitador: "Solicitadora",
  administrador: "Administradora",
};

/** Rótulo do papel conforme a forma de tratamento escolhida (neutro se não houver). */
export function rotuloPapel(papel: Papel, forma?: FormaTratamento | null): string {
  return forma === "feminino" ? ROTULO_FEMININO[papel] : PAPEL_ROTULO[papel];
}
