/**
 * Where the expanded mini player may sit (docs/ui-redesign/mini-player.md §14–15): its natural right-middle spot,
 * unless that covers a primary action — then the nearest vertical shift that doesn't, within the space between the
 * navbar and the Palette's clearance. If nowhere is clear, `null`: the player shows as the collapsed tab for now.
 */
export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const overlaps = (a: Box, b: Box, gap: number) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;

export function placeClear(panel: Box, obstacles: Box[], bounds: { min: number; max: number }, opts: { gap?: number; step?: number } = {}): number | null {
  const gap = opts.gap ?? 8;
  const step = opts.step ?? 8;
  const inBounds = (dy: number) => panel.top + dy >= bounds.min && panel.bottom + dy <= bounds.max;
  const clear = (dy: number) => inBounds(dy) && !obstacles.some((o) => overlaps({ ...panel, top: panel.top + dy, bottom: panel.bottom + dy }, o, gap));
  if (clear(0)) return 0;
  const reach = Math.max(panel.top - bounds.min, bounds.max - panel.bottom);
  for (let d = step; d <= reach; d += step) {
    if (clear(-d)) return -d;
    if (clear(d)) return d;
  }
  return null;
}
