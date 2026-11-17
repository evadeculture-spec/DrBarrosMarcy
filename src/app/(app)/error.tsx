"use client";

import { Button } from "@/components/ui/button";

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-2xl border border-red-300 bg-surface p-6 text-center">
      <h1 className="text-lg font-semibold text-ink">Não foi possível carregar esta página</h1>
      <p className="mt-2 text-sm text-muted">
        Pode ser uma falha momentânea de ligação. Nada do que estava a fazer foi perdido.
      </p>
      <Button className="mt-5" onClick={reset}>
        Tentar de novo
      </Button>
    </div>
  );
}
