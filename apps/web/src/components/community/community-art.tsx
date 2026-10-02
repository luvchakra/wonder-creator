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
