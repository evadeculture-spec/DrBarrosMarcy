/**
 * Faixa da ficha do processo:
 *   «Falta: N documentos · Aguarda: <quem> desde <data> · Responsável: <nome>»
 *
 * Tudo o que a faixa diz é calculado aqui, a partir do estado do processo
 * e da lista documental. É a resposta, em 30 segundos, a «o que falta, quem
 * tem de agir e desde quando».
 */
import { formatarData } from "./datas";
import type { Estado } from "./estados";

export type EstadoItem = "em_falta" | "recebido" | "conferido" | "rejeitado";

export interface ItemResumo {
  required: boolean;
  status: EstadoItem;
}

export interface DadosFaixa {
  estado: Estado;
  /** Instante em que o processo entrou no estado atual. */
  desde: string | Date;
  responsavel: string;
  cliente: string;
  itens: ItemResumo[];
}

export interface Faixa {
  /** Itens obrigatórios em falta ou rejeitados. */
  falta: number;
  /** Itens obrigatórios recebidos mas ainda não conferidos. */
  porConferir: number;
  totalObrigatorios: number;
  /** Quem tem de agir agora. */
  aguarda: string;
  /** Tipo de quem age, para ícone e leitores de ecrã. */
  aguardaTipo: "equipa" | "aprovador" | "cliente" | "ninguem";
  desde: string;
  responsavel: string;
  proximoPasso: string;
  texto: string;
}

export function contarItens(itens: ItemResumo[]) {
  const obrigatorios = itens.filter((i) => i.required);
  return {
    totalObrigatorios: obrigatorios.length,
    falta: obrigatorios.filter(
      (i) => i.status === "em_falta" || i.status === "rejeitado",
    ).length,
    porConferir: obrigatorios.filter((i) => i.status === "recebido").length,
  };
}

export function textoFalta(n: number): string {
  if (n === 0) return "nada";
  return n === 1 ? "1 documento" : `${n} documentos`;
}

const PROXIMO_PASSO: Record<Estado, string> = {
  por_triar: "Triar os documentos recebidos e iniciar a conferência.",
  em_conferencia: "Conferir os documentos e pedir ao cliente o que falta.",
  a_aguardar_aprovacao: "Um solicitador tem de aprovar o pedido ao cliente.",
  a_aguardar_cliente: "Esperar pela resposta do cliente ou fazer seguimento.",
  resposta_por_conferir: "Conferir a resposta do cliente.",
  completo: "Rever e concluir o processo.",
  concluido: "Nada a fazer.",
  envio_falhado: "O envio do pedido falhou: reenviar ou cancelar.",
};

export function calcularFaixa(d: DadosFaixa): Faixa {
  const { falta, porConferir, totalObrigatorios } = contarItens(d.itens);

  let aguarda: string;
  let aguardaTipo: Faixa["aguardaTipo"];
  switch (d.estado) {
    case "por_triar":
      aguarda = "Triagem";
      aguardaTipo = "equipa";
      break;
    case "a_aguardar_aprovacao":
      aguarda = "aprovação de um solicitador";
      aguardaTipo = "aprovador";
      break;
    case "a_aguardar_cliente":
      aguarda = `${d.cliente} (cliente)`;
      aguardaTipo = "cliente";
      break;
    case "concluido":
      aguarda = "ninguém";
      aguardaTipo = "ninguem";
      break;
    default:
      aguarda = d.responsavel;
      aguardaTipo = "equipa";
  }

  const desde = formatarData(d.desde);
  const texto =
    `Falta: ${textoFalta(falta)} · ` +
    `Aguarda: ${aguarda}${aguardaTipo === "ninguem" ? "" : ` desde ${desde}`} · ` +
    `Responsável: ${d.responsavel}`;

  return {
    falta,
    porConferir,
    totalObrigatorios,
    aguarda,
    aguardaTipo,
    desde,
    responsavel: d.responsavel,
    proximoPasso: PROXIMO_PASSO[d.estado],
    texto,
  };
}
