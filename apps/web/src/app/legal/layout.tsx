import { KIT, KitArt, Logo } from "@wonder/ui";
import Link from "next/link";
import type { ReactNode } from "react";

const LINKS = [
  ["/legal/privacy", "Privacy notice"],
  ["/legal/terms", "Terms"],
  ["/legal/subprocessors", "Subprocessors"],
  ["/legal/security", "Security"],
] as const;

/** Public legal pages: readable editorial layout, no sign-in needed. */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#f8f3ea] text-ink">
      <KitArt art={KIT.painted.leafSprigSage} sizes="10rem" className="pointer-events-none absolute -right-6 top-6 h-40 w-auto opacity-50" />
      <header className="relative mx-auto flex max-w-3xl flex-col gap-1 px-5 pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <Link href="/" aria-label="Wonder Creator home">
          <Logo height={32} />
        </Link>
        <nav aria-label="Legal" className="-mx-5 flex gap-x-4 overflow-x-auto whitespace-nowrap px-5 text-[13px] text-ink-muted sm:mx-0 sm:px-0">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="inline-flex min-h-11 items-center hover:underline">
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main id="main" className="relative mx-auto max-w-3xl px-5 pb-20 pt-8 [&_h1]:font-display [&_h1]:text-[34px] [&_h1]:leading-tight [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-[21px] [&_li]:mt-1 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:mt-3 [&_table]:w-full [&_td]:border-t [&_td]:border-[#e6dccb] [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_th]:pb-1 [&_th]:pr-3 [&_th]:text-left [&_th]:text-[13px] [&_th]:font-semibold">
        {children}
      </main>
    </div>
  );
}
