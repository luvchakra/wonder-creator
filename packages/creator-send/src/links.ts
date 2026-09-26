/** URL helpers for CreatorSend (pure; network access lives in the ingestion adapters). */

export function parseYouTubeId(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] || null;
  else if (host === "youtube.com" || host === "music.youtube.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
      if (m) id = m[2];
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

const URL_RE = /\bhttps?:\/\/[^\s<>"'`)\]]+/gi;

/** Split pasted content into links and remaining text ("multiple URLs" intake). */
export function splitLinks(text: string): { urls: string[]; rest: string } {
  const urls = [...new Set((text.match(URL_RE) ?? []).map((u) => u.replace(/[.,;:!?]+$/, "")))].slice(0, 20);
  const rest = text.replace(URL_RE, " ").replace(/[ \t]+/g, " ").trim();
  return { urls, rest };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function meta(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeEntities(content).trim() : null;
}

export interface PageSummary {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  text: string;
}

/** Extract readable metadata/text from untrusted HTML without executing anything. */
export function extractPage(html: string, baseUrl: string): PageSummary {
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const title = meta(clean, "og:title") ?? decodeEntities(clean.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim() ?? null;
  const description = meta(clean, "og:description") ?? meta(clean, "description");
  let image = meta(clean, "og:image");
  if (image) {
    try {
      const u = new URL(image, baseUrl);
      image = u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
    } catch {
      image = null;
    }
  }
  const body = clean.match(/<(article|main)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? clean.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? clean;
  const text = decodeEntities(
    body
      .replace(/<(br|\/p|\/h[1-6]|\/li|\/div)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t\r]+/g, " ")
      .replace(/\n\s*\n+/g, "\n\n"),
  )
    .trim()
    .slice(0, 50000);
  return { title: title || null, description, image, siteName: meta(clean, "og:site_name"), text };
}
