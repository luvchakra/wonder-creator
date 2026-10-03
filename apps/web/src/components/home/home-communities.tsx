import { KIT, KitArt } from "@wonder/ui";
import { ChevronRight, Lock } from "lucide-react";
import Link from "next/link";
import { CommunityAvatar } from "@/components/community/community-art";
import type { HomePayload } from "@/lib/home/payload";

type Mine = NonNullable<HomePayload["communities"]>["mine"];

/**
 * Communities on Home (owner, 3 Oct 2026: "make communities easier to find from home", and "Worth hearing" became
 * "Communities"). One surface: what's new in a community (the row passed in), the creator's own communities as a row
 * of faces, and Discover. With none yet, one quiet invitation instead. No counts, no ranking.
 */
export function HomeCommunities({ mine, hearing }: { mine: Mine | null; hearing: React.ReactNode }) {
  const none = !mine?.length;
  return (
    <section id="communities" aria-labelledby="communities-title" className="relative isolate scroll-mt-20 overflow-hidden rounded-2xl border border-border-soft bg-surface/90 shadow-[var(--shadow-card)]">
      {/* A botanical in the negative space on wider screens, as on the other Home cards. Decoration only. */}
      {none ? null : <KitArt art={KIT.painted.leafSprigSage} sizes="7rem" className="pointer-events-none absolute -bottom-3 right-2 -z-10 hidden h-24 w-auto opacity-60 sm:block" />}
      <div className="flex items-center justify-between pl-3 pr-1.5">
        <h2 id="communities-title" className="py-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
          Communities
        </h2>
        {none ? null : (
          <Link href="/pulse?filter=communities" className="inline-flex min-h-11 items-center gap-0.5 px-1.5 text-[13px] font-medium text-accent-ink hover:underline">
            Discover <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {hearing}
      {none ? (
        <Link href="/pulse?filter=communities" className="relative flex min-h-16 items-center gap-3 overflow-hidden px-3 pb-2.5 pt-1 hover:bg-surface-muted">
          <KitArt art={KIT.painted.lavenderSprig} sizes="3rem" className="pointer-events-none h-12 w-auto shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[16px] leading-snug text-ink">Find people who make what you make</span>
            <span className="block text-[12.5px] text-ink-muted">Join a community, or start one of your own</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
        </Link>
      ) : (
        <ul aria-label="Your communities" className="flex gap-1 overflow-x-auto px-1.5 pb-2 pt-0.5 [scrollbar-width:none]">
          {mine!.map((c) => (
            <li key={c.id} className="shrink-0">
              <Link href={`/communities/${c.id}`} className="flex w-[4.75rem] flex-col items-center gap-1 rounded-xl px-1 py-1.5 hover:bg-surface-muted">
                <span className="relative">
                  <CommunityAvatar id={c.id} title={c.title} src={c.picture} size={52} className="shadow-[0_4px_14px_-6px_rgb(30_27_75/0.35)]" />
                  {c.privacy === "private" ? (
                    <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-surface text-ink-muted ring-1 ring-border-soft">
                      <Lock className="size-3" aria-hidden />
                    </span>
                  ) : null}
                </span>
                <span className="line-clamp-2 w-full text-center text-[12px] leading-tight text-ink">
                  {c.title}
                  {c.privacy === "private" ? <span className="sr-only"> (private)</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
