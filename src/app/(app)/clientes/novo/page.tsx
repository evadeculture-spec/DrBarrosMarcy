import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { exigirSessao } from "@/server/sessao";
import { FormCliente } from "../FormCliente";

export const metadata = { title: "Novo cliente" };

export default async function NovoClientePage() {
  await exigirSessao();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/clientes" className="inline-flex min-h-[44px] items-center gap-1.5 rounded text-sm text-muted hover:text-bordeaux focus-ring">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Clientes
      </Link>
      <h1 className="text-2xl font-semibold text-ink">Novo cliente</h1>
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <FormCliente inicial={{ nome: "", email: "", telefone: "", nif: "", localidade: "", morada: "", notas: "" }} />
      </div>
    </div>
  );
}
