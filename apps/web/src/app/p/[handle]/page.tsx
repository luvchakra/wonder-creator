import { OPEN_TO_LABEL, type OpenTo } from "@wonder/creator-community/shared";
import type { PublicationExperience } from "@wonder/creator-studio/publish";
import { Avatar } from "@wonder/ui";
import { ChevronRight, ExternalLink, MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkCard } from "@/components/publish/work-page";
import { loadCreatorPage, siteOrigin, type PublicCreatorPage } from "@/lib/public-pages";

type Params = { params: Promise<{ handle: string }>; searchParams: Promise<{ kind?: string }> };

/**
 * The Creator Page (docs/creator-publish.md §2.1, §16): the creator's curated public home — only what they chose to
 * show, in the order they chose. Never a mirror of the in-app Profile; no follower counts or popularity (§21, §38).
 */
export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const page = await loadCreatorPage(handle);
  if (!page) return { title: "Not found", robots: { index: false } };
  const description = page.headline || page.creator.bio || `Creations by ${page.creator.name}`;
  return {
    title: { absolute: `${page.creator.name} · Wonder Creator` },
    description,
    metadataBase: new URL(await siteOrigin()),
    alternates: { canonical: `/p/${page.creator.handle}` },
    openGraph: { title: page.creator.name, description, url: `/p/${page.creator.handle}`, siteName: "Wonder Creator", type: "profile" },
  };
}

export default async function CreatorPage({ params, searchParams }: Params) {
  const { handle } = await params;
  const { kind } = await searchParams;
  const page = await loadCreatorPage(handle);
  if (!page) notFound();
  const on = page.sections.filter((s) => s.enabled).map((s) => s.section);
  return (
    <div className="min-h-dvh bg-[#f7f2ea] text-ink">
      <main id="main" className="mx-auto max-w-4xl px-4 pb-16 pt-8">
        <header className="flex flex-col items-center text-center">
          <Avatar name={page.creator.name} src={page.creator.avatarUrl ?? undefined} size={88} />
          <h1 className="mt-3 font-display text-[30px] leading-tight">{page.creator.name}</h1>
          {page.headline ? <p className="mt-1 text-[15px] text-ink-muted">{page.headline}</p> : null}
          {page.intro ? <p className="mt-3 max-w-xl whitespace-pre-line text-[15px] leading-relaxed text-ink">{page.intro}</p> : null}
        </header>
        <div className="mt-10 space-y-12">
          {on.map((s) => (
            <Section key={s} section={s} page={page} kind={kind ?? null} />
          ))}
        </div>
      </main>
    </div>
  );
}

const KIND_FILTERS: Array<{ key: string; label: string; match: (e: PublicationExperience, type: string) => boolean }> = [
  { key: "poems", label: "Poems", match: (_e, t) => ["poem", "lyrics", "spoken_word"].includes(t) },
  { key: "writing", label: "Writing", match: (e, t) => e === "read" && !["poem", "lyrics", "spoken_word"].includes(t) },
  { key: "visual", label: "Visual", match: (e) => e === "view" || e === "swipe" || e === "journey" },
  { key: "audio", label: "Audio", match: (e) => e === "listen" },
  { key: "video", label: "Video", match: (e) => e === "watch" },
];

function Section({ section, page, kind }: { section: string; page: PublicCreatorPage; kind: string | null }) {
  const h = (t: string) => <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">{t}</h2>;
  switch (section) {
    case "featured": {
      const f = page.works.filter((w) => w.featured).slice(0, 4);
      if (!f.length) return null;
      return (
        <section aria-label="Featured">
          {h("Featured")}
          <ul className="grid grid-cols-2 gap-4">
            {f.map((w) => (
              <li key={w.slug}>
                <WorkCard card={w} large />
              </li>
            ))}
          </ul>
        </section>
      );
    }
    case "creations": {
      if (!page.works.length) return null;
      const present = KIND_FILTERS.filter((k) => page.works.some((w) => k.match(w.experience, w.creationType)));
      const f = KIND_FILTERS.find((k) => k.key === kind);
      const list = f ? page.works.filter((w) => f.match(w.experience, w.creationType)) : page.works;
      return (
        <section aria-label="Creations">
          {h("Creations")}
          {present.length > 1 ? (
            <nav aria-label="Kinds of work" className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
              {[{ key: "", label: "All" }, ...present].map((k) => (
                <Link key={k.key} href={k.key ? `?kind=${k.key}` : "?"} aria-current={(kind ?? "") === k.key ? "page" : undefined} scroll={false} className="inline-flex min-h-11 shrink-0 items-center">
                  <span className={(kind ?? "") === k.key ? "inline-flex h-8 items-center rounded-full bg-[#5b3f8c] px-3.5 text-[13px] font-medium text-white" : "inline-flex h-8 items-center rounded-full bg-white/70 px-3.5 text-[13px] text-ink-muted"}>{k.label}</span>
                </Link>
              ))}
            </nav>
          ) : null}
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {list.map((w) => (
              <li key={w.slug}>
                <WorkCard card={w} />
              </li>
            ))}
          </ul>
        </section>
      );
    }
    case "dejavu":
      if (!page.dejavus.length) return null;
      return (
        <section aria-label="DejaVu">
          {h("DejaVu")}
          <ul className="divide-y divide-black/5 rounded-2xl bg-white/70">
            {page.dejavus.map((d) => (
              <li key={d.id}>
                <Link href={`/p/${page.creator.handle}/dejavu/${d.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[17px]">{d.name}</span>
                    <span className="block truncate text-[13px] text-ink-muted">{d.description || `${d.count} ${d.count === 1 ? "piece" : "pieces"}`}</span>
                  </span>
                  <ChevronRight className="size-4 text-ink-subtle" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      );
    case "moments":
      if (!page.moments.length) return null;
      return (
        <section aria-label="Moments">
          {h("Moments")}
          <ul className="space-y-3">
            {page.moments.slice(0, 8).map((m) => (
              <li key={m.id} className="rounded-2xl bg-white/70 p-4">
                {m.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.imageUrl} alt="" loading="lazy" className="mb-3 max-h-80 w-full rounded-xl object-cover" />
                ) : null}
                <p className="whitespace-pre-line font-display text-[16px] leading-relaxed">{m.body}</p>
                <p className="mt-1 text-[12px] text-ink-subtle">{new Date(m.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</p>
              </li>
            ))}
          </ul>
        </section>
      );
    case "conversations":
      if (!page.conversations.length) return null;
      return (
        <section aria-label="Open Conversations">
          {h("Open Conversations")}
          <ul className="space-y-2">
            {page.conversations.slice(0, 4).map((c) => (
              <li key={c.id}>
                <Link href={`/community/conversations/${c.id}`} className="flex min-h-14 items-center gap-3 rounded-2xl bg-white/70 px-4 py-2">
                  <MessagesSquare className="size-4 text-[#5b3f8c]" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px]">{c.title}</span>
                    <span className="text-[12.5px] text-ink-muted">
                      {c.replyCount} {c.replyCount === 1 ? "reply" : "replies"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      );
    case "about":
      if (!page.creator.bio && !page.creator.location) return null;
      return (
        <section aria-label="About">
          {h("About")}
          {page.creator.bio ? <p className="whitespace-pre-line text-[15px] leading-relaxed">{page.creator.bio}</p> : null}
          {page.creator.location ? <p className="mt-1 text-[13.5px] text-ink-muted">{page.creator.location}</p> : null}
        </section>
      );
    case "open_to":
      if (!page.openTo.length) return null;
      return (
        <section aria-label="Open to">
          {h("Open to")}
          <p className="flex flex-wrap gap-1.5">
            {page.openTo.map((o) => (
              <span key={o} className="rounded-full bg-[#ece3f5] px-3 py-1 text-[13px] text-[#4a3372]">
                {OPEN_TO_LABEL[o as OpenTo] ?? o}
              </span>
            ))}
          </p>
        </section>
      );
    case "links":
      if (!page.links.length) return null;
      return (
        <section aria-label="Links">
          {h("Links")}
          <ul className="flex flex-wrap gap-2">
            {page.links.map((l) => (
              <li key={l.url}>
                <a href={l.url} rel="noopener noreferrer me" target="_blank" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/70 px-4 text-[14px]">
                  {l.label} <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>
      );
    default:
      return null;
  }
}

