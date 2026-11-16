import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { escritorioAtual, sessaoAtual } from "@/server/sessao";
import { FormEntrar } from "./FormEntrar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar" };

export default async function EntrarPage() {
  if (await sessaoAtual()) redirect("/hoje");
  const escritorio = await escritorioAtual();
  const demo = process.env.DEMO_MOSTRAR_CONTAS === "1" && escritorio?.slug === "demo";

  return (
    <main id="conteudo" className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo />
        {escritorio ? (
          <>
            <h1 className="mt-8 text-2xl font-semibold text-ink">Entrar</h1>
            <p className="mt-1 text-sm text-muted">{escritorio.name}</p>
            <FormEntrar />
            {demo && (
              <div className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm text-ink">
                <p className="font-medium">Contas de demonstração</p>
                <ul className="mt-2 space-y-1 text-muted">
                  <li>ines@demo.example.pt — administradora</li>
                  <li>marcia@demo.example.pt — solicitadora</li>
                  <li>tiago@demo.example.pt — triagem</li>
                </ul>
                <p className="mt-2 text-muted">Palavra-passe: a definida em SEED_DEMO_PASSWORD.</p>
              </div>
            )}
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
