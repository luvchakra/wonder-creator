/**
 * Carousel Composer text (docs/ui-redesign/carousel-composer.md §8, §17, §18). Client-safe and pure.
 *
 * A source (poem, song, note) is split into slide-sized chunks that respect stanzas and line breaks, keep sentences
 * whole where possible, and balance length across the requested number of slides. Chunking never changes the source.
 */

export const CAROUSEL_COUNTS = [3, 4, 5, 6] as const;
export const CAROUSEL_MAX_SLIDES = 12;
export const CAROUSEL_STYLES = [
  { value: "auto", label: "Auto" },
  { value: "editorial", label: "Editorial" },
  { value: "atmospheric", label: "Atmospheric" },
  { value: "minimal", label: "Minimal" },
] as const;
export type CarouselStyle = (typeof CAROUSEL_STYLES)[number]["value"];
export const CAROUSEL_ASPECTS = [
  { value: "1:1", label: "Square" },
  { value: "4:5", label: "Portrait" },
  { value: "16:9", label: "Landscape" },
] as const;
export type CarouselAspect = (typeof CAROUSEL_ASPECTS)[number]["value"];

/** Quick instructions offered when regenerating or adding one image (§11, §26). */
export const IMAGE_INSTRUCTION_CHIPS = ["More cinematic", "Warmer", "Closer shot", "Minimal", "Night scene", "More emotional", "Add negative space"] as const;

const STRONG_END = /[.!?।॥…"”'’)\]]\s*$/;
const SOFT_END = /[,;:—–-]\s*$/;

/** The words of a source, without Markdown decoration or slide scaffolding; stanzas separated by blank lines. */
export function cleanSource(text: string): string[][] {
  const stanzas: string[][] = [];
  let cur: string[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw
      .replace(/^\s{0,3}#{1,6}\s+/, "")
      .replace(/^\s*[-*>]\s+/, "")
      .replace(/\*\*|__|`/g, "")
      .replace(/^\s*(?:slide\s*\d{1,2}\s*[:.\-–—)]\s*)/i, "")
      .replace(/^\s*(?:text|visual|image|notes?)\s*:\s*/i, (m) => (/visual|image|notes?/i.test(m) ? "\u0000" : ""))
      .trim();
    if (line.startsWith("\u0000")) continue; // a design note, not words for the slide
    if (!line || /^(-{3,}|\*{3,})$/.test(line)) {
      if (cur.length) stanzas.push(cur);
      cur = [];
      continue;
    }
    cur.push(line);
  }
  if (cur.length) stanzas.push(cur);
  return stanzas;
}

type Unit = { text: string; len: number; /** how good a slide break is after this unit (higher = better) */ breakAfter: number };

function units(stanzas: string[][], want: number): Unit[] {
  const lines: Unit[] = [];
  stanzas.forEach((s, si) =>
    s.forEach((l, li) => {
      const endOfStanza = li === s.length - 1 && si < stanzas.length - 1;
      lines.push({ text: l, len: [...l].length, breakAfter: endOfStanza ? 3 : STRONG_END.test(l) ? 2 : SOFT_END.test(l) ? 1 : 0 });
    }),
  );
  if (lines.length >= want) return lines;
  // Too few lines: split long lines at sentence or clause boundaries.
  const out: Unit[] = [];
  for (const u of lines) {
    const parts = u.text.split(/(?<=[.!?।॥;:—])\s+/).filter(Boolean);
    if (parts.length < 2) {
      out.push(u);
      continue;
    }
    parts.forEach((p, i) => out.push({ text: p, len: [...p].length, breakAfter: i === parts.length - 1 ? u.breakAfter : 2 }));
  }
  return out;
}

/** Contiguous, balanced partition of units into `n` groups, preferring breaks at stanza/sentence ends. */
function partition(us: Unit[], n: number): Unit[][] {
  const k = Math.min(n, us.length);
  if (k <= 1) return us.length ? [us] : [];
  const total = us.reduce((s, u) => s + u.len + 1, 0);
  const target = total / k;
  const prefix = [0];
  for (const u of us) prefix.push(prefix.at(-1)! + u.len + 1);
  const INF = Number.POSITIVE_INFINITY;
  // cost[j][i]: best cost for the first i units in j groups.
  const cost: number[][] = Array.from({ length: k + 1 }, () => new Array(us.length + 1).fill(INF));
  const back: number[][] = Array.from({ length: k + 1 }, () => new Array(us.length + 1).fill(0));
  cost[0]![0] = 0;
  for (let j = 1; j <= k; j++) {
    for (let i = j; i <= us.length - (k - j); i++) {
      for (let p = j - 1; p < i; p++) {
        const prev = cost[j - 1]![p]!;
        if (prev === INF) continue;
        const len = prefix[i]! - prefix[p]!;
        const dev = (len - target) / target;
        const brk = i < us.length ? us[i - 1]!.breakAfter : 3;
        const c = prev + dev * dev + (3 - brk) * 0.35;
        if (c < cost[j]![i]!) {
          cost[j]![i] = c;
          back[j]![i] = p;
        }
      }
    }
  }
  const groups: Unit[][] = [];
  let i = us.length;
  for (let j = k; j >= 1; j--) {
    const p = back[j]![i]!;
    groups.unshift(us.slice(p, i));
    i = p;
  }
  return groups;
}

/**
 * Split a source into `n` slide chunks. If the source already has slide structure ("Slide 1: …"), and it has exactly
 * `n` slides, those are used as written. Returns fewer than `n` chunks when there aren't enough words.
 */
export function chunkText(text: string, n: number): string[] {
  const want = Math.max(1, Math.min(CAROUSEL_MAX_SLIDES, Math.floor(n)));
  const authored = authoredSlides(text);
  if (authored.length === want) return authored;
  const stanzas = cleanSource(text);
  const us = units(stanzas, want);
  return partition(us, want).map((g) => g.map((u) => u.text).join("\n"));
}

/** Slides the writer already marked ("### Slide 2", "Slide 2: …"), with their words. */
export function authoredSlides(text: string): string[] {
  if (!/^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*slide\s*\d/im.test(text)) return [];
  const out: string[] = [];
  let cur: string[] | null = null;
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const head = /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?\s*slide\s*\d{1,2}\b\s*(?:\*\*|__)?\s*[:.\-–—)]?\s*(?:\*\*|__)?\s*(.*)$/i.exec(raw);
    if (head) {
      if (cur) out.push(cur.join("\n"));
      cur = head[1]?.trim() ? [head[1].replace(/\*\*|__/g, "").trim()] : [];
      continue;
    }
    if (!cur) continue;
    const words = cleanSource(raw)[0]?.join(" ");
    if (words) cur.push(words);
  }
  if (cur) out.push(cur.join("\n"));
  return out.map((s) => s.trim()).filter(Boolean);
}

/**
 * Other chunks that could go on slide `index` (§17): the same place in the source split a little differently, then
 * neighbouring stanzas. Never includes `current`; never edits the source.
 */
export function alternativeChunks(text: string, n: number, index: number, current: string): string[] {
  const seen = new Set([norm(current)]);
  const out: string[] = [];
  const add = (c: string | undefined) => {
    if (!c || seen.has(norm(c))) return;
    seen.add(norm(c));
    out.push(c);
  };
  for (const m of [n + 1, n - 1, n + 2, n - 2, n * 2]) {
    if (m < 1) continue;
    const parts = chunkText(text, m);
    add(parts[Math.min(parts.length - 1, Math.round((index * m) / Math.max(1, n)))]);
  }
  for (const s of cleanSource(text)) add(s.join("\n"));
  return out.slice(0, 8);
}

/** Split one slide's words in two (§18): at the line nearest the middle, else at a sentence or word boundary. */
export function splitChunk(text: string): [string, string] | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const total = lines.reduce((s, l) => s + l.length, 0);
    let best = 1;
    let bestScore = Number.POSITIVE_INFINITY;
    let acc = 0;
    for (let i = 1; i < lines.length; i++) {
      acc += lines[i - 1]!.length;
      const score = Math.abs(acc - total / 2) - (STRONG_END.test(lines[i - 1]!) ? total * 0.15 : SOFT_END.test(lines[i - 1]!) ? total * 0.05 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return [lines.slice(0, best).join("\n"), lines.slice(best).join("\n")];
  }
  const one = lines[0] ?? "";
  const sentences = one.split(/(?<=[.!?।॥;:—,])\s+/);
  if (sentences.length >= 2) {
    const half = Math.ceil(sentences.length / 2);
    return [sentences.slice(0, half).join(" "), sentences.slice(half).join(" ")];
  }
  const words = one.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** The overlay a slide carries (§35). Positions are fractions of the image (0–1), so they survive any render size. */
export interface SlideOverlay {
  enabled: boolean;
  text?: string | null;
  x: number;
  y: number;
  width: number;
  font: "editorial" | "serif" | "modern" | "handwritten";
  size: number;
  align: "left" | "center" | "right";
  color: string;
  shadow: boolean;
  background: "none" | "shade" | "band";
}
export const DEFAULT_OVERLAY: SlideOverlay = { enabled: false, x: 0.5, y: 0.8, width: 0.84, font: "serif", size: 0.07, align: "center", color: "#ffffff", shadow: true, background: "shade" };
export const OVERLAY_COLORS = ["#ffffff", "#fbf7f0", "#1f2a44", "#000000", "#c98a3c", "#2c5a7a"] as const;
export const OVERLAY_FONTS = [
  { value: "editorial", label: "Editorial" },
  { value: "serif", label: "Serif" },
  { value: "modern", label: "Modern" },
  { value: "handwritten", label: "Handwritten" },
] as const;
/** Snap points (§20): thirds of the image, inset by a safe margin. */
export const SNAP_POINTS = [
  { label: "Top left", x: 0.3, y: 0.14 },
  { label: "Top centre", x: 0.5, y: 0.14 },
  { label: "Top right", x: 0.7, y: 0.14 },
  { label: "Centre", x: 0.5, y: 0.5 },
  { label: "Bottom left", x: 0.3, y: 0.84 },
  { label: "Bottom centre", x: 0.5, y: 0.84 },
  { label: "Bottom right", x: 0.7, y: 0.84 },
] as const;

/** Snap a dragged position to the nearest safe point when close enough; always keep it inside the safe margin. */
export function snapPosition(x: number, y: number, threshold = 0.04): { x: number; y: number; snapped: string | null } {
  const clamp = (v: number) => Math.min(0.94, Math.max(0.06, v));
  for (const p of SNAP_POINTS) if (Math.abs(p.x - x) <= threshold && Math.abs(p.y - y) <= threshold) return { x: p.x, y: p.y, snapped: p.label };
  if (Math.abs(x - 0.5) <= threshold / 2) return { x: 0.5, y: clamp(y), snapped: "Centre line" };
  return { x: clamp(x), y: clamp(y), snapped: null };
}

export interface ImageTransform {
  zoom: number;
  focalX: number;
  focalY: number;
}
export const DEFAULT_TRANSFORM: ImageTransform = { zoom: 1, focalX: 0.5, focalY: 0.5 };

/** The source rectangle to draw for a zoom + focal point, kept inside the image (for canvas and CSS alike). */
export function cropRect(w: number, h: number, t: ImageTransform): { sx: number; sy: number; sw: number; sh: number } {
  const zoom = Math.min(4, Math.max(1, t.zoom || 1));
  const sw = w / zoom;
  const sh = h / zoom;
  const sx = Math.min(w - sw, Math.max(0, t.focalX * w - sw / 2));
  const sy = Math.min(h - sh, Math.max(0, t.focalY * h - sh / 2));
  return { sx, sy, sw, sh };
}
