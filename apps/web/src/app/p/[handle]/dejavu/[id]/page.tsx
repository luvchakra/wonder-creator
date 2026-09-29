import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkCard } from "@/components/publish/work-page";
import { loadPublicDejaVu, siteOrigin } from "@/lib/public-pages";

type Params = { params: Promise<{ handle: string; id: string }> };

/**
 * A public DejaVu (docs/creator-publish.md §18): an editorial thread through the creator's work over time — only their
 * public published works and the Moments they chose for their page. Private Moments in the same DejaVu never appear.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle, id } = await params;
  const d = await loadPublicDejaVu(handle, id);
  if (!d) return { title: "Not found", robots: { index: false } };
  const description = d.dejavu.description || `A thread through ${d.creator.name}'s work · ${d.items.length} ${d.items.length === 1 ? "piece" : "pieces"}`;
  return { title: { absolute: `${d.dejavu.name} · ${d.creator.name}` }, description, metadataBase: new URL(await siteOrigin()), openGraph: { title: d.dejavu.name, description, siteName: "Wonder Creator" } };
}

export default async function PublicDejaVu({ params }: Params) {
  const { handle, id } = await params;
  const d = await loadPublicDejaVu(handle, id);
  if (!d) notFound();
  const year = (iso: string) => new Date(iso).getUTCFullYear();
  return (
    <div className="min-h-dvh bg-[#f7f2ea] text-ink">
      <main id="main" className="mx-auto max-w-2xl px-4 pb-16 pt-4">
        <Link href={`/p/${d.creator.handle}`} className="inline-flex min-h-11 items-center gap-1.5 text-[13.5px] font-medium text-ink-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> {d.creator.name}
        </Link>
        <h1 className="mt-4 font-display text-[36px] leading-tight">{d.dejavu.name}</h1>
        {d.dejavu.description ? <p className="mt-2 text-[16px] leading-relaxed text-ink-muted">{d.dejavu.description}</p> : null}
        {!d.items.length ? <p className="mt-8 text-[15px] text-ink-muted">Nothing here is public yet.</p> : null}
        <ol className="mt-10 space-y-8 border-l border-black/10 pl-6">
          {d.items.map((i, k) => (
            <li key={k} className="relative">
              <span aria-hidden className="absolute -left-[1.85rem] top-1.5 size-2.5 rounded-full bg-[#5b3f8c]" />
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">{year(i.at)}</p>
              {i.kind === "creation" ? (
                <div className="mt-2 max-w-xs">
                  <WorkCard card={i.card} />
                </div>
              ) : (
                <div className="mt-2 rounded-2xl bg-white/70 p-4">
                  {i.moment.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.moment.imageUrl} alt="" loading="lazy" className="mb-3 max-h-72 w-full rounded-xl object-cover" />
                  ) : null}
                  <p className="whitespace-pre-line font-display text-[16px] leading-relaxed">{i.moment.body}</p>
                </div>
              )}
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
