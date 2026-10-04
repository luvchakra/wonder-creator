import { getMaterial, listCollections, signedUrlFor, signedUrlsFor, similarMaterials } from "@wonder/creator-library";
import { entityDejaVus } from "@wonder/creator-moments";
import { notFound } from "next/navigation";
import { ContextBack } from "@/components/context-back";
import { DejaVuChips } from "@/components/dejavu/dejavu-chips";
import { PaletteScope } from "@/components/creative-palette";
import { requireSession } from "@/lib/session";
import { MaterialDetail } from "./detail";

export const metadata = { title: "Material" };

const KIND_LABEL: Record<string, string> = {
  idea: "Idea",
  reference: "Reference",
  research: "Research",
  conversation: "Conversation",
  inspiration: "Inspiration",
  image: "Photo",
  sketch: "Sketch",
  voice: "Voice",
  audio: "Audio",
  video: "Video",
  note: "Note",
  text: "Note",
  document: "Document",
  pdf: "Document",
  url: "Link",
};

export default async function MaterialPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { id } = await params;
  const { from } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const m = await getMaterial(db, id).catch(() => null);
  if (!m) notFound();
  const [url, intake, usedIn, collections, memberships, similar] = await Promise.all([
    m.storage_object_id ? signedUrlFor(db, m.storage_object_id, 900) : Promise.resolve(null),
    db.from("intake_items").select("id, state, error_message").eq("material_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("lineage_edges").select("target_id, relationship").eq("source_type", "material").eq("source_id", id).eq("target_type", "artifact"),
    listCollections(db).catch(() => []),
    db.from("material_collection_items").select("collection_id").eq("material_id", id),
    similarMaterials(db, id).catch(() => []),
  ]);
  const dejavus = await entityDejaVus(db, "material", id).catch(() => ({ momentId: null, dejavus: [] }));
  const thumbs = await signedUrlsFor(
    db,
    similar.filter((s) => s.type === "image" || s.type === "sketch").map((s) => s.storage_object_id),
  );
  const artIds = (usedIn.data ?? []).map((e) => e.target_id);
  const { data: arts } = artIds.length ? await db.from("artifacts").select("id, title, artifact_type").in("id", artIds) : { data: [] };
  const obj = m.storage_object_id ? (await db.from("storage_objects").select("mime_type, size_bytes, original_filename, sha256").eq("id", m.storage_object_id).maybeSingle()).data : null;
  const related = (m.title ?? "").trim().slice(0, 60);
  // Navbar Context Strip: what it is and when, or what's happening to it (context-strip §11.5–11.8).
  const kind = KIND_LABEL[m.type] ?? "Material";
  const settled = ["ready", "understood", "failed", "quarantined"].includes(m.processing_state);
  const strip = {
    kindLabel: kind,
    date: new Date(m.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
    processing: settled ? null : m.type === "voice" || m.type === "audio" ? "Transcribing…" : "Understanding…",
  };
  return (
    <>
      <ContextBack db={db} from={from} />
      <PaletteScope
        context={{
          page: "material",
          entityType:
            m.type === "image" || m.type === "sketch"
              ? "photo"
              : m.type === "voice" || m.type === "audio"
                ? "audio"
                : m.type === "video"
                  ? "video"
                  : m.type === "url"
                    ? "link"
                    : m.type === "document" || m.type === "pdf"
                      ? "document"
                      : "note",
          permissions: m.creator_id === creator.id ? ["edit"] : [],
          ids: { materialId: id },
          facts: { related: related || null },
          strip,
        }}
      />
      <MaterialDetail
        dejavu={<DejaVuChips entityType="material" entityId={id} initial={dejavus} />}
        canGenerate={m.creator_id === creator.id}
        m={{
          id: m.id,
          type: m.type,
          title: m.title,
          description: m.description,
          sourceNote: m.source_note,
          text: m.text_content,
          extracted: m.extracted_text,
          sourceUrl: m.source_url,
          metadata: m.metadata as Record<string, unknown>,
          understanding: m.understanding as {
            summary?: string;
            themes?: string[];
            moods?: string[];
          } | null,
          status: m.status,
          processing: m.processing_state,
          security: m.security_status,
          createdAt: m.created_at,
          tags: ((m.creative_material_tags as Array<{ tag: string }>) ?? []).map((t) => t.tag),
          provenance: m.provenance_records as {
            origin: string;
            original_filename: string | null;
            sha256: string | null;
            received_at: string;
            source_url: string | null;
          } | null,
        }}
        url={url}
        file={obj}
        intake={intake.data}
        usedIn={arts ?? []}
        collections={collections.map((c) => ({ id: c.id, name: c.name }))}
        inCollections={(memberships.data ?? []).map((r) => r.collection_id)}
        similar={similar.map((s) => ({
          id: s.id,
          title: s.title,
          type: s.type,
          thumb: s.storage_object_id ? (thumbs[s.storage_object_id] ?? null) : null,
        }))}
      />
    </>
  );
}
