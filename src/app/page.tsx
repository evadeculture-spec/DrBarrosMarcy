"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileWarning,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Hoje no escritório",
    text: "Veja num relance o que precisa da sua atenção: prazos, processos parados e tarefas.",
  },
  {
    icon: FileWarning,
    title: "Documentos em falta",
    text: "Saiba exatamente que cliente contactar e gere o email de pedido num clique.",
  },
  {
    icon: CalendarClock,
    title: "Prazos sob controlo",
    text: "Prazos vencidos destacados a vermelho. Nada passa ao lado.",
  },
  {
    icon: ShieldCheck,
    title: "Rigor e confiança",
    text: "Estrutura pensada para RGPD, com separação de dados por escritório.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Cabeçalho */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <Link href="/login">
          <Button variant="outline">Entrar no escritório</Button>
        </Link>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.6]"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(127,29,29,0.08) 0%, rgba(250,250,249,0) 70%)",
          }}
        />
        <div className="mx-auto max-w-4xl px-6 py-20 text-center sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-bordeaux shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-bordeaux" />
            Para escritórios de solicitadoria em Portugal
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Gestão inteligente de processos
            <br className="hidden sm:block" /> para solicitadoria.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
            Organize clientes, prazos, documentos e tarefas num só lugar.
            Simples, rápido e desenhado para o dia a dia do escritório.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login">
              <Button size="lg" className="w-full sm:w-auto">
                Entrar no escritório
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Ver demonstração
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">
            MVP com dados de demonstração — sem necessidade de registo.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-surface p-5 shadow-card transition-shadow hover:shadow-card-hover"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-bordeaux/10 text-bordeaux">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{f.text}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-bordeaux to-bordeaux-dark p-8 text-white sm:p-12">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-semibold">
                Tudo o que o escritório precisa, num só fluxo.
              </h2>
              <ul className="mt-4 space-y-2 text-white/90">
                {[
                  "Processos em tabela e pipeline kanban",
                  "Checklists automáticas por tipo de processo",
                  "Templates de email prontos a usar",
                  "Importação rápida por CSV",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-white/80" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <Link href="/login">
              <Button
                size="lg"
                className="bg-white text-bordeaux hover:bg-white/90"
              >
                Começar agora
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-muted sm:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} SolicitaFlow — Castelo Branco</p>
        </div>
      </footer>
    </div>
  );
}
