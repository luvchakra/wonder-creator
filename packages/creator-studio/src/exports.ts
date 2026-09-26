import { artifactType } from "./artifact-types";

/**
 * Export formats per kind of piece (P0.1-09). Client-safe. Pieces are text (prose, verse, screenplays, and
 * written concepts for visual, audio and video work), so exports are text formats; no format pretends to
 * produce media that doesn't exist.
 */
export const EXPORT_FORMATS = {
  md: { label: "Markdown", ext: "md", contentType: "text/markdown; charset=utf-8", note: "Keeps headings and emphasis" },
  txt: { label: "Plain text", ext: "txt", contentType: "text/plain; charset=utf-8", note: "Just the words" },
  html: { label: "Web page", ext: "html", contentType: "text/html; charset=utf-8", note: "Opens in any browser; print it to PDF" },
  fountain: { label: "Fountain screenplay", ext: "fountain", contentType: "text/plain; charset=utf-8", note: "For screenwriting apps" },
} as const;
export type ExportFormat = keyof typeof EXPORT_FORMATS;

export function exportFormatsFor(type: string): ExportFormat[] {
  const f = artifactType(type).format;
  if (f === "screenplay") return ["fountain", "txt", "md", "html"];
  return ["md", "txt", "html"];
}

/** A note shown with exports of written concepts for media pieces. */
export function exportNote(type: string): string | null {
  const t = artifactType(type);
  if (t.category === "visual" || t.category === "audio" || t.category === "video") return `This ${t.label.toLowerCase()} is a written concept; exports contain the text, not ${t.category} files.`;
  return null;
}

export function exportFilename(title: string, ext: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "artifact";
  return `${slug}.${ext}`;
}

export interface ExportSource {
  title: string;
  artifactType: string;
  description?: string | null;
  versionNumber: number;
  createdAt: string;
  content: string;
  byline?: string | null;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function renderExport(format: ExportFormat, src: ExportSource): { body: string; contentType: string; filename: string } {
  const f = EXPORT_FORMATS[format];
  const kind = artifactType(src.artifactType).label;
  const meta = `${kind} · v${src.versionNumber} · ${src.createdAt.slice(0, 10)}${src.byline ? ` · ${src.byline}` : ""}`;
  let body: string;
  if (format === "md") {
    const header = [`# ${src.title}`, "", `*${meta}*`, ""];
    if (src.description) header.push(`> ${src.description}`, "");
    body = `${header.join("\n")}\n${src.content}\n`;
  } else if (format === "txt") {
    body = `${src.title}\n${meta}\n\n${src.content}\n`;
  } else if (format === "fountain") {
    body = `Title: ${src.title}\n${src.byline ? `Author: ${src.byline}\n` : ""}Draft date: ${src.createdAt.slice(0, 10)}\n\n${src.content}\n`;
  } else {
    body = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(src.title)}</title>
<style>body{font:17px/1.7 Georgia,serif;max-width:40rem;margin:3rem auto;padding:0 1rem;color:#1f1b16;background:#fffdf9}h1{font-weight:normal;margin-bottom:.25rem}.meta{color:#6b6258;font:14px system-ui,sans-serif;margin-bottom:2rem}pre{white-space:pre-wrap;font:inherit}</style>
</head><body><h1>${escapeHtml(src.title)}</h1><p class="meta">${escapeHtml(meta)}</p>${src.description ? `<p><em>${escapeHtml(src.description)}</em></p>` : ""}<pre>${escapeHtml(src.content)}</pre></body></html>
`;
  }
  return { body, contentType: f.contentType, filename: exportFilename(src.title, f.ext) };
}
