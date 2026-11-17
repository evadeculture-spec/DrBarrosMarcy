/**
 * Datas no fuso de Lisboa. "Hoje" é sempre o dia civil em Portugal
 * continental, independentemente do fuso do servidor.
 */
export const FUSO = "Europe/Lisbon";

/** "AAAA-MM-DD" do dia civil em Lisboa para o instante dado. */
export function diaLisboa(instante: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
  return partes; // en-CA já dá AAAA-MM-DD
}

/** Soma dias a uma data "AAAA-MM-DD". */
export function somarDias(dia: string, dias: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return t.toISOString().slice(0, 10);
}

/** Diferença em dias (b - a) entre duas datas "AAAA-MM-DD". */
export function diferencaDias(a: string, b: string): number {
  const pa = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const pb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((pb - pa) / 86_400_000);
}

/** "16/11/2026" */
export function formatarData(valor: string | Date): string {
  const dia = typeof valor === "string" && valor.length === 10
    ? valor
    : diaLisboa(new Date(valor));
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
}

/** "16/11" */
export function formatarDiaMes(valor: string | Date): string {
  return formatarData(valor).slice(0, 5);
}

/** "16/11/2026, 14:05" */
export function formatarDataHora(valor: string | Date): string {
  const d = new Date(valor);
  const hora = new Intl.DateTimeFormat("pt-PT", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${formatarData(d)}, ${hora}`;
}

/** "hoje", "ontem", "há 3 dias" — relativo a `hoje`. */
export function haQuantoTempo(valor: string | Date, hoje: string): string {
  const dia = typeof valor === "string" && valor.length === 10
    ? valor
    : diaLisboa(new Date(valor));
  const n = diferencaDias(dia, hoje);
  if (n <= 0) return "hoje";
  if (n === 1) return "ontem";
  return `há ${n} dias`;
}
