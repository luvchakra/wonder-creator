import { liveCards, recentHuddles } from "@wonder/creator-huddle";
import { selectMediaProvider } from "@wonder/creator-huddle/media";
import { BACKGROUNDS, BrandBackground, EmptyState, PageTitle, cn } from "@wonder/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { LiveHuddleCard } from "@/components/huddle/live-card";
import { after } from "next/server";
import { sweepStalePresence } from "@/lib/presence";
import { requireSession } from "@/lib/session";
import { StartHuddle, type RelatedStart } from "./start-huddle";
import { PaletteScope } from "@/components/creative-palette";

export const metadata = { title: "Huddles" };

export default async function HuddlesPage({ searchParams }: { searchParams: Promise<{ artifact?: string; material?: string; view?: string }> }) {
  const { db, creator } = await requireSession();
  const sp = await searchParams;
  // "Start a Huddle about this" from a piece or material you can see.
  const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
  const [art, mat] = await Promise.all([
    uuid(sp.artifact) ? db.from("artifacts").select("id, title").eq("id", uuid(sp.artifact)!).maybeSingle() : Promise.resolve({ data: null }),
    uuid(sp.material) ? db.from("creative_materials").select("id, title").eq("id", uuid(sp.material)!).eq("creator_id", creator.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const related: RelatedStart | null = art.data ? { kind: "artifact", id: art.data.id, title: art.data.title } : mat.data ? { kind: "material", id: mat.data.id, title: mat.data.title || "Your material" } : null;
  after(sweepStalePresence);
  const [huddles, recent] = await Promise.all([liveCards(db, { limit: 48 }), recentHuddles(db, 6)]);
  const mine = huddles.find((h) => h.viewerState === "joined");
  // Live now · My Huddles (UI redesign §30). Huddles are spontaneous, so there's no "Upcoming" to show, and the list is
  // never ranked by how many people are in a room.
  const view = sp.view === "mine" ? "mine" : "live";
  return (
    <>
      <PaletteScope context={{ page: "huddles" }} />
      <div className="space-y-8">
        <BrandBackground src={BACKGROUNDS.coastalVillage} overlay="cream" position="right center" className="-mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-3xl lg:px-10">
          <div className="py-8 lg:py-12">
            <PageTitle title="Live Huddles" subtitle="Spontaneous, temporary conversations between creators. Join one, or start your own." className="mb-4" />
            <StartHuddle currentHuddleId={mine?.huddleId ?? null} mediaConfigured={selectMediaProvider().configured} creatorName={creator.display_name} related={related} />
          </div>
        </BrandBackground>
        <nav aria-label="Huddle views" className="flex gap-2">
          {(
            [
              ["live", "Live now", "/huddles"],
              ["mine", "My Huddles", "/huddles?view=mine"],
            ] as const
          ).map(([k, label, href]) => (
            <Link
              key={k}
              href={href}
              aria-current={view === k ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium",
                view === k ? "bg-[image:var(--gradient-primary)] text-white shadow-[var(--shadow-glow)]" : "bg-surface text-accent-ink shadow-[0_3px_12px_-4px_rgb(107_91_149/0.16)] hover:bg-accent-softer",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        {view === "live" ? (
        <section aria-label="Live now">
          {huddles.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {huddles.map((h) => (
                <li key={h.huddleId}>
                  <LiveHuddleCard h={h} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState image={BACKGROUNDS.pastelClouds} title="No one is live right now" body="Start a Huddle and creators who are around can ask to join. It ends by itself when everyone leaves." />
          )}
        </section>
        ) : null}
        {view === "mine" && mine ? (
          <section aria-label="You're in">
            <h2 className="mb-3 text-lg font-semibold text-ink">You&rsquo;re in</h2>
            <LiveHuddleCard h={mine} />
          </section>
        ) : null}
        {view === "mine" && !recent.length && !mine ? (
          <EmptyState title="No Huddles yet" body="Huddles you join show up here afterwards, with who you met and anything you saved." />
        ) : null}
        {view === "mine" && recent.length ? (
          <section aria-labelledby="recent-h">
            <h2 id="recent-h" className="mb-3 text-lg font-semibold text-ink">
              Your recent Huddles
            </h2>
            <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface">
              {recent.map((h) => (
                <li key={h.huddleId}>
                  <Link href={`/huddles/${h.huddleId}/summary`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 hover:bg-black/[0.02]">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] text-ink">{h.topic ? `Talking about ${h.topic}` : "A Huddle"}</span>
                      <span className="text-sm text-ink-muted">
                        <time dateTime={h.joinedAt}>{new Date(h.joinedAt).toLocaleDateString("en", { day: "numeric", month: "short" })}</time> · met {h.metCount} {h.metCount === 1 ? "creator" : "creators"}
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
