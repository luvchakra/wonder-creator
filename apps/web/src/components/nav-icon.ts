import { cn } from "@wonder/ui";

/**
 * The top bar's round icon buttons (search, Messages, notifications, your account) share one look, and one way of
 * showing they're pressed (owner, 3 Oct 2026): a soft accent disc with the icon in accent ink while the thing they
 * open is open or the page they lead to is the current one, and a brief press-down while the finger is on them.
 * Radix sets `data-state="open"` on menu and popover triggers, so those need no extra prop.
 */
export function navIconClass(active?: boolean, className?: string): string {
  return cn(
    "relative inline-flex size-11 items-center justify-center rounded-full text-ink-muted transition-[background-color,transform] duration-150 motion-reduce:transition-none",
    "hover:bg-black/[0.04] active:scale-90 focus-visible:outline-2 focus-visible:outline-accent",
    "data-[state=open]:bg-accent-soft data-[state=open]:text-accent-ink",
    active && "bg-accent-soft text-accent-ink",
    className,
  );
}
