"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { users } from "@/data/users";
import { useSession } from "@/hooks/useSession";

/**
 * Login mock. Qualquer credencial entra. A escolha de utilizador simula
 * sessões diferentes do escritório.
 *
 * SECURITY: substituir por Supabase Auth / Clerk. Não validar credenciais
 * no cliente em produção.
 */
export default function LoginPage() {
  const router = useRouter();
  const { login } = useSession();
  const [selected, setSelected] = useState(users[0].id);

  const enter = () => {
    login(selected);
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Painel de marca */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-bordeaux to-bordeaux-dark p-12 text-white lg:flex">
        <Logo className="[&_span]:text-white [&_.text-bordeaux]:text-white/70" />
        <div>
          <h1 className="text-3xl font-semibold leading-tight">
            Gestão inteligente de processos para solicitadoria.
          </h1>
          <p className="mt-4 max-w-md text-white/85">
            Organize clientes, prazos, documentos e tarefas num só lugar.
          </p>
        </div>
        <p className="text-sm text-white/70">
          © {new Date().getFullYear()} SolicitaFlow — Castelo Branco
        </p>
      </div>

      {/* Formulário */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-semibold text-ink">
            Entrar no escritório
          </h2>
          <p className="mt-1 text-sm text-muted">
            Selecione o seu perfil para entrar na demonstração.
          </p>

          <div className="mt-7 space-y-4">
            <div>
              <Label>Perfil do escritório</Label>
              <div className="space-y-2">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelected(u.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                      selected === u.id
                        ? "border-bordeaux bg-bordeaux/[0.04] ring-1 ring-bordeaux/20"
                        : "border-border bg-surface hover:border-bordeaux/30"
                    }`}
                  >
                    <Avatar userId={u.id} size="lg" />
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-ink">
                        {u.name}
                      </span>
                      <span className="block text-xs text-muted">
                        {u.email}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Palavra-passe</Label>
              <Input
                type="password"
                defaultValue="demo1234"
                placeholder="••••••••"
              />
              <p className="mt-1.5 flex items-center gap-1 text-xs text-muted">
                <Lock className="h-3 w-3" />
                Login de demonstração — qualquer palavra-passe é aceite.
              </p>
            </div>

            <Button onClick={enter} size="lg" className="w-full">
              Entrar
              <ArrowRight className="h-5 w-5" />
            </Button>

            <Link
              href="/"
              className="block text-center text-sm text-muted hover:text-bordeaux"
            >
              Voltar à página inicial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
