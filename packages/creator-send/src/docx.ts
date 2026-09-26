import { strFromU8, unzipSync } from "fflate";

const DOCUMENT_PART = "word/document.xml";
/** Cap on the decompressed main document part; guards against zip bombs. */
const MAX_DOCUMENT_XML_BYTES = 20 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/**
 * Plain text of a Word (.docx) document: paragraphs, tabs and line breaks from the main document
 * part. Only `word/document.xml` is decompressed, and only when its declared size is within bounds.
 * Returns null when the file isn't a readable .docx.
 */
export function extractDocxText(bytes: Uint8Array): string | null {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => f.name === DOCUMENT_PART && f.originalSize <= MAX_DOCUMENT_XML_BYTES });
  } catch {
    return null;
  }
  const part = files[DOCUMENT_PART];
  if (!part || part.byteLength > MAX_DOCUMENT_XML_BYTES) return null;
  const xml = strFromU8(part);

  let out = "";
  const token = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:(?:br|cr)(?:\s[^>]*)?\/>|<\/w:p>/g;
  for (let m = token.exec(xml); m; m = token.exec(xml)) {
    if (m[1] !== undefined) out += decodeEntities(m[1]);
    else if (m[0] === "<w:tab/>") out += "\t";
    else if (m[0] === "</w:p>") out += "\n";
    else out += "\n";
    if (out.length > MAX_TEXT_CHARS) break;
  }
  const text = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return text ? text.slice(0, MAX_TEXT_CHARS) : "";
}
