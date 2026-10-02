import { KIT, KitArt, cn } from "@wonder/ui";

/**
 * A community's picture: its cover when the owner chose one, otherwise a painted wash with a botanical — picked from
 * the id so each community keeps the same art everywhere. Never a grey box.
 */
const WASHES = [KIT.wash.washLavender, KIT.wash.washPeach, KIT.wash.washMint, KIT.wash.washLilacSky, KIT.wash.washCream] as const;
const SPRIGS = [KIT.painted.lavenderSprig, KIT.painted.flowerBranch, KIT.painted.blossomSprig, KIT.painted.coralLeaves, KIT.painted.leafSprigSage] as const;

function pick(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return { wash: WASHES[h % WASHES.length]!, sprig: SPRIGS[(h >>> 3) % SPRIGS.length]! };
}

export function CommunityArt({ id, coverUrl, className, sprig = true }: { id: string; coverUrl?: string | null; className?: string; sprig?: boolean }) {
  if (coverUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={coverUrl} alt="" className={cn("object-cover", className)} />;
  }
  const art = pick(id);
  return (
    <span aria-hidden className={cn("relative block overflow-hidden bg-surface-muted", className)}>
      <KitArt art={art.wash} className="absolute inset-0 size-full object-cover" />
      {sprig ? <KitArt art={art.sprig} sizes="12rem" className="absolute -bottom-[12%] -right-[6%] h-[85%] w-auto opacity-90" /> : null}
    </span>
  );
}

const MONO = ["#6b4fc8", "#b4533f", "#2f7a62", "#5a5fc9", "#8a5a2b"] as const;

/**
 * A community's profile picture: the picture its hosts chose, or a painted monogram (a wash with the first letter in
 * Playfair) so every community has a face. Round, with a soft ring.
 */
export function CommunityAvatar({ id, title, src, size = 48, className }: { id: string; title: string; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} style={style} className={cn("shrink-0 rounded-full object-cover ring-2 ring-white", className)} />;
  }
  const { wash } = pick(id);
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 17 + id.charCodeAt(i)) >>> 0;
  const letter = (title.trim().match(/\p{L}|\p{N}/u)?.[0] ?? "C").toUpperCase();
  return (
    <span aria-hidden style={style} className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-muted ring-2 ring-white", className)}>
      <KitArt art={wash} className="absolute inset-0 size-full scale-150 object-cover" />
      <span className="relative font-display italic leading-none" style={{ fontSize: Math.round(size * 0.46), color: MONO[h % MONO.length] }}>
        {letter}
      </span>
    </span>
  );
}
