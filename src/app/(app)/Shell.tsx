"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckSquare,
  FileSpreadsheet,
  FileText,
  FileWarning,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Plus,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { sairAcao } from "../entrar/acoes";

const NAV = [
  { href: "/dashboard", rotulo: "Dashboard", Icone: LayoutDashboard },
  { href: "/processos", rotulo: "Processos", Icone: FileText },
  { href: "/clientes", rotulo: "Clientes", Icone: Users },
  { href: "/tarefas", rotulo: "Tarefas", Icone: CheckSquare },
  { href: "/documentos", rotulo: "Documentos em falta", Icone: FileWarning },
  { href: "/templates", rotulo: "Templates", Icone: Mail },
  { href: "/importar", rotulo: "Importar", Icone: FileSpreadsheet },
  { href: "/configuracoes", rotulo: "Configurações", Icone: Settings },
];

export interface NotificacaoUI {
  id: string;
  texto: string;
  href: string;
}

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export function Shell({
  children,
  escritorio,
  utilizador,
  notificacoes,
}: {
  children: React.ReactNode;
  escritorio: { nome: string; local: string };
  utilizador: { nome: string; papel: string; email: string };
  notificacoes: NotificacaoUI[];
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [sino, setSino] = useState(false);
  const [menuUtilizador, setMenuUtilizador] = useState(false);
  const pesquisa = useRef<HTMLInputElement>(null);
  const zonaSino = useRef<HTMLDivElement>(null);
  const zonaUtilizador = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAberto(false);
    setSino(false);
    setMenuUtilizador(false);
  }, [pathname]);

  // Atalho de pesquisa: ⌘K / Ctrl+K ou «/».
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      const aEscrever = /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable;
      if ((e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !aEscrever)) {
        e.preventDefault();
        pesquisa.current?.focus();
        pesquisa.current?.select();
      }
      if (e.key === "Escape") {
        setSino(false);
        setMenuUtilizador(false);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  // Fechar menus ao clicar fora.
  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (zonaSino.current && !zonaSino.current.contains(e.target as Node)) setSino(false);
      if (zonaUtilizador.current && !zonaUtilizador.current.contains(e.target as Node)) setMenuUtilizador(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const nav = (
    <nav aria-label="Principal" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
      {NAV.map(({ href, rotulo, Icone }) => {
        const ativo = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors focus-ring",
              ativo ? "bg-bordeaux text-white shadow-sm" : "text-ink/85 hover:bg-bordeaux/[0.06] hover:text-bordeaux",
            )}
          >
            <Icone aria-hidden className="h-[18px] w-[18px] shrink-0" />
            <span className="flex-1">{rotulo}</span>
          </Link>
        );
      })}
    </nav>
  );

  const rodape = (
    <div className="border-t border-border px-5 py-4">
      <p className="truncate text-sm font-medium text-ink">{escritorio.nome}</p>
      <p className="truncate text-xs text-muted">{escritorio.local}</p>
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

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard" className="rounded-lg focus-ring" aria-label="SolicitaFlow — Dashboard">
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
                className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-background focus-ring"
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

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur sm:gap-3 sm:px-4 lg:px-8">
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-background focus-ring lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu aria-hidden className="h-5 w-5" />
          </button>
          <form action="/pesquisa" role="search" className="relative min-w-0 flex-1 lg:max-w-md">
            <label htmlFor="pesquisa-global" className="sr-only">
              Pesquisar no escritório
            </label>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              ref={pesquisa}
              id="pesquisa-global"
              name="q"
              type="search"
              autoComplete="off"
              placeholder="Pesquisar no escritório…"
              className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-12 text-sm text-ink placeholder:text-muted focus-ring"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted sm:inline">
              ⌘K
            </kbd>
          </form>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:ml-auto">
            <Link
              href="/processos/novo"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-bordeaux px-3 text-sm font-medium text-white hover:bg-bordeaux-hover focus-ring sm:px-4"
            >
              <Plus aria-hidden className="h-4 w-4" />
              <span className="hidden sm:inline">Novo processo</span>
              <span className="sr-only sm:hidden">Novo processo</span>
            </Link>

            <div ref={zonaSino} className="relative">
              <button
                type="button"
                onClick={() => setSino((v) => !v)}
                aria-expanded={sino}
                aria-haspopup="true"
                aria-label={`Notificações (${notificacoes.length})`}
                className="relative flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-background focus-ring"
              >
                <Bell aria-hidden className="h-5 w-5" />
                {notificacoes.length > 0 && (
                  <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                    {notificacoes.length > 9 ? "9+" : notificacoes.length}
                  </span>
                )}
              </button>
              {sino && (
                <div className="absolute right-0 top-12 z-30 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-card-hover animate-scale-in">
                  <p className="border-b border-border px-4 py-3 text-sm font-semibold text-ink">Notificações</p>
                  {notificacoes.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-muted">Sem notificações. Está tudo em dia.</p>
                  ) : (
                    <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                      {notificacoes.map((n) => (
                        <li key={n.id}>
                          <Link href={n.href} className="block px-4 py-3 text-sm text-ink hover:bg-background focus-ring">
                            {n.texto}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div ref={zonaUtilizador} className="relative">
              <button
                type="button"
                onClick={() => setMenuUtilizador((v) => !v)}
                aria-expanded={menuUtilizador}
                aria-haspopup="true"
                aria-label={`Utilizador: ${utilizador.nome}`}
                className="flex h-11 w-11 items-center justify-center rounded-full focus-ring"
              >
                <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-bordeaux text-xs font-semibold text-white">
                  {iniciais(utilizador.nome)}
                </span>
              </button>
              {menuUtilizador && (
                <div className="absolute right-0 top-12 z-30 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-card-hover animate-scale-in">
                  <div className="border-b border-border p-3">
                    <p className="text-sm font-medium text-ink">{utilizador.nome}</p>
                    <p className="text-xs text-muted">{utilizador.papel} · {utilizador.email}</p>
                  </div>
                  <div className="p-1.5">
                    <Link href="/configuracoes#t-conta" className="flex min-h-[44px] items-center rounded-lg px-3 text-sm text-ink hover:bg-background focus-ring">
                      A minha conta
                    </Link>
                    <form action={sairAcao}>
                      <button type="submit" className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 text-sm text-red-800 hover:bg-red-50 focus-ring">
                        <LogOut aria-hidden className="h-4 w-4" /> Terminar sessão
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-7xl px-3 py-5 outline-none sm:px-4 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
