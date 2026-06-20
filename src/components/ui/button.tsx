import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-bordeaux text-white hover:bg-bordeaux-hover shadow-sm active:bg-bordeaux-dark",
  secondary:
    "bg-bordeaux/10 text-bordeaux hover:bg-bordeaux/15 active:bg-bordeaux/20",
  outline:
    "border border-border bg-surface text-ink hover:bg-background hover:border-bordeaux/30",
  ghost: "text-ink hover:bg-bordeaux/5 hover:text-bordeaux",
  danger: "bg-danger text-white hover:bg-red-700 shadow-sm",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  icon: "h-10 w-10",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-ring disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
