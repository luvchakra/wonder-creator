import { ImageResponse } from "next/og";
import { loadPublicWork, siteOrigin } from "@/lib/public-pages";

export const alt = "A published work on Wonder Creator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The share preview (docs/creator-publish.md §28), shaped by the kind of work: a carousel says "5-slide visual story",
 * a film its length, a recording its kind and length, an essay a short excerpt, a photograph is simply the picture.
 */
export default async function Image({ params }: { params: Promise<{ handle: string; slug: string }> }) {
  const { handle, slug } = await params;
  const work = await loadPublicWork(handle, slug);
  const origin = await siteOrigin();
  if (!work || work.preview) return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", background: "#f7f2ea" }} />, size);
  const m = work.manifest;
  const s = work.snapshot;
  const cover = m.coverObjectId ? work.media[m.coverObjectId] : null;
  const dark = m.theme === "cinematic" || m.theme === "dark";
  const line =
    m.experience === "swipe" ? `${s.slides?.length ?? 0}-slide visual story` : m.experience === "view" ? s.typeLabel : m.experience === "read" && !m.poem ? (s.description?.trim() || s.content.replace(/\s+/g, " ").trim()).slice(0, 140) : m.descriptor;
  if (m.experience === "view" && cover)
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#111" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${origin}${cover}`} alt="" width={1200} height={630} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
      </div>,
      size,
    );
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: dark ? "#0f0c12" : "#f7f2ea", color: dark ? "#fff" : "#1f1a2b" }}>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${origin}${cover}`} alt="" width={520} height={630} style={{ objectFit: "cover", width: 520, height: 630 }} />
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 64, flex: 1 }}>
        <div style={{ fontSize: 24, opacity: 0.7 }}>{work.creator.name}</div>
        <div style={{ fontSize: 64, lineHeight: 1.1, marginTop: 12, fontWeight: 600 }}>{s.title.slice(0, 80)}</div>
        <div style={{ fontSize: 28, marginTop: 20, opacity: 0.8 }}>{line}</div>
        <div style={{ fontSize: 20, marginTop: 40, opacity: 0.55, letterSpacing: 4 }}>WONDER CREATOR</div>
      </div>
    </div>,
    size,
  );
}
