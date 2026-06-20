import { cn } from "@/lib/utils";
import { getUser } from "@/data/users";

export function Avatar({
  userId,
  size = "md",
  className,
}: {
  userId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const user = getUser(userId);
  const sizes = {
    sm: "h-6 w-6 text-[10px]",
    md: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
  };
  return (
    <span
      title={user?.name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        user?.color ?? "bg-muted",
        sizes[size],
        className,
      )}
    >
      {user?.initials ?? "?"}
    </span>
  );
}
