import { testimonialsOf } from "@wonder/creator-identity";
import type { Db } from "@wonder/db";
import { Avatar } from "@wonder/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { avatarUrls } from "@/lib/avatars";
import { SectionTitle } from "./section-title";

const ROWS = 3;

/**
 * My Testimonials on Home (owner, 3 Oct 2026: "dedicated and fixed sections for my communities, my scrapbook, my
 * testimonials"). A fixed section: the latest notes others wrote about the creator that they chose to show, one row
 * each, then a row for the ones waiting on them, then "All testimonials" (the Profile, where they decide). No counts
 * of anything but what waits; never ranked (docs/testimonials.md).
 */
export async function HomeTestimonials({ db, creator }: { db: Db; creator: { id: string; handle: string | null } }) {
  const all = await testimonialsOf(db, creator.id).catch(() => []);
  const shown = all.filter((t) => t.status === "shown").slice(0, ROWS);
  const waiting = all.filter((t) => t.status === "pending").length;
  const avatars = await avatarUrls(db, shown.map((t) => t.from.id)).catch(() => ({}) as Record<string, string>);
  const profile = creator.handle ? `/creators/${creator.handle}` : "/me";

  return (
    <section aria-labelledby="home-testimonials-title">
      <SectionTitle id="home-testimonials-title" href={`${profile}?tab=community#testimonials`}>
        My Testimonials
      </SectionTitle>
      <div className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface/90 shadow-[var(--shadow-card)]">
        {shown.length ? (
          <ul aria-label="Testimonials you show" className="divide-y divide-border-soft">
            {shown.map((t) => (
              <li key={t.id}>
                <Link href={`${profile}?tab=community#testimonials`} className="flex min-h-11 items-center gap-2 px-3 py-1.5 hover:bg-surface-muted">
                  <Avatar name={t.from.name} src={avatars[t.from.id]} size={24} />
                  <span className="min-w-0 flex-1 truncate font-display text-[15px] italic leading-snug text-ink">{t.body}</span>
                  <span className="shrink-0 text-[11.5px] text-ink-subtle">{t.from.name.split(" ")[0]}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-2 text-[12.5px] text-ink-subtle">{waiting ? "Nothing shown yet." : "Nobody has written one yet. Testimonials are short notes others write about you."}</p>
        )}
        {waiting ? (
          <Link href="/me" className="flex min-h-11 items-center gap-2.5 px-3 py-1.5 text-[13.5px] text-ink hover:bg-surface-muted">
            <span className="min-w-0 flex-1">
              {waiting === 1 ? "1 testimonial" : `${waiting} testimonials`} waiting for you <span className="text-ink-subtle">· show or keep private</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-accent" aria-hidden />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
