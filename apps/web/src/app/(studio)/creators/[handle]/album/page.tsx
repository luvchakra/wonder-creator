import { getCreatorByHandle } from "@wonder/creator-identity";
import { KIT, KitArt } from "@wonder/ui";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaletteScope } from "@/components/creative-palette";
import { AlbumGallery } from "@/components/profile/album";
import { albumOf } from "@/lib/album";
import { flagOn } from "@/lib/features";
import { requireSession } from "@/lib/session";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return { title: `Album · @${handle.slice(0, 30)}` };
}

/** A creator's photo album (docs/photo-album.md): pictures they chose to show, in their order. RLS decides who sees it. */
export default async function AlbumPage({ params }: { params: Promise<{ handle: string }> }) {
  if (!flagOn("photo_album_enabled")) notFound();
  const { handle } = await params;
  if (!/^[a-z0-9_]{3,30}$/i.test(handle)) notFound();
  const { db, creator: me } = await requireSession();
  const profile = await getCreatorByHandle(db, handle);
  if (!profile) notFound();
  const c = profile.creator;
  const isMe = c.id === me.id;
  const name = c.display_name || c.handle || "Creator";
  const photos = await albumOf(db, c.id).catch(() => []);
  return (
    <>
      <PaletteScope context={{ page: isMe ? "me" : "creator", ids: { creatorHandle: c.handle ?? handle }, strip: { label: `${name} · Album` } }} />
      <div className="mx-auto max-w-4xl space-y-3">
        <Link href={`/creators/${c.handle ?? handle}`} className="inline-flex min-h-11 items-center gap-1 text-[13.5px] text-ink-muted hover:text-ink">
          <ChevronLeft className="size-4" aria-hidden /> {isMe ? "Your profile" : name}
        </Link>
        <header className="relative">
          <KitArt art={KIT.painted.blossomSprig} sizes="6rem" className="pointer-events-none absolute -top-2 right-0 h-20 w-auto opacity-80" />
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">Album</p>
          <h1 className="pr-20 font-display text-[30px] leading-tight text-ink sm:text-[38px]">{isMe ? "Your album" : <>{name.split(" ")[0]}&rsquo;s album</>}</h1>
        </header>
        <AlbumGallery photos={photos} isMe={isMe} name={name} />
      </div>
    </>
  );
}
