import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { escritorioAtual, sessaoAtual } from "@/server/sessao";
import { CONTAS_DEMO, entradaRapidaAtiva } from "@/server/contas-demo";
import { EntradaRapida } from "./EntradaRapida";
import { FormEntrar } from "./FormEntrar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar" };

export default async function EntrarPage() {
  if (await sessaoAtual()) redirect("/hoje");
  const escritorio = await escritorioAtual();
  const demo = entradaRapidaAtiva(escritorio?.slug);

  return (
    <main id="conteudo" className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo />
        {escritorio ? (
          <>
            <h1 className="mt-8 text-2xl font-semibold text-ink">Entrar</h1>
            <p className="mt-1 text-sm text-muted">{escritorio.name}</p>
            {demo && (
              <>
                <EntradaRapida contas={[...CONTAS_DEMO]} />
                <p className="mt-6 text-center text-xs uppercase tracking-wide text-muted">ou entre com email</p>
              </>
            )}
            <FormEntrar />
          </>
        ) : (
          <div className="mt-8 rounded-xl border border-border bg-surface p-5">
            <h1 className="text-lg font-semibold text-ink">Escritório não encontrado</h1>
            <p className="mt-2 text-sm text-muted">
              Este endereço não corresponde a nenhum escritório ativo. Confirme o endereço que lhe foi
              enviado (por exemplo, <span className="font-mono">o-seu-escritorio.solicitaflow.pt</span>).
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
