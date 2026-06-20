import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "danger" | "warning" | "success";

const tones: Record<StatTone, { icon: string; value: string }> = {
  default: { icon: "bg-bordeaux/10 text-bordeaux", value: "text-ink" },
  danger: { icon: "bg-red-50 text-danger", value: "text-danger" },
  warning: { icon: "bg-amber-50 text-warning", value: "text-warning" },
  success: { icon: "bg-green-50 text-success", value: "text-success" },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  href,
  hint,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: StatTone;
  href?: string;
  hint?: string;
}) {
  const t = tones[tone];
  const inner = (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className={cn("mt-1 text-2xl font-semibold tabular-nums", t.value)}>
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <span
        className={cn(
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          t.icon,
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-ring rounded-2xl">
        {inner}
      </Link>
    );
  }
  return inner;
}
