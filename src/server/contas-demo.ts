/**
 * Entrada rápida da demonstração: só existe com DEMO_ENTRADA_RAPIDA=1 e no
 * escritório «demo». A lista é fixa — nenhum outro email entra sem palavra-passe.
 */
export const CONTAS_DEMO = [
  { email: "joao@demo.example.pt", nome: "João Barros", papel: "Administrador" },
  { email: "marcia@demo.example.pt", nome: "Márcia Raposo", papel: "Solicitadora" },
  { email: "carolina@demo.example.pt", nome: "Carolina Folgado", papel: "Solicitadora" },
] as const;

export const ESCRITORIO_DEMO = "demo";

export function entradaRapidaAtiva(slug: string | undefined | null): boolean {
  return process.env.DEMO_ENTRADA_RAPIDA === "1" && slug === ESCRITORIO_DEMO;
}
