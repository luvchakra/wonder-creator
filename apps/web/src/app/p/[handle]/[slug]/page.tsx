import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedWorkPage } from "@/components/publish/work-page";
import { loadPublicWork, siteOrigin } from "@/lib/public-pages";

type Params = { params: Promise<{ handle: string; slug: string }> };

/** A published work at its stable address (docs/creator-publish.md §24): /p/<handle>/<slug>. Public; no app state. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle, slug } = await params;
  const work = await loadPublicWork(handle, slug);
  if (!work) return { title: "Not found", robots: { index: false } };
  const origin = await siteOrigin();
  const s = work.snapshot;
  const excerpt = (s.description?.trim() || s.content.replace(/\s+/g, " ").trim()).slice(0, 160);
  const description = `${work.manifest.descriptor} by ${work.creator.name}${excerpt ? ` — ${excerpt}` : ""}`;
  return {
    title: { absolute: `${s.title} · ${work.creator.name}` },
    description,
    metadataBase: new URL(origin),
    alternates: { canonical: `/p/${work.creator.handle}/${work.slug}` },
    // Unlisted and private works stay out of search engines; public ones may be found.
    robots: work.visibility === "public" && !work.preview ? undefined : { index: false, follow: false },
    openGraph: {
      title: s.title,
      description,
      url: `/p/${work.creator.handle}/${work.slug}`,
      siteName: "Wonder Creator",
      type: work.manifest.experience === "watch" ? "video.other" : work.manifest.experience === "listen" ? "music.song" : "article",
    },
    twitter: { card: "summary_large_image", title: s.title, description },
  };
}

export default async function PublishedWork({ params }: Params) {
  const { handle, slug } = await params;
  const work = await loadPublicWork(handle, slug);
  if (!work) notFound();
  const origin = await siteOrigin();
  return <PublishedWorkPage work={work} url={`${origin}/p/${work.creator.handle}/${work.slug}`} />;
}
