import { greetingFor } from "@wonder/core";
import { liveCards } from "@wonder/creator-huddle";
import { listMaterials, signedUrlsFor } from "@wonder/creator-library";
import { artifactType } from "@wonder/creator-studio/types";
import { BACKGROUNDS, CreativeMindInsight, Watercolor } from "@wonder/ui";
import Link from "next/link";
import { MaterialCard } from "@/components/cards";
import { LiveHuddleCard } from "@/components/huddle/live-card";
import { preloadWatercolor } from "@/lib/brand-preload";
import { coverUrls } from "@/lib/covers";
import { after } from "next/server";
import { sweepStalePresence } from "@/lib/presence";
import { requireSession } from "@/lib/session";
import { HomeBegin } from "./home-begin";
import { PaletteScope } from "@/components/creative-palette";

export const metadata = { title: "Home" };

const STATUS_LABEL: Record<string, string> = { draft: "In Progress", in_review: "In Review", final: "Completed", published: "Published" };

/**
 * The Home Canvas (UI redesign §8): "What are you exploring or creating right now?" — a greeting, the Creation you're
 * in the middle of, one honest CreativeMind moment, your recent Materials and at most one more thing. Not a dashboard;
 * everything else is in the Palette.
 */
const CORNER_SIZES = "(min-width: 640px) 11rem, 8.5rem";

export default async function HomePage() {
  const { db, creator } = await requireSession();
  preloadWatercolor("cornerTopRight", CORNER_SIZES);
  after(sweepStalePresence);
  const [current, materials, live, proposals] = await Promise.all([
    db.from("artifacts").select("id, title, artifact_type, status, updated_at, cover_material_id, description").eq("creator_id", creator.id).neq("status", "archived").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    listMaterials(db, { limit: 8 }),
    liveCards(db, { limit: 3 }),
    db.from("ai_proposals").select("id", { count: "exact", head: true }).eq("status", "pending").gt("expires_at", new Date().toISOString()),
  ]);
  const creation = current.data;
  const [covers, previews, quality] = await Promise.all([
    creation ? coverUrls(db, [creation]) : Promise.resolve({} as Record<string, string>),
    signedUrlsFor(db, materials.map((m) => m.storage_object_id)),
    creation ? db.from("quality_reports").select("suggestions, created_at").eq("artifact_id", creation.id).order("created_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const first = (creator.display_name || "Creator").split(" ")[0];
  const cover = creation ? covers[creation.id] : null;

  // One honest CreativeMind moment: waiting approvals, then CreativeMind's own suggestion, then a plain fact.
  const suggestion = ((quality.data?.suggestions ?? []) as Array<{ title?: string; detail?: string }>).find((s) => s.title || s.detail);
  const newSince = creation ? materials.filter((m) => m.created_at > creation.updated_at).length : 0;
  const insight = proposals.count ? (
    <CreativeMindInsight kind="waiting" action={<Link href="/approvals" className="inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">{proposals.count} {proposals.count === 1 ? "proposal" : "proposals"} waiting for your approval</Link>}>
      CreativeMind has something ready and won&rsquo;t act until you say so.
    </CreativeMindInsight>
  ) : creation && suggestion ? (
    <CreativeMindInsight kind="insight" action={<Link href={`/artifacts/${creation.id}/studio`} className="inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">Refine in the Creative Studio</Link>}>
      {suggestion.title ? <span className="font-medium">{suggestion.title}. </span> : null}
      {suggestion.detail}
    </CreativeMindInsight>
  ) : creation && newSince ? (
    <CreativeMindInsight kind="noticed" action={<Link href={`/create?artifact=${creation.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">Bring them into “{creation.title}”</Link>}>
      You&rsquo;ve brought in {newSince} new {newSince === 1 ? "material" : "materials"} since you last worked on “{creation.title}”.
    </CreativeMindInsight>
  ) : null;

  return (
    <>
      <PaletteScope context={{ page: "home", strip: { continueTitle: creation && (creation.status === "draft" || creation.status === "in_review") ? creation.title : null } }} />
      <div className="mx-auto max-w-3xl space-y-7">
        <header className="relative isolate">
          {/* The one decoration on Home (§46): a supplied floral corner behind the greeting, never over a control. */}
          <Watercolor name="cornerTopRight" sizes={CORNER_SIZES} priority className="pointer-events-none absolute -right-4 -top-3 -z-10 h-auto w-[8.5rem] opacity-90 sm:-right-2 sm:w-[11rem]" />
          <h1 className="pr-24 text-ink sm:pr-40">
            <span className="block font-display text-2xl italic text-ink-muted sm:text-3xl">{greetingFor(new Date())},</span>
            <span className="mt-1 block break-words font-display text-5xl leading-none sm:text-6xl">{first}</span>
          </h1>
        </header>

        {creation ? (
          <Link href={`/artifacts/${creation.id}`} aria-label={`Continue ${creation.title}`} className="group relative block overflow-hidden rounded-3xl shadow-[var(--shadow-lift)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover ?? BACKGROUNDS.sunsetCoast} alt="" className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none sm:aspect-[16/10]" />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/75 via-navy/15 to-transparent" aria-hidden />
            <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
              <p className="text-sm text-white/85">Continue</p>
              <p className="font-display text-3xl leading-tight sm:text-4xl">{creation.title}</p>
              <p className="mt-1 text-sm text-white/85">
                {artifactType(creation.artifact_type).label} · {STATUS_LABEL[creation.status] ?? creation.status}
              </p>
            </div>
          </Link>
        ) : (
          <HomeBegin hasMaterials={materials.length > 0} />
        )}

        {insight}

        {materials.length ? (
          <section aria-labelledby="recent-materials">
            <div className="mb-2 flex items-center justify-between">
              <h2 id="recent-materials" className="text-lg font-semibold text-ink">
                Recent Materials
              </h2>
              <Link href="/space?tab=ideas" className="inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">
                See all
              </Link>
            </div>
            <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:px-0">
              {materials.map((m) => (
                <li key={m.id} className="w-40 shrink-0 snap-start sm:w-44">
                  <MaterialCard m={{ ...m, previewUrl: m.storage_object_id ? (previews[m.storage_object_id] ?? null) : null }} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {live[0] ? (
          <section aria-labelledby="live-now">
            <h2 id="live-now" className="mb-2 text-lg font-semibold text-ink">
              Live now
            </h2>
            <LiveHuddleCard h={live[0]} />
          </section>
        ) : null}
      </div>
    </>
  );
}
