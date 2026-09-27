import { KIT, type KitAsset } from "../brand/kit";
import { cn } from "../cn";
import { KitArt } from "./brand";

/**
 * The Canvas atmosphere: watercolour paper under everything and two soft washes in the far corners, tinted by where
 * the creator is. It's pure decoration — fixed behind the page, no pointer events, hidden from assistive tech — so it
 * never takes layout space or competes with content (compact-density §35), and it doesn't move (minimalism §7).
 */
export type AtmosphereMood = "dawn" | "studio" | "materials" | "together" | "room" | "quiet";

const WASHES: Record<AtmosphereMood, [KitAsset | null, KitAsset | null]> = {
  dawn: [KIT.wash.washLilacSky, KIT.wash.washPeach],
  studio: [KIT.wash.washLavender, KIT.wash.washPeach],
  materials: [KIT.wash.washSage, KIT.wash.washLavender],
  together: [KIT.wash.washMint, KIT.wash.washRose],
  room: [KIT.wash.washPeach, KIT.wash.washSage],
  // Utility screens (settings, approvals, audit) stay calm: paper only.
  quiet: [null, null],
};

export function CanvasAtmosphere({ mood = "quiet", className }: { mood?: AtmosphereMood; className?: string }) {
  const [top, bottom] = WASHES[mood];
  return (
    <div aria-hidden className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden", className)}>
      <div className="absolute inset-0 opacity-50" style={{ backgroundImage: `url(${KIT.texture.textureWatercolourPaper.svg})`, backgroundSize: "640px" }} />
      {top ? <KitArt art={top} className="absolute -left-48 -top-56 w-[30rem] max-w-none opacity-[0.22] sm:-left-40 sm:w-[44rem]" /> : null}
      {bottom ? <KitArt art={bottom} className="absolute -bottom-64 -right-52 w-[28rem] max-w-none opacity-[0.18] sm:-right-40 sm:w-[40rem]" /> : null}
    </div>
  );
}
