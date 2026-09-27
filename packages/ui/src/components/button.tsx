import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "../cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors select-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:cursor-not-allowed " +
  "motion-safe:active:scale-[0.98] motion-safe:transition-transform";

const variants: Record<Variant, string> = {
  // Vector Kit: a violet gradient pill with a soft glow; secondary is a white pill with a lilac edge.
  primary: "bg-[image:var(--gradient-primary)] bg-[length:200%_100%] bg-left text-white shadow-[var(--shadow-glow)] hover:bg-right motion-safe:transition-[background-position,transform] motion-safe:duration-300",
  secondary: "bg-surface text-accent-ink border border-border-soft shadow-[0_3px_12px_-4px_rgb(107_91_149/0.14)] hover:bg-accent-softer",
  soft: "bg-accent-soft text-accent-ink hover:bg-[#e6e0ff]",
  ghost: "text-ink-muted hover:bg-black/[0.04]",
  danger: "bg-danger text-white hover:bg-[#b91c1c]",
};

const sizes: Record<Size, string> = {
  // Compact visual (36px) inside a 44px hit area (compact-density §6).
  sm: "relative h-9 px-3.5 text-sm min-w-9 before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']",
  md: "h-11 px-5 text-[15px] min-w-11",
  lg: "h-12 px-6 text-base min-w-12",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

export function buttonClasses(opts: { variant?: Variant; size?: Size; className?: string } = {}): string {
  return cn(base, variants[opts.variant ?? "primary"], sizes[opts.size ?? "md"], opts.className);
}

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: "ghost" | "soft" | "surface" | "stage";
}

/** Icon-only action. `label` is required and becomes the accessible name and tooltip. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "ghost", className, children, type = "button", ...props },
  ref,
) {
  const v = {
    ghost: "text-ink-muted hover:bg-black/[0.05]",
    soft: "bg-accent-soft text-accent-ink hover:bg-[#e6e0ff]",
    surface: "bg-surface text-accent-ink shadow-[0_4px_14px_-4px_rgb(107_91_149/0.18)] hover:bg-accent-softer",
    stage: "bg-white/10 text-white hover:bg-white/20",
  }[variant];
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50",
        v,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
