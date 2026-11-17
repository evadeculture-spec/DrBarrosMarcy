/**
 * Vista «Hoje»: lista de ações da equipa, não contadores.
 *
 * Regras:
 *  - um processo aparece quando a bola está do lado da equipa;
 *  - desaparece em «A aguardar cliente»;
 *  - regressa quando o cliente responde (muda de estado) ou quando chega a
 *    data de Seguimento;
 *  - Seguimento (data interna) e Prazo (data com consequências) são tipos
 *    diferentes e nunca partilham contadores;
 *  - um Prazo «por confirmar» não gera alertas nem entra nos contadores de
 *    prazos até um solicitador o confirmar.
 */
import { diferencaDias, formatarDiaMes } from "./datas";
import { equipaTemDeAgir, type Estado } from "./estados";

export interface ProcessoHoje {
  id: string;
  reference: string;
  estado: Estado;
  stateSince: string;
  followUpOn: string | null;
  responsavelId: string;
  responsavelNome: string;
  clienteNome: string;
  /** Obrigatórios em falta ou rejeitados. */
  falta: number;
  totalObrigatorios: number;
}

export interface EmailPorTriar {
  id: string;
  remetente: string;
  assunto: string;
  anexos: number;
  recebidoEm: string;
}

export interface PrazoHoje {
  id: string;
  matterId: string;
  reference: string;
  clienteNome: string;
  label: string;
  dueOn: string;
  status: "por_confirmar" | "confirmado";
}

export interface LinhaAcao {
  chave: string;
  tipo: "processo" | "email";
  verbo: string;
  texto: string;
  href: string;
  responsavelId: string | null;
  /** Seguimento ultrapassado (é a única coisa que torna uma linha «atrasada»). */
  atrasada: boolean;
}

export interface LinhaPrazo {
  id: string;
  texto: string;
  href: string;
  dueOn: string;
  diasEmFalta: number;
  /** Só prazos confirmados podem ter alerta. */
  alerta: "vencido" | "proximo" | null;
}

export interface VistaHoje {
  acoes: LinhaAcao[];
  prazos: LinhaPrazo[];
  prazosPorConfirmar: LinhaPrazo[];
  contadores: {
    acoes: number;
    prazos: number;
    prazosVencidos: number;
  };
}

/** Janela de dias para mostrar prazos confirmados que se aproximam. */
export const JANELA_PRAZOS = 14;
export const PRAZO_PROXIMO = 3;

const VERBO: Partial<Record<Estado, string>> = {
  por_triar: "Triar documentos de",
  em_conferencia: "Conferir documentos de",
  a_aguardar_aprovacao: "Aprovar pedido a",
  resposta_por_conferir: "Conferir resposta de",
  completo: "Concluir processo de",
  envio_falhado: "Reenviar pedido a",
};

function primeiroNome(nome: string): string {
  return nome.split(" ")[0] ?? nome;
}

function textoFaltaCurto(p: ProcessoHoje): string {
  if (p.totalObrigatorios === 0) return "sem lista documental";
  if (p.falta === 0) return "nada em falta";
  return `falta ${p.falta} de ${p.totalObrigatorios}`;
}

export function linhaProcesso(p: ProcessoHoje, hoje: string): LinhaAcao | null {
  let verbo: string | undefined;
  let atrasada = false;

  if (p.estado === "a_aguardar_cliente") {
    if (!p.followUpOn || p.followUpOn > hoje) return null;
    verbo = "Fazer seguimento com";
    atrasada = p.followUpOn < hoje;
  } else if (equipaTemDeAgir(p.estado)) {
    verbo = VERBO[p.estado];
    atrasada = p.followUpOn !== null && p.followUpOn < hoje;
  }
  if (!verbo) return null;

  const partes = [
    `${verbo} ${p.clienteNome}`,
    p.reference,
    textoFaltaCurto(p),
    primeiroNome(p.responsavelNome),
  ];
  if (p.followUpOn) partes.push(`seguimento ${formatarDiaMes(p.followUpOn)}`);

  return {
    chave: `p:${p.id}`,
    tipo: "processo",
    verbo,
    texto: partes.join(" · "),
    href: `/processos/${p.id}`,
    responsavelId: p.responsavelId,
    atrasada,
  };
}

function linhaEmail(e: EmailPorTriar): LinhaAcao {
  const anexos = e.anexos === 1 ? "1 anexo" : `${e.anexos} anexos`;
  return {
    chave: `e:${e.id}`,
    tipo: "email",
    verbo: "Triar email de",
    texto: [
      `Triar email de ${e.remetente}`,
      e.assunto || "(sem assunto)",
      anexos,
      `recebido ${formatarDiaMes(e.recebidoEm)}`,
    ].join(" · "),
    href: `/triagem#email-${e.id}`,
    responsavelId: null,
    atrasada: false,
  };
}

function linhaPrazo(p: PrazoHoje, hoje: string): LinhaPrazo {
  const dias = diferencaDias(hoje, p.dueOn);
  let alerta: LinhaPrazo["alerta"] = null;
  if (p.status === "confirmado") {
    if (dias < 0) alerta = "vencido";
    else if (dias <= PRAZO_PROXIMO) alerta = "proximo";
  }
  const sufixo = p.status === "por_confirmar" ? " (por confirmar)" : "";
  return {
    id: p.id,
    texto: `${p.label}${sufixo} · ${p.clienteNome} · ${p.reference} · ${formatarDiaMes(p.dueOn)}`,
    href: `/processos/${p.matterId}#prazos`,
    dueOn: p.dueOn,
    diasEmFalta: dias,
    alerta,
  };
}

export function calcularHoje(input: {
  processos: ProcessoHoje[];
  emails: EmailPorTriar[];
  prazos: PrazoHoje[];
  hoje: string;
}): VistaHoje {
  const { hoje } = input;

  const comOrdem = input.processos
    .map((p) => ({ p, linha: linhaProcesso(p, hoje) }))
    .filter((x): x is { p: ProcessoHoje; linha: LinhaAcao } => x.linha !== null)
    .sort((a, b) => {
      if (a.linha.atrasada !== b.linha.atrasada) return a.linha.atrasada ? -1 : 1;
      return a.p.stateSince.localeCompare(b.p.stateSince);
    });

  const emails = [...input.emails]
    .sort((a, b) => a.recebidoEm.localeCompare(b.recebidoEm))
    .map(linhaEmail);

  const acoes = [...emails, ...comOrdem.map((x) => x.linha)];

  const confirmados = input.prazos
    .filter((p) => p.status === "confirmado")
    .filter((p) => diferencaDias(hoje, p.dueOn) <= JANELA_PRAZOS)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
    .map((p) => linhaPrazo(p, hoje));

  const porConfirmar = input.prazos
    .filter((p) => p.status === "por_confirmar")
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
    .map((p) => linhaPrazo(p, hoje));

  return {
    acoes,
    prazos: confirmados,
    prazosPorConfirmar: porConfirmar,
    contadores: {
      acoes: acoes.length,
      prazos: confirmados.length,
      prazosVencidos: confirmados.filter((p) => p.alerta === "vencido").length,
    },
  };
}
