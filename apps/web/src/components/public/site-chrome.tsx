import { Logo } from "@wonder/ui";
import Link from "next/link";

/**
 * The public site's header and footer (landing, About, Contact). Signed-out pages: one quiet Sign in in the header,
 * and a compact footer whose links go to real pages only.
 */
export function SiteHeader() {
  return (
    <header className="relative z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),1rem)] sm:px-6">
        <Link href="/" aria-label="Wonder Creator home" className="inline-flex min-h-11 items-center">
          <Logo height={34} />
        </Link>
        <Link href="/sign-in" className="inline-flex min-h-11 items-center rounded-full px-3 text-[14px] font-medium text-ink hover:bg-white/60">
          Sign in
        </Link>
      </div>
    </header>
  );
}

const COLUMNS: Array<{ label: string; title: string; links: Array<[string, string]> }> = [
  {
    label: "Wonder Creator",
    title: "Wonder Creator",
    links: [
      ["/sign-up", "Start Creating"],
      ["/sign-in", "Sign in"],
      ["/about", "About"],
      ["/contact", "Contact"],
    ],
  },
  {
    label: "Legal",
    title: "Trust",
    links: [
      ["/legal/privacy", "Privacy notice"],
      ["/legal/security", "Security"],
      ["/legal/terms", "Terms"],
      ["/legal/subprocessors", "Data & subprocessors"],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-border-soft/80 bg-cream">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-[1.4fr_1fr_1fr] sm:px-6">
        <div>
          <Logo height={28} />
          <p className="mt-2 max-w-xs text-[13px] leading-snug text-ink-muted">A personal creative universe, where ordinary days become Creations.</p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.label} aria-label={c.label} className="text-[13px]">
            <p className="font-medium text-ink">{c.title}</p>
            <ul className="mt-1">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="inline-flex min-h-9 items-center text-ink-muted hover:text-ink hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] text-[12px] text-ink-subtle sm:px-6">© {new Date().getFullYear()} Wonder Creator</p>
    </footer>
  );
}

/** A configured contact (mailto: or https:, or a bare email address) as a link target and a readable label. */
export function contactLink(value: string | undefined): { href: string; label: string } | null {
  const v = value?.trim();
  if (!v) return null;
  if (/^mailto:/i.test(v)) return { href: v, label: v.replace(/^mailto:/i, "") };
  if (/^https:\/\//i.test(v)) return { href: v, label: v.replace(/^https:\/\//i, "").replace(/\/$/, "") };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { href: `mailto:${v}`, label: v };
  return null;
}
