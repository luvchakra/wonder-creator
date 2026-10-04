import { cn } from "../cn";

/**
 * Separators drawn from Roman architecture (owner, 4 Oct 2026: "beautiful separator options for header and footer, simple
 * but elegant, inspired from roman architecture"). Hairline, in the ink at low strength, decorative only (hidden from
 * assistive tech). Repeating bands are an SVG mask over `currentColor`, so they take the colour of where they sit.
 *
 * - line — a single hairline (the quiet one)
 * - dentil — a cornice's row of small blocks under a fillet
 * - arcade — an aqueduct's run of round arches
 * - eggdart — the ovolo moulding: eggs and darts
 * - meander — the running key of Roman mosaic borders
 * - keystone — a hairline held by a keystone at the centre
 * - laurel — a hairline with a small laurel at the centre
 */
export const ORNAMENTS = ["line", "dentil", "arcade", "eggdart", "meander", "keystone", "laurel"] as const;
export type OrnamentKind = (typeof ORNAMENTS)[number];
export const ORNAMENT_LABEL: Record<OrnamentKind, string> = {
  line: "Hairline",
  dentil: "Dentil",
  arcade: "Arcade",
  eggdart: "Egg & dart",
  meander: "Meander",
  keystone: "Keystone",
  laurel: "Laurel",
};
export const DEFAULT_ORNAMENT: OrnamentKind = "dentil";
export const isOrnament = (v: unknown): v is OrnamentKind => typeof v === "string" && (ORNAMENTS as readonly string[]).includes(v);

const svg = (w: number, h: number, body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' fill='none' stroke='black' stroke-width='1'>${body}</svg>`)}")`;

/** The repeating bands: tile width × height and what one tile draws (a fillet line above the moulding). */
const BANDS: Partial<Record<OrnamentKind, { mask: string; h: number }>> = {
  dentil: { h: 9, mask: svg(11, 9, "<path d='M0 0.5H11M0 2.5H11' stroke-width='0.7'/><rect x='2' y='4' width='6' height='5' fill='black' stroke='none'/>") },
  arcade: { h: 12, mask: svg(16, 12, "<path d='M0 0.5H16' stroke-width='0.7'/><path d='M2 12V7A6 6 0 0 1 14 7V12'/><path d='M0 12V3.5M16 12V3.5' stroke-width='0.7'/>") },
  eggdart: { h: 12, mask: svg(16, 12, "<path d='M0 0.5H16' stroke-width='0.7'/><path d='M2.2 3A3.8 3.8 0 0 1 9.8 3C9.8 7.6 8 11 6 11S2.2 7.6 2.2 3Z'/><path d='M13 2V10.5M11.4 8.6L13 11L14.6 8.6'/>") },
  meander: { h: 12, mask: svg(14, 12, "<path d='M0 11.5H14M0 0.5H14' stroke-width='0.7'/><path d='M1.5 11.5V3H11V9H5V5.5H8.5'/>") },
};

export function Ornament({ kind = DEFAULT_ORNAMENT, className }: { kind?: OrnamentKind; className?: string }) {
  const band = BANDS[kind];
  if (band)
    return (
      <div
        aria-hidden
        className={cn("w-full text-ink/25", className)}
        style={{
          height: band.h,
          backgroundColor: "currentColor",
          maskImage: band.mask,
          WebkitMaskImage: band.mask,
          maskRepeat: "repeat-x",
          WebkitMaskRepeat: "repeat-x",
          maskPosition: "center top",
          WebkitMaskPosition: "center top",
        }}
      />
    );
  if (kind === "line") return <div aria-hidden className={cn("h-px w-full bg-current text-ink/15", className)} />;
  // A motif at the centre, held by hairlines that fade towards the edges.
  return (
    <div aria-hidden className={cn("flex w-full items-center gap-2 text-ink/30", className)}>
      <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,currentColor)]" />
      {kind === "keystone" ? (
        <svg width="22" height="14" viewBox="0 0 22 14" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M1.5 1H20.5L16.5 13H5.5Z" />
          <path d="M7 4.5H15" strokeWidth="0.7" />
        </svg>
      ) : (
        // A laurel: two sprigs of paired leaves meeting at a small berry.
        <svg width="64" height="18" viewBox="0 0 64 18" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M29 10C21 10 12 8 3 4" />
          <path d="M35 10C43 10 52 8 61 4" />
          {[0, 1, 2, 3].map((i) => {
            const x = 7 + i * 6;
            const y = 5.2 + i * 1.3;
            return (
              <g key={i}>
                <path d={`M${x} ${y}C${x - 1} ${y - 4} ${x + 3} ${y - 5} ${x + 4} ${y - 4}C${x + 4} ${y - 1} ${x + 1} ${y} ${x} ${y}Z`} />
                <path d={`M${x} ${y}C${x + 1} ${y + 4} ${x + 5} ${y + 4} ${x + 5} ${y + 3}C${x + 4} ${y + 0.5} ${x + 1} ${y} ${x} ${y}Z`} />
                <path d={`M${64 - x} ${y}C${65 - x} ${y - 4} ${61 - x} ${y - 5} ${60 - x} ${y - 4}C${60 - x} ${y - 1} ${63 - x} ${y} ${64 - x} ${y}Z`} />
                <path d={`M${64 - x} ${y}C${63 - x} ${y + 4} ${59 - x} ${y + 4} ${59 - x} ${y + 3}C${60 - x} ${y + 0.5} ${63 - x} ${y} ${64 - x} ${y}Z`} />
              </g>
            );
          })}
          <circle cx="32" cy="10" r="1.8" fill="currentColor" stroke="none" />
        </svg>
      )}
      <span className="h-px flex-1 bg-[linear-gradient(90deg,currentColor,transparent)]" />
    </div>
  );
}
