"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarCheck, FolderOpen, Inbox, LogOut, Mail, Menu, Plus, Search, Settings, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { sairAcao } from "../entrar/acoes";

const NAV = [
  { href: "/hoje", rotulo: "Hoje", Icone: CalendarCheck },
  { href: "/triagem", rotulo: "Triagem", Icone: Inbox },
  { href: "/processos", rotulo: "Processos", Icone: FolderOpen },
  { href: "/modelos", rotulo: "Modelos", Icone: Mail },
  { href: "/configuracoes", rotulo: "Configurações", Icone: Settings },
];

export function Shell({
  children,
  escritorio,
  utilizador,
  porTriar,
}: {
  children: React.ReactNode;
  escritorio: string;
  utilizador: { nome: string; papel: string };
  porTriar: number;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  useEffect(() => setAberto(false), [pathname]);

  const nav = (
    <nav aria-label="Principal" className="flex-1 space-y-1 px-3 py-2">
      {NAV.map(({ href, rotulo, Icone }) => {
        const ativo = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-ring",
              ativo ? "bg-bordeaux text-white" : "text-ink hover:bg-bordeaux/[0.06] hover:text-bordeaux",
            )}
          >
            <Icone aria-hidden className="h-[18px] w-[18px] shrink-0" />
            <span className="flex-1">{rotulo}</span>
            {href === "/triagem" && porTriar > 0 && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  ativo ? "bg-white/20 text-white" : "bg-bordeaux/10 text-bordeaux",
                )}
              >
                {porTriar}
                <span className="sr-only"> anexos por triar</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const rodape = (
    <div className="border-t border-border p-4">
      <p className="truncate text-sm font-medium text-ink">{utilizador.nome}</p>
      <p className="truncate text-xs text-muted">
        {utilizador.papel} · {escritorio}
      </p>
      <form action={sairAcao} className="mt-3">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-md text-sm text-muted hover:text-bordeaux focus-ring"
        >
          <LogOut aria-hidden className="h-4 w-4" /> Sair
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-card-hover"
      >
        Saltar para o conteúdo
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/hoje" className="rounded-lg focus-ring" aria-label="SolicitaFlow — Hoje">
            <Logo />
          </Link>
        </div>
        {nav}
        {rodape}
      </aside>

      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setAberto(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl">
            <div className="flex h-16 items-center justify-between px-5">
              <Logo />
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-lg p-2 text-muted hover:bg-background focus-ring"
                aria-label="Fechar menu"
                autoFocus
              >
                <X aria-hidden className="h-5 w-5" />
              </button>
            </div>
            {nav}
            {rodape}
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur lg:px-8">
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="rounded-lg p-2 text-ink hover:bg-background focus-ring lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu aria-hidden className="h-5 w-5" />
          </button>
          <form action="/pesquisa" role="search" className="relative flex-1 max-w-md">
            <label htmlFor="pesquisa-global" className="sr-only">
              Pesquisar processos, clientes e emails
            </label>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              id="pesquisa-global"
              name="q"
              type="search"
              placeholder="Pesquisar processo, cliente ou email"
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-ink placeholder:text-muted focus-ring"
            />
          </form>
          <Link
            href="/processos/novo"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-bordeaux px-3 text-sm font-medium text-white hover:bg-bordeaux-hover focus-ring sm:px-4"
          >
            <Plus aria-hidden className="h-4 w-4" />
            <span className="hidden sm:inline">Novo processo</span>
            <span className="sr-only sm:hidden">Novo processo</span>
          </Link>
        </header>
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 outline-none lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
