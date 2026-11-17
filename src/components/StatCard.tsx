import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "danger" | "warning" | "success";

const tons: Record<StatTone, { icon: string; value: string }> = {
  default: { icon: "bg-bordeaux/10 text-bordeaux", value: "text-ink" },
  danger: { icon: "bg-red-50 text-red-700", value: "text-red-700" },
  warning: { icon: "bg-amber-50 text-amber-800", value: "text-amber-800" },
  success: { icon: "bg-green-50 text-green-800", value: "text-green-800" },
};

/** Cartão de indicador: é sempre um atalho para a lista que explica o número. */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  href,
  descricao,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: StatTone;
  href: string;
  descricao: string;
}) {
  const t = tons[tone];
  return (
    <Link
      href={href}
      data-indicador={label}
      title={descricao}
      className="group block rounded-2xl focus-ring"
    >
      <div className="flex h-full items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card transition-shadow group-hover:shadow-card-hover sm:p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className={cn("mt-1 text-3xl font-semibold tabular-nums", t.value)}>{value}</p>
          <p className="sr-only">{descricao}</p>
        </div>
        <span aria-hidden className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", t.icon)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Link>
  );
}
