import type { BrandSummary, PublicCollaborationProfile } from "@wonder/creator-identity";
import { EXCLUSIVITY, WORK_MODES } from "@wonder/creator-identity/collaboration-options";
import { KIT, KitArt, cn } from "@wonder/ui";
import { BookmarkPlus, Briefcase, ChevronDown, HeartHandshake, Layers, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ProfileCreation } from "./creations";
import { IconTile, SectionHead, TILE, Tag, surface } from "./shared";

/** Painted washes from the Vector Kit for a series without a picture yet (supplied art, never generated). */
const WASHES = [KIT.wash.washLavender, KIT.wash.washPeach, KIT.wash.washLilacSky, KIT.wash.washRose];

export interface ScrapbookGlimpse {
  id: string;
  imageUrl: string | null;
  text: string;
}

/**
 * The Overview tab — identity at a glance: About, brand openness, selected series, recent Scrapbook moments and how
 * they like to collaborate. Longer detail opens in place rather than on another page.
 */
export function OverviewTab({ base, isMe, about, brand, collab, series, glimpses, before, after }: { base: string; isMe: boolean; about: { lines: string[]; skills: string[]; openTo: string[] }; brand: BrandSummary | null; collab: PublicCollaborationProfile | null; series: ProfileCreation[]; glimpses: ScrapbookGlimpse[]; before?: ReactNode; after?: ReactNode }) {
  const showCollab = collab && (collab.hasProfile || isMe) && collab.availability !== "closed";
  const hasAbout = about.lines.length || about.skills.length || about.openTo.length;
  return (
    <div className="space-y-2.5">
      {hasAbout || isMe ? (
        <section aria-label="About" className={cn(surface, "relative min-h-[92px] overflow-hidden px-3 py-2.5")}>
          <KitArt art={KIT.painted.leafSprigSage} sizes="5rem" className="pointer-events-none absolute -bottom-4 right-1 h-[4.5rem] w-auto opacity-75" />
          <SectionHead icon={<UserRound aria-hidden />} title="About" href={isMe ? "/settings" : undefined} linkLabel="Edit" />
          <div className="relative pl-[38px] pr-16">
            {about.lines.map((l) => (
              <p key={l} className="text-[13px] leading-snug text-ink-muted">
                {l}
              </p>
            ))}
            {!hasAbout ? <p className="text-[13px] text-ink-subtle">Add your crafts, languages and skills in Settings.</p> : null}
            {about.skills.length ? (
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                {about.skills.slice(0, 6).map((s) => (
                  <Tag key={s}>{s}</Tag>
                ))}
              </p>
            ) : null}
            {about.openTo.length ? (
              <p aria-label="Open to" className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-ink-muted">
                <span className="font-medium text-accent-ink">Open to </span>
                {about.openTo.join(" · ")}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {before}

      {brand ? (
        <Disclosure icon={<Briefcase aria-hidden />} tone="peach" art={KIT.painted.coastalVignette} title="Open to brand work" summary={[...brand.deliverables, ...brand.platforms].slice(0, 4).join(" · ") || "Brand collaborations and commissions."}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
            {(
              [
                ["Niches", brand.niches],
                ["Industries", brand.industries],
                ["Platforms", brand.platforms],
                ["Makes", brand.deliverables],
              ] as const
            )
              .filter(([, v]) => v.length)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-ink-subtle">{k}</dt>
                  <dd className="text-ink">{v.join(", ")}</dd>
                </div>
              ))}
          </dl>
        </Disclosure>
      ) : null}

      {series.length ? (
        <section aria-label="Selected series" className={cn(surface, "px-3 py-2.5")}>
          <SectionHead icon={<Layers aria-hidden />} title="Selected series" href={`${base}?tab=creations&shelf=series`} />
          <ul className="mt-1.5 grid grid-cols-3 gap-2">
            {series.slice(0, 3).map((c, i) => (
              <li key={c.id}>
                <Link href={`/artifacts/${c.id}`} className="group block">
                  {c.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.coverUrl} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" />
                  ) : (
                    <span className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-accent-softer">
                      <KitArt art={WASHES[i % WASHES.length]!} sizes="8rem" className="absolute inset-0 size-full object-cover" />
                      <Layers className="relative size-5 text-accent-ink/70" aria-hidden />
                    </span>
                  )}
                  <span className="mt-1 block truncate text-[13px] font-medium text-ink group-hover:underline">{c.title}</span>
                  {c.meta ? <span className="block truncate text-[11.5px] text-ink-subtle">{c.meta}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {glimpses.length ? (
        <section aria-label="Recent scrapbook moments" className={cn(surface, "px-3 py-2.5")}>
          <SectionHead icon={<BookmarkPlus aria-hidden />} tone="peach" title="Recent scrapbook moments" href={`${base}?tab=moments`} />
          <ul className="mt-1.5 grid grid-cols-4 gap-1.5">
            {glimpses.slice(0, 4).map((g) => (
              <li key={g.id}>
                <Link href={`/scrapbook/${g.id}`} className="block" aria-label={g.text || "A moment"}>
                  {g.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.imageUrl} alt="" loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
                  ) : (
                    <span className="flex aspect-square items-center rounded-lg bg-[#f8f3ea] p-1.5 font-display text-[11px] italic leading-tight text-ink">
                      <span className="line-clamp-4">{g.text}</span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {after}

      {showCollab ? (
        <Disclosure icon={<HeartHandshake aria-hidden />} tone="teal" art={KIT.painted.flowerBranch} title={isMe ? "How you collaborate" : "Collaboration style"} summary={collabSummary(collab)} edit={isMe ? "/settings?section=collaboration" : undefined}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
            {collabRows(collab).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-subtle">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {collab.contactPreference === "network" && !isMe ? <p className="mt-2 text-[12.5px] text-ink-muted">Takes messages and invitations from people they&rsquo;ve worked with.</p> : null}
        </Disclosure>
      ) : null}
    </div>
  );
}

function collabSummary(p: PublicCollaborationProfile): string {
  const mode = WORK_MODES.find((m) => m.value === p.workMode)?.label ?? p.workMode;
  return [p.interests.slice(0, 2).join(", "), mode, p.turnaround].filter(Boolean).join(" · ") || "How they like to work together.";
}

/** Only what the creator filled in; rate guidance only when they chose to show it (P1-14). */
function collabRows(p: PublicCollaborationProfile): Array<[string, string]> {
  const rows: Array<[string, string | null | undefined]> = [
    ["Project types", p.projectTypes.join(", ")],
    ["Interested in", p.interests.join(", ")],
    ["Works", `${WORK_MODES.find((m) => m.value === p.workMode)?.label ?? p.workMode}${p.region ? ` · ${p.region}` : ""}`],
    ["Typical turnaround", p.turnaround],
    ["Exclusivity", EXCLUSIVITY.find((m) => m.value === p.exclusivity)?.label ?? p.exclusivity],
    ["Won't take on", p.commercialBoundaries],
    ["Rights", p.rightsPreferences],
    ["Rate guidance", p.rateGuidance],
  ];
  return rows.filter((r): r is [string, string] => !!r[1]);
}

/** A compact row that opens in place (progressive disclosure, compact-density §15), with the board's painted accent. */
function Disclosure({ icon, tone, art, title, summary, edit, children }: { icon: ReactNode; tone: keyof typeof TILE; art: Parameters<typeof KitArt>[0]["art"]; title: string; summary: string; edit?: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <details className={cn(surface, "group relative overflow-hidden px-3 py-1")}>
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2.5 [&::-webkit-details-marker]:hidden">
          <IconTile tone={tone}>{icon}</IconTile>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-ink">{title}</span>
            <span className="line-clamp-2 text-[12.5px] leading-snug text-ink-muted">{summary}</span>
          </span>
          <KitArt art={art} sizes="5rem" className="pointer-events-none h-12 w-auto shrink-0 opacity-90 group-open:hidden max-[359px]:hidden" />
          <ChevronDown className="size-4 shrink-0 text-ink-subtle transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
        </summary>
        <div className="pb-2.5 pl-[38px]">
          {children}
          {edit ? (
            <Link href={edit} className="mt-1 inline-flex min-h-11 items-center text-[13px] font-medium text-accent-ink hover:underline">
              Edit
            </Link>
          ) : null}
        </div>
      </details>
    </section>
  );
}
