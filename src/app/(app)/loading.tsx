export default function Carregando() {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">A carregar…</span>
      <div className="h-7 w-48 animate-pulse rounded-lg bg-border" />
      <div className="h-4 w-72 animate-pulse rounded bg-border/70" />
      <div className="mt-6 space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-surface shadow-card" />
        ))}
      </div>
    </div>
  );
}
