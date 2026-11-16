/**
 * Estados do processo e transições permitidas.
 *
 * Há dois tipos de transição:
 *  - manual: um utilizador carrega num botão na ficha;
 *  - sistema: acontece como consequência de outra ação (associar um anexo,
 *    enviar um pedido, …) e nunca pode ser pedida diretamente.
 * O servidor recusa tudo o que não estiver nesta tabela.
 */
import type { Papel } from "./papeis";

export const ESTADOS = [
  "por_triar",
  "em_conferencia",
  "a_aguardar_aprovacao",
  "a_aguardar_cliente",
  "resposta_por_conferir",
  "completo",
  "concluido",
  "envio_falhado",
] as const;

export type Estado = (typeof ESTADOS)[number];

export const ESTADO_ROTULO: Record<Estado, string> = {
  por_triar: "Por triar",
  em_conferencia: "Em conferência",
  a_aguardar_aprovacao: "A aguardar aprovação",
  a_aguardar_cliente: "A aguardar cliente",
  resposta_por_conferir: "Resposta por conferir",
  completo: "Completo",
  concluido: "Concluído",
  envio_falhado: "Envio falhado",
};

export function isEstado(valor: string): valor is Estado {
  return (ESTADOS as readonly string[]).includes(valor);
}

const TODOS: readonly Papel[] = ["triagem", "solicitador", "administrador"];
const SOLICITADORES: readonly Papel[] = ["solicitador", "administrador"];

interface Transicao {
  de: Estado;
  para: Estado;
  /** Se existir, a transição pode ser pedida por estes papéis. */
  manual?: { rotulo: string; papeis: readonly Papel[] };
  /** Se verdadeiro, pode ocorrer como consequência de outra ação. */
  sistema?: boolean;
}

export const TRANSICOES: readonly Transicao[] = [
  { de: "por_triar", para: "em_conferencia", sistema: true,
    manual: { rotulo: "Iniciar conferência", papeis: TODOS } },

  { de: "em_conferencia", para: "a_aguardar_aprovacao", sistema: true },
  { de: "em_conferencia", para: "completo",
    manual: { rotulo: "Marcar como completo", papeis: TODOS } },

  { de: "a_aguardar_aprovacao", para: "a_aguardar_cliente", sistema: true },
  { de: "a_aguardar_aprovacao", para: "envio_falhado", sistema: true },
  { de: "a_aguardar_aprovacao", para: "em_conferencia", sistema: true },

  { de: "envio_falhado", para: "a_aguardar_cliente", sistema: true },
  { de: "envio_falhado", para: "envio_falhado", sistema: true },
  { de: "envio_falhado", para: "em_conferencia", sistema: true },

  { de: "a_aguardar_cliente", para: "resposta_por_conferir", sistema: true,
    manual: { rotulo: "Cliente respondeu", papeis: TODOS } },
  { de: "a_aguardar_cliente", para: "em_conferencia",
    manual: { rotulo: "Retomar conferência", papeis: TODOS } },

  { de: "resposta_por_conferir", para: "em_conferencia",
    manual: { rotulo: "Passar a em conferência", papeis: TODOS } },
  { de: "resposta_por_conferir", para: "a_aguardar_aprovacao", sistema: true },
  { de: "resposta_por_conferir", para: "completo",
    manual: { rotulo: "Marcar como completo", papeis: TODOS } },

  { de: "completo", para: "concluido",
    manual: { rotulo: "Concluir processo", papeis: SOLICITADORES } },
  { de: "completo", para: "em_conferencia", sistema: true,
    manual: { rotulo: "Reabrir", papeis: SOLICITADORES } },

  { de: "concluido", para: "em_conferencia",
    manual: { rotulo: "Reabrir", papeis: SOLICITADORES } },
];

export type ResultadoTransicao =
  | { ok: true }
  | { ok: false; erro: string };

function encontrar(de: Estado, para: Estado): Transicao | undefined {
  return TRANSICOES.find((t) => t.de === de && t.para === para);
}

/** Valida uma transição pedida diretamente por um utilizador. */
export function validarTransicaoManual(
  de: Estado,
  para: Estado,
  papel: Papel,
): ResultadoTransicao {
  const t = encontrar(de, para);
  if (!t || !t.manual) {
    return {
      ok: false,
      erro: `Não é possível passar de «${ESTADO_ROTULO[de]}» para «${ESTADO_ROTULO[para]}».`,
    };
  }
  if (!t.manual.papeis.includes(papel)) {
    return {
      ok: false,
      erro: `O seu papel não permite «${t.manual.rotulo}».`,
    };
  }
  return { ok: true };
}

/** Valida uma transição que resulta de outra ação do sistema. */
export function validarTransicaoSistema(
  de: Estado,
  para: Estado,
): ResultadoTransicao {
  const t = encontrar(de, para);
  if (!t || !t.sistema) {
    return {
      ok: false,
      erro: `Esta ação não é possível com o processo em «${ESTADO_ROTULO[de]}».`,
    };
  }
  return { ok: true };
}

/** Botões de transição a mostrar na ficha para este estado e papel. */
export function acoesManuais(
  estado: Estado,
  papel: Papel,
): { para: Estado; rotulo: string }[] {
  return TRANSICOES.filter(
    (t) => t.de === estado && t.manual && t.manual.papeis.includes(papel),
  ).map((t) => ({ para: t.para, rotulo: t.manual!.rotulo }));
}

/** Estados em que a bola está do lado da equipa. */
export function equipaTemDeAgir(estado: Estado): boolean {
  return estado !== "a_aguardar_cliente" && estado !== "concluido";
}
