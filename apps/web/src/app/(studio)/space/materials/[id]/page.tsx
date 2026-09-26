import { getMaterial, listShelves, signedUrlFor } from "@wonder/creator-library";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { MaterialDetail } from "./detail";

export const metadata = { title: "Material" };

export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await requireSession();
  const m = await getMaterial(db, id).catch(() => null);
  if (!m) notFound();
  const [url, shelves, intake, usedIn] = await Promise.all([
    m.storage_object_id ? signedUrlFor(db, m.storage_object_id, 900) : Promise.resolve(null),
    listShelves(db),
    db.from("intake_items").select("id, state, error_message").eq("material_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("lineage_edges").select("target_id, relationship").eq("source_type", "material").eq("source_id", id).eq("target_type", "artifact"),
  ]);
  const artIds = (usedIn.data ?? []).map((e) => e.target_id);
  const { data: arts } = artIds.length ? await db.from("artifacts").select("id, title, artifact_type").in("id", artIds) : { data: [] };
  const obj = m.storage_object_id ? (await db.from("storage_objects").select("mime_type, size_bytes, original_filename, sha256").eq("id", m.storage_object_id).maybeSingle()).data : null;
  return (
    <MaterialDetail
      m={{
        id: m.id,
        type: m.type,
        title: m.title,
        text: m.text_content,
        extracted: m.extracted_text,
        sourceUrl: m.source_url,
        metadata: m.metadata as Record<string, unknown>,
        understanding: m.understanding as { summary?: string; themes?: string[]; moods?: string[] } | null,
        status: m.status,
        processing: m.processing_state,
        security: m.security_status,
        createdAt: m.created_at,
        tags: ((m.creative_material_tags as Array<{ tag: string }>) ?? []).map((t) => t.tag),
        provenance: m.provenance_records as { origin: string; original_filename: string | null; sha256: string | null; received_at: string; source_url: string | null } | null,
      }}
      url={url}
      file={obj}
      intake={intake.data}
      shelves={shelves.map((s) => ({ id: s.id, name: s.name }))}
      usedIn={arts ?? []}
    />
  );
}
