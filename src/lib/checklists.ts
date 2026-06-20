/**
 * Checklists automáticas geradas ao criar um processo, por tipo.
 * Configuráveis no futuro a partir das Configurações do escritório.
 */
import type { ChecklistItem, MatterType } from "@/types";

type ChecklistTemplate = { label: string; required: boolean }[];

export const CHECKLIST_TEMPLATES: Record<MatterType, ChecklistTemplate> = {
  nif: [
    { label: "Passaporte", required: true },
    { label: "Comprovativo de morada", required: true },
    { label: "Nacionalidade", required: true },
    { label: "País de residência", required: true },
    { label: "Representante fiscal", required: true },
    { label: "Procuração assinada", required: true },
    { label: "Comprovativo de pagamento", required: true },
  ],
  registo_predial: [
    { label: "Certidão permanente", required: true },
    { label: "Caderneta predial", required: true },
    { label: "Documento de identificação", required: true },
    { label: "Título/escritura", required: true },
    { label: "Comprovativo de pagamento", required: true },
    { label: "Requerimento", required: true },
  ],
  heranca: [
    { label: "Certidão de óbito", required: true },
    { label: "Habilitação de herdeiros", required: true },
    { label: "Identificação dos herdeiros", required: true },
    { label: "Relação de bens", required: true },
    { label: "Certidões prediais/matriciais", required: true },
    { label: "Procurações (se aplicável)", required: false },
  ],
  procuracao: [
    { label: "Documento de identificação do mandante", required: true },
    { label: "Dados do mandatário", required: true },
    { label: "Definição de poderes", required: true },
    { label: "Minuta revista", required: true },
    { label: "Comprovativo de pagamento", required: false },
  ],
  escritura: [
    { label: "Documentos de identificação das partes", required: true },
    { label: "Certidão permanente do imóvel", required: true },
    { label: "Caderneta predial", required: true },
    { label: "Licença de utilização", required: true },
    { label: "Comprovativo de pagamento de IMT", required: true },
    { label: "Comprovativo de pagamento", required: true },
  ],
  arrendamento: [
    { label: "Documento de identificação do senhorio", required: true },
    { label: "Documento de identificação do inquilino", required: true },
    { label: "Caderneta predial urbana", required: true },
    { label: "Minuta do contrato", required: true },
    { label: "Comprovativo de pagamento", required: false },
  ],
  certidao: [
    { label: "Identificação do requerente", required: true },
    { label: "Dados do prédio/registo", required: true },
    { label: "Comprovativo de pagamento de taxa", required: true },
  ],
  outro: [
    { label: "Documento de identificação", required: true },
    { label: "Comprovativo de pagamento", required: false },
  ],
};

let checklistCounter = 0;

/** Gera os itens de checklist para um novo processo de um dado tipo. */
export function generateChecklist(type: MatterType): ChecklistItem[] {
  return CHECKLIST_TEMPLATES[type].map((item) => ({
    id: `chk-gen-${Date.now()}-${checklistCounter++}`,
    label: item.label,
    required: item.required,
    status: "pendente",
  }));
}
