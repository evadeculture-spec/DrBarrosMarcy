import type { EmailTemplate, Matter } from "@/types";
import { clientName, getClient } from "@/data/clients";
import { userName } from "@/data/users";
import { MATTER_TYPES } from "@/lib/constants";
import { missingChecklistItems } from "@/lib/selectors";
import { formatCurrency } from "@/lib/utils";

/**
 * Preenche as variáveis [VAR] de um template com os dados de um processo.
 * Variáveis sem valor mantêm o placeholder para edição manual.
 */
export function fillTemplate(
  template: EmailTemplate,
  matter?: Matter,
): { subject: string; body: string } {
  const values: Record<string, string> = {};

  if (matter) {
    values.NOME = clientName(matter.clientId);
    values.TIPO_PROCESSO = MATTER_TYPES[matter.type].label;
    values.RESPONSAVEL = userName(matter.assigneeId);
    values.VALOR = formatCurrency(matter.fee);
    values.DOCUMENTOS_EM_FALTA = missingChecklistItems(matter)
      .map((i) => `• ${i.label}`)
      .join("\n");
    const client = getClient(matter.clientId);
    if (client) values.EMAIL = client.email;
  }

  const replace = (text: string) =>
    text.replace(/\[([A-Z_]+)\]/g, (match, key: string) =>
      values[key] !== undefined && values[key] !== ""
        ? values[key]
        : match,
    );

  return { subject: replace(template.subject), body: replace(template.body) };
}
