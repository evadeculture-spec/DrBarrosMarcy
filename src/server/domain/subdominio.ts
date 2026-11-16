/**
 * Resolve o escritório a partir do endereço pedido.
 *
 *   escritorio.localhost:3000      → "escritorio"
 *   escritorio.<APP_BASE_DOMAIN>   → "escritorio"
 *   localhost, IP, *.vercel.app    → escritório por omissão (se configurado)
 */
export function slugDoHost(
  host: string | null | undefined,
  opcoes: { dominioBase?: string | null; omissao?: string | null },
): string | null {
  const omissao = opcoes.omissao || null;
  if (!host) return omissao;
  const semPorta = host.toLowerCase().replace(/:\d+$/, "");
  const valido = (s: string) => /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(s);

  if (semPorta.endsWith(".localhost")) {
    const s = semPorta.slice(0, -".localhost".length);
    return valido(s) ? s : null;
  }
  const base = opcoes.dominioBase?.toLowerCase();
  if (base && semPorta.endsWith(`.${base}`)) {
    const s = semPorta.slice(0, -(base.length + 1));
    return valido(s) ? s : null;
  }
  if (base && semPorta === base) return omissao;
  return omissao;
}
