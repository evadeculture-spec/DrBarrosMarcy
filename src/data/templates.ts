import type { EmailTemplate } from "@/types";

/**
 * Templates de email do escritório. As variáveis entre [PARÊNTESES] são
 * substituídas ao gerar a mensagem para um processo concreto.
 */
export const emailTemplates: EmailTemplate[] = [
  {
    id: "tpl-pedido-documentos",
    key: "pedido_documentos",
    name: "Pedido de documentos",
    subject: "Documentos necessários para o processo",
    variables: ["NOME", "TIPO_PROCESSO", "DOCUMENTOS_EM_FALTA", "RESPONSAVEL"],
    body: `Exmo./Exma. Senhor/a [NOME],

No âmbito do processo [TIPO_PROCESSO], vimos solicitar o envio dos seguintes documentos:

[DOCUMENTOS_EM_FALTA]

Solicitamos, por favor, que os documentos sejam enviados em formato digitalizado, legível e completo.

Com os melhores cumprimentos,
[RESPONSAVEL]`,
  },
  {
    id: "tpl-confirmacao-rececao",
    key: "confirmacao_rececao",
    name: "Confirmação de receção",
    subject: "Confirmação de receção de documentos",
    variables: ["NOME", "TIPO_PROCESSO", "RESPONSAVEL"],
    body: `Exmo./Exma. Senhor/a [NOME],

Confirmamos a boa receção dos documentos enviados no âmbito do processo [TIPO_PROCESSO].

Iremos proceder à respetiva análise e contactá-lo/a caso seja necessária informação adicional.

Com os melhores cumprimentos,
[RESPONSAVEL]`,
  },
  {
    id: "tpl-pedido-assinatura",
    key: "pedido_assinatura",
    name: "Pedido de assinatura de procuração",
    subject: "Procuração para assinatura",
    variables: ["NOME", "RESPONSAVEL"],
    body: `Exmo./Exma. Senhor/a [NOME],

Segue em anexo a procuração para a sua assinatura.

Agradecemos que assine nos campos assinalados e nos devolva o documento digitalizado. Caso necessite de reconhecimento de assinatura, informamos com todo o gosto sobre o procedimento.

Com os melhores cumprimentos,
[RESPONSAVEL]`,
  },
  {
    id: "tpl-pedido-pagamento",
    key: "pedido_pagamento",
    name: "Pedido de pagamento",
    subject: "Honorários do processo",
    variables: ["NOME", "TIPO_PROCESSO", "VALOR", "RESPONSAVEL"],
    body: `Exmo./Exma. Senhor/a [NOME],

Relativamente ao processo [TIPO_PROCESSO], informamos que se encontra pendente o pagamento de honorários no valor de [VALOR].

Para o efeito, poderá proceder ao pagamento por transferência bancária para o IBAN do escritório. Após a transferência, agradecemos o envio do respetivo comprovativo.

Com os melhores cumprimentos,
[RESPONSAVEL]`,
  },
  {
    id: "tpl-processo-concluido",
    key: "processo_concluido",
    name: "Processo concluído",
    subject: "Processo concluído",
    variables: ["NOME", "TIPO_PROCESSO", "RESPONSAVEL"],
    body: `Exmo./Exma. Senhor/a [NOME],

Temos o prazer de informar que o processo [TIPO_PROCESSO] foi concluído com sucesso.

Ficamos à inteira disposição para qualquer esclarecimento adicional e agradecemos a confiança depositada no nosso escritório.

Com os melhores cumprimentos,
[RESPONSAVEL]`,
  },
];

export function getTemplate(key: string): EmailTemplate | undefined {
  return emailTemplates.find((t) => t.key === key);
}
