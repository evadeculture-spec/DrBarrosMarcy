import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-bordeaux text-white shadow-sm">
        <Scale className="h-5 w-5" />
      </span>
      {showText && (
        <span className="text-lg font-semibold tracking-tight text-ink">
          Solicita<span className="text-bordeaux">Flow</span>
        </span>
      )}
    </span>
  );
}
