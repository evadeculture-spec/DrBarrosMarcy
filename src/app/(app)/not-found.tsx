import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-surface p-6 text-center">
      <h1 className="text-lg font-semibold text-ink">Não encontrado</h1>
      <p className="mt-2 text-sm text-muted">Este registo não existe ou não pertence ao seu escritório.</p>
      <Link href="/hoje" className="mt-5 inline-block text-sm font-medium text-bordeaux underline focus-ring">
        Voltar a Hoje
      </Link>
    </div>
  );
}
