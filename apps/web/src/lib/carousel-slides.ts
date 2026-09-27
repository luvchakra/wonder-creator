/**
 * The words on each slide of a Carousel Creation, read from its current text so a slide visual can be prefilled with
 * its own line. Tolerant of how a draft is written: "### Slide 2", "**Slide 2:** …", "Slide 2 — …", with an optional
 * "Text:" line inside the slide. Slides with no words come back as "".
 */
const SLIDE_HEAD = /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?\s*slide\s*(\d{1,2})\b\s*(?:\*\*|__)?\s*[:.\-–—)]?\s*(?:\*\*|__)?\s*(.*)$/i;
const LABEL = /^\s*(?:[-*]\s*)?(?:\*\*|__)?\s*([A-Za-z][A-Za-z /]{1,24}?)\s*:\s*(?:\*\*|__)?\s*(.*)$/;
const TEXT_LABELS = new Set(["text", "on-slide text", "slide text", "copy", "headline", "caption", "title"]);
const NOTE_LABELS = new Set(["visual", "image", "design", "notes", "note", "layout", "background", "photo", "illustration"]);

function clean(s: string) {
  return s
    .replace(/^\s*[-*>]\s+/, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*["“”'‘]+|["“”'’]+\s*$/g, "")
    .trim();
}

export function slideTexts(content: string): string[] {
  const slides: Array<{ n: number; lines: string[]; inline: string }> = [];
  for (const line of content.split(/\r?\n/)) {
    const head = SLIDE_HEAD.exec(line);
    if (head) {
      slides.push({ n: Number(head[1]), lines: [], inline: clean(head[2] ?? "") });
      continue;
    }
    slides.at(-1)?.lines.push(line);
  }
  return slides
    .sort((a, b) => a.n - b.n)
    .map((s) => {
      const labelled: string[] = [];
      const plain: string[] = [];
      for (const raw of s.lines) {
        if (!raw.trim() || /^\s*(#{1,6}|---+|\*\*\*+)\s*$/.test(raw)) continue;
        const m = LABEL.exec(raw);
        const key = m?.[1]?.trim().toLowerCase();
        if (m && key && TEXT_LABELS.has(key)) labelled.push(clean(m[2] ?? ""));
        else if (m && key && NOTE_LABELS.has(key)) continue;
        else if (!/^\s*#{1,6}\s/.test(raw)) plain.push(clean(raw));
      }
      const text = labelled.filter(Boolean).join("\n") || s.inline || plain.filter(Boolean).slice(0, 2).join("\n");
      return text.slice(0, 280);
    });
}
