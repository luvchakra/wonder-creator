import { greetingFor } from "@wonder/core";
import { liveCards } from "@wonder/creator-huddle";
import { listMaterials, signedUrlsFor } from "@wonder/creator-library";
import { BACKGROUNDS, BrandBackground, SectionHeader } from "@wonder/ui";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { ArtifactCard, MaterialCard } from "@/components/cards";
import { LiveHuddleCard } from "@/components/huddle/live-card";
import { coverUrls } from "@/lib/covers";
import { after } from "next/server";
import { sweepStalePresence } from "@/lib/presence";
import { requireSession } from "@/lib/session";
import { HomeComposer } from "./home-composer";

export const metadata = { title: "Home" };

const POSSIBILITIES = [
  { label: "Short Film", prompt: "Help me turn this into a short film." },
  { label: "Poem", prompt: "Turn this into a poem." },
  { label: "Visual Story", prompt: "Create a visual story from this." },
  { label: "Song", prompt: "Write a song from this." },
  { label: "Documentary", prompt: "Shape this into a documentary treatment." },
  { label: "Social Series", prompt: "Make a social series from this." },
];

export default async function HomePage() {
  const { db, creator } = await requireSession();
  after(sweepStalePresence);
  const [artifactsRes, materials, live, proposals] = await Promise.all([
    db.from("artifacts").select("id, title, artifact_type, status, updated_at, cover_material_id").eq("creator_id", creator.id).neq("status", "archived").order("updated_at", { ascending: false }).limit(6),
    listMaterials(db, { limit: 6 }),
    liveCards(db, { limit: 6 }),
    db.from("ai_proposals").select("id", { count: "exact", head: true }).eq("status", "pending").gt("expires_at", new Date().toISOString()),
  ]);
  const artifacts = artifactsRes.data ?? [];
  const [covers, previews] = await Promise.all([coverUrls(db, artifacts), signedUrlsFor(db, materials.map((m) => m.storage_object_id))]);
  const first = (creator.display_name || "Creator").split(" ")[0];
  const journey = [
    ...artifacts.map((a) => ({ kind: "artifact" as const, at: a.updated_at, a })),
    ...materials.map((m) => ({ kind: "material" as const, at: m.created_at, m })),
  ]
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, 8);

  return (
    <div className="space-y-10">
      <BrandBackground src={BACKGROUNDS.botanicalLeaves} overlay="cream" position="right center" className="-mx-4 rounded-none px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-3xl lg:px-10">
        <section className="grid gap-8 py-8 [&>*]:min-w-0 lg:grid-cols-[1fr_1.35fr] lg:items-center lg:py-12" aria-labelledby="greeting">
          <div>
            <h1 id="greeting" className="text-ink">
              <span className="block font-display text-2xl italic text-ink-muted sm:text-3xl">{greetingFor(new Date())},</span>
              <span className="mt-1 block break-words font-display text-5xl leading-none sm:text-6xl">{first}</span>
            </h1>
            <p className="mt-5 max-w-sm font-display text-lg italic leading-relaxed text-ink-muted">
              “Every thought, every reference, every conversation can become something extraordinary.”
            </p>
          </div>
          <HomeComposer />
        </section>
      </BrandBackground>

      {proposals.count ? (
        <Link href="/approvals" className="flex items-center gap-3 rounded-2xl border border-[#cfd0ff] bg-accent-softer px-4 py-3 text-[15px] text-ink hover:bg-accent-soft">
          <Sparkles className="size-5 text-accent-ink" aria-hidden />
          CreatorBrain has {proposals.count} {proposals.count === 1 ? "proposal" : "proposals"} waiting for your approval.
        </Link>
      ) : null}

      <section>
        <SectionHeader title="Continue your creative journey" action={journey.length ? <Link href="/space" className="text-sm font-medium text-accent-ink hover:underline">View all</Link> : undefined} />
        {journey.length ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {journey.map((j) => (
              <li key={j.kind === "artifact" ? `a${j.a.id}` : `m${j.m.id}`}>
                {j.kind === "artifact" ? <ArtifactCard a={{ ...j.a, coverUrl: covers[j.a.id] ?? null }} /> : <MaterialCard m={{ ...j.m, previewUrl: j.m.storage_object_id ? previews[j.m.storage_object_id] : null }} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-surface/70 px-5 py-8 text-center text-ink-muted">
            Nothing here yet. Bring an idea, photograph, note or voice memo — it will appear here.
          </p>
        )}
      </section>

      {live.length ? (
        <section>
          <SectionHeader title="Live now" action={<Link href="/huddles" className="text-sm font-medium text-accent-ink hover:underline">All Huddles</Link>} />
          <ul className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
            {live.slice(0, 3).map((h) => (
              <li key={h.huddleId} className="w-72 shrink-0 sm:w-auto">
                <LiveHuddleCard h={h} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="explore" className="rounded-3xl border border-border-soft bg-surface p-5 sm:p-6">
        <h2 id="explore" className="text-lg font-semibold text-ink">
          Explore new possibilities
        </h2>
        <p className="mt-1 text-sm text-ink-muted">CreatorBrain can help you explore different directions from your existing ideas.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {POSSIBILITIES.map((p) => (
            <Link key={p.label} href={`/create?prompt=${encodeURIComponent(p.prompt)}`} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm text-ink-muted hover:border-accent hover:text-accent-ink">
              {p.label}
            </Link>
          ))}
          <Link href="/create/discover" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent-soft px-4 text-sm font-medium text-accent-ink hover:bg-[#e4e4ff]">
            <Sparkles className="size-4" aria-hidden /> Surprise me
          </Link>
        </div>
      </section>
    </div>
  );
}
