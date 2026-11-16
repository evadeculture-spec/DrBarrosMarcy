import { NextResponse, type NextRequest } from "next/server";
import { slugDoHost } from "@/server/domain/subdominio";

/**
 * Resolve o escritório pelo subdomínio e passa-o às páginas num cabeçalho
 * interno. O cabeçalho vindo do browser é sempre descartado.
 */
export function middleware(req: NextRequest) {
  const slug = slugDoHost(req.headers.get("host"), {
    dominioBase: process.env.APP_BASE_DOMAIN,
    omissao: process.env.DEFAULT_ORG_SLUG,
  });
  const headers = new Headers(req.headers);
  headers.delete("x-sf-escritorio");
  if (slug) headers.set("x-sf-escritorio", slug);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "same-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
