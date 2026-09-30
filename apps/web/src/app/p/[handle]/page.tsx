import { PenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreatorPageView } from "@/components/creator-page/registry";
import { loadCreatorPage, siteOrigin, viewerCreatorId } from "@/lib/public-pages";

type Params = { params: Promise<{ handle: string }> };

/**
 * The Creator Page (docs/creator-page-templates.md): the creator's curated public home, drawn through the template they
 * chose. Only what they chose to show, in their order; never a mirror of the in-app Profile; no follower counts or
 * popularity. The address never changes with the template.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
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

export default async function CreatorPage({ params }: Params) {
  const { handle } = await params;
  const [page, viewer] = await Promise.all([loadCreatorPage(handle), viewerCreatorId()]);
  if (!page) notFound();
  const owner = viewer === page.creator.id;
  return (
    <main id="main" className="min-h-dvh">
      {owner ? (
        <p className="fixed left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-navy/85 py-1 pl-3.5 pr-1 text-[12.5px] text-white shadow-lg backdrop-blur">
          Previewing your page
          <Link href="/creator-page" className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/15 px-3 font-medium hover:bg-white/25">
            <PenLine className="size-3.5" aria-hidden /> Edit Creator Page
          </Link>
        </p>
      ) : null}
      <CreatorPageView data={page} mode="public" className="min-h-dvh [&>div]:min-h-dvh" />
    </main>
  );
}
