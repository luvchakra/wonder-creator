import { z } from "zod";

/**
 * The Video page (creation-pages.md, step 5): a video is planned as shots — each a frame (a picture of the creator's,
 * or none yet), the line (what is said or seen), a direction for the camera, and how long it holds. Played through in
 * order it is an animatic. Client-safe: no database access here. A video written before the page (a script or shot
 * list in plain text) opens as shots: scene headings, "Shot N" lines and headings each start one, else each paragraph.
 */
export const MAX_SHOTS = 120;
export const SHOT_SECONDS = { min: 1, max: 60, default: 4 } as const;

export interface Shot {
  id: string;
  /** A picture Material of the creator's, or null for a frame yet to find. */
  frame: string | null;
  line: string;
  direction: string;
  seconds: number;
}
export interface Storyboard {
  kind: "storyboard";
  shots: Shot[];
}

const shotSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{4,40}$/i),
  frame: z.string().uuid().nullable(),
  line: z.string().max(1000),
  direction: z.string().max(500),
  seconds: z.number().int().min(SHOT_SECONDS.min).max(SHOT_SECONDS.max),
});
export const storyboardSchema = z.object({ kind: z.literal("storyboard"), shots: z.array(shotSchema).max(MAX_SHOTS) });

let counter = 0;
export function shotId(): string {
  counter = (counter + 1) % 1_000_000;
  return `h${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
export const blankShot = (line = ""): Shot => ({ id: shotId(), frame: null, line, direction: "", seconds: SHOT_SECONDS.default });

/** The storyboard a version holds; for one without, the shots its words outline. Never throws. */
export function storyboardOf(structured: unknown, content = ""): Storyboard {
  const parsed = storyboardSchema.safeParse(structured);
  if (parsed.success) return parsed.data;
  return { kind: "storyboard", shots: outlineShots(content) };
}

function outlineShots(content: string): Shot[] {
  const text = content.replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const starts = /^(?:#{1,3}\s+|\**\s*shot\s+\d+\s*[:.\-–—]?\s*\**|(?:INT|EXT|INT\.?\/EXT)\.?\s)/i;
  const lines = text.split("\n");
  const marked = lines.some((l) => starts.test(l.trim()));
  const groups: string[][] = [];
  if (marked) {
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (starts.test(line.trim()) || !groups.length) groups.push([line]);
      else groups[groups.length - 1]!.push(line);
    }
  } else {
    for (const para of text.split(/\n\s*\n/)) groups.push(para.split("\n"));
  }
  return groups
    .map((g) => {
      const [head = "", ...rest] = g.map((l) => l.trim());
      const isHeading = starts.test(head);
      const direction = isHeading ? head.replace(/^#{1,3}\s+/, "").replace(/^\**\s*shot\s+\d+\s*[:.\-–—]?\s*\**\s*/i, "").replace(/\*+/g, "").trim() : "";
      const line = (isHeading ? rest : [head, ...rest]).filter(Boolean).join("\n").trim();
      const secs = /(\d{1,2})\s*(?:s|sec|seconds)\b/i.exec(direction);
      const seconds = secs ? Math.min(SHOT_SECONDS.max, Math.max(SHOT_SECONDS.min, Number(secs[1]))) : SHOT_SECONDS.default;
      return { ...blankShot(line.slice(0, 1000)), direction: direction.slice(0, 500), seconds };
    })
    .filter((s) => s.line || s.direction)
    .slice(0, MAX_SHOTS);
}

/** How long the storyboard runs, in seconds. */
export const runtimeOf = (sb: Storyboard) => sb.shots.reduce((t, s) => t + s.seconds, 0);

/** The storyboard's words, for search, export and reading: a heading per shot (its direction and length), then its line. */
export function storyboardText(sb: Storyboard): string {
  return sb.shots
    .map((s, i) => [`## Shot ${i + 1} · ${s.seconds}s${s.direction.trim() ? ` — ${s.direction.trim()}` : ""}`, s.line.trim()].filter(Boolean).join("\n\n"))
    .join("\n\n");
}
