import { CREATOR_PAGE_DECORATIONS as D, CREATOR_PAGE_TEMPLATES as T, KIT, KitArt, WATERCOLOR, cn, type KitAsset } from "@wonder/ui";

/**
 * The Creator Page asset registry (spec §5.1): every template reaches art through these keys, never through file
 * paths. Keys map to the Creator Page background library (`brand/creator-page.ts`) and the owner-supplied Kit and
 * watercolour pieces. Full backgrounds use their AVIF/WebP renders (`image`); decorations stay vector (`vector`).
 */
export const CREATOR_PAGE_ASSETS = {
  "immersive.hero.primary": T.immersiveHero.image,
  "immersive.hero.wide": T.immersiveHeroWide.image,
  "editorial.paper.background": T.editorialPaper.image,
  "editorial.botanical.corner": WATERCOLOR.cornerBottomRight,
  "cinematic.background": T.cinematicDark.image,
  "cinematic.lightLeak": D.lightLeak.vector,
  "collage.paperBoard": T.creativeCollage.image,
  "collage.tape": D.paperTape.vector,
  "collage.tornPaper": D.tornPaperStrip.vector,
  "collage.handwrittenNote": D.handwrittenNote.vector,
  "gradient.background": T.softGradient.image,
  "gradient.blob": D.gradientBlob.vector,
  "shared.watercolor.lavender": KIT.wash.washLavender,
  "shared.watercolor.peach": KIT.wash.washPeach,
  "shared.watercolor.wash": D.watercolorWash.vector,
  "shared.botanical.cornerA": WATERCOLOR.cornerTopRight,
  "shared.botanical.cornerB": WATERCOLOR.cornerBottomLeft,
  "shared.botanical.cluster": D.botanicalCorner.vector,
  "shared.botanical.branch": D.slimBranch.vector,
  "shared.paletteMotif": WATERCOLOR.paletteMotif,
  "shared.inkScribble": D.inkScribble.vector,
  "shared.grain": D.grainOverlay.vector,
  "shared.cloudMist": D.cloudMist.vector,
  "shared.shadowBackdrop": D.softShadowCard.vector,
} as const satisfies Record<string, KitAsset>;

export type CreatorPageAssetKey = keyof typeof CREATOR_PAGE_ASSETS;

/** Decorative art by key: hidden from assistive tech, lazy unless it's the hero, never taking layout space by itself. */
export function Art({ k, className, sizes = "(min-width: 768px) 40vw, 90vw", priority }: { k: CreatorPageAssetKey; className?: string; sizes?: string; priority?: boolean }) {
  return <KitArt art={CREATOR_PAGE_ASSETS[k]} sizes={sizes} priority={priority} className={cn("pointer-events-none", className)} />;
}

/** The tileable grain as a CSS background (one small request, repeated). */
export const grainStyle = { backgroundImage: `url(${D.grainOverlay.vector.svg})`, backgroundSize: "256px 256px" } as const;

/** The picker's thumbnail for each template: its own background, small. */
export const TEMPLATE_THUMB = {
  immersive_artistic: T.immersiveHero.image,
  minimal_editorial: T.editorialPaper.image,
  cinematic_dark: T.cinematicDark.image,
  creative_collage: T.creativeCollage.image,
  soft_gradient: T.softGradient.image,
} as const;
