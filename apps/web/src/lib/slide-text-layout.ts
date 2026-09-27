/**
 * Where the creator's words sit on a slide visual. Pure layout (no canvas), so it can be tested: wraps each line to the
 * width available, and places the block at the top, centre or bottom with a safe margin.
 */
export type TextPosition = "top" | "center" | "bottom";
export type TextSize = "s" | "m" | "l";

export const SIZE_RATIO: Record<TextSize, number> = { s: 0.052, m: 0.07, l: 0.092 };

export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      if (out.length) out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (line && measure(next) > maxWidth) {
        out.push(line);
        line = w;
      } else line = next;
    }
    if (line) out.push(line);
  }
  while (out.at(-1) === "") out.pop();
  return out;
}

export function layoutText(opts: { text: string; width: number; height: number; size: TextSize; position: TextPosition; measure: (s: string, fontPx: number) => number }) {
  const { width, height } = opts;
  let fontPx = Math.round(width * SIZE_RATIO[opts.size]);
  const margin = Math.round(width * 0.07);
  const maxWidth = width - margin * 2;
  let lines = wrapText(opts.text, maxWidth, (s) => opts.measure(s, fontPx));
  // A very long line of words shrinks to fit rather than spilling off the image.
  while (fontPx > 12 && (lines.length * fontPx * 1.25 > height * 0.6 || lines.some((l) => opts.measure(l, fontPx) > maxWidth))) {
    fontPx = Math.round(fontPx * 0.9);
    lines = wrapText(opts.text, maxWidth, (s) => opts.measure(s, fontPx));
  }
  const lineHeight = Math.round(fontPx * 1.25);
  const blockHeight = lines.length * lineHeight;
  const top = opts.position === "top" ? margin : opts.position === "center" ? Math.round((height - blockHeight) / 2) : height - margin - blockHeight;
  return { fontPx, lineHeight, lines, top, blockHeight, margin, centerX: Math.round(width / 2) };
}
