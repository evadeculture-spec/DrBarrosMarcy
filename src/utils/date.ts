/**
 * Utilitários de data em português de Portugal.
 * Sem dependências externas para manter o bundle leve.
 */

const MONTHS_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** "hoje" às 00:00 — útil para comparações de prazos. */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parse(date: string | Date): Date {
  return typeof date === "string" ? new Date(date) : date;
}

/** Ex.: "14 jun 2026" */
export function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  const d = parse(date);
  return `${d.getDate()} ${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}`;
}

/** Ex.: "14 jun, 09:30" */
export function formatDateTime(date: string | Date | null): string {
  if (!date) return "—";
  const d = parse(date);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS_PT[d.getMonth()]}, ${hh}:${mm}`;
}

/** Diferença em dias inteiros entre uma data e hoje (negativo = passado). */
export function daysFromToday(date: string | Date | null): number | null {
  if (!date) return null;
  const target = parse(date);
  target.setHours(0, 0, 0, 0);
  const diff = target.getTime() - startOfToday().getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function isOverdue(date: string | Date | null): boolean {
  const days = daysFromToday(date);
  return days !== null && days < 0;
}

export function isToday(date: string | Date | null): boolean {
  return daysFromToday(date) === 0;
}

export function isThisWeek(date: string | Date | null): boolean {
  const days = daysFromToday(date);
  return days !== null && days >= 0 && days <= 7;
}

/** Texto relativo amigável, ex. "vencido há 3 dias", "hoje", "em 2 dias". */
export function relativeDeadline(date: string | Date | null): string {
  const days = daysFromToday(date);
  if (days === null) return "Sem prazo";
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  if (days === -1) return "Vencido ontem";
  if (days < 0) return `Vencido há ${Math.abs(days)} dias`;
  return `Em ${days} dias`;
}

/** "há 4 dias", "há 2 meses" — para timelines e "em falta desde". */
export function timeAgo(date: string | Date | null): string {
  if (!date) return "—";
  const days = Math.abs(daysFromToday(date) ?? 0);
  if (days === 0) return "hoje";
  if (days === 1) return "há 1 dia";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  if (months === 1) return "há 1 mês";
  return `há ${months} meses`;
}
