import { providerReadiness } from "@wonder/creator-brain";
import { signedUrlsFor } from "@wonder/creator-library";
import { getConversation, listConversations } from "@wonder/creator-talk";
import { requireSession } from "@/lib/session";
import { Talk } from "./talk";

export const metadata = { title: "Create" };

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ c?: string; prompt?: string; artifact?: string; material?: string }> }) {
  const { db, creator } = await requireSession();
  const sp = await searchParams;
  const conversations = await listConversations(db, 40);
  const cid = sp.c && /^[0-9a-f-]{36}$/i.test(sp.c) ? sp.c : null;
  const convo = cid ? await getConversation(db, cid).catch(() => null) : null;

  const attachments = (convo?.messages ?? []).flatMap((m) => (m.conversation_attachments as Array<{ material_id: string | null; artifact_id: string | null }>) ?? []);
  const preselected = [sp.material].filter((x): x is string => !!x && /^[0-9a-f-]{36}$/i.test(x));
  const materialIds = [...new Set([...attachments.map((a) => a.material_id).filter((x): x is string => !!x), ...preselected])];
  const { data: mats } = materialIds.length
    ? await db.from("creative_materials").select("id, type, title, text_content, storage_object_id, metadata, source_url, created_at, processing_state").in("id", materialIds)
    : { data: [] };
  const urls = await signedUrlsFor(db, (mats ?? []).map((m) => m.storage_object_id));
  const artifactId = sp.artifact && /^[0-9a-f-]{36}$/i.test(sp.artifact) ? sp.artifact : null;
  const focusArtifact = artifactId ? (await db.from("artifacts").select("id, title, artifact_type").eq("id", artifactId).maybeSingle()).data : null;

  return (
    <Talk
      key={convo?.conversation.id ?? "new"}
      conversations={conversations.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at }))}
      conversation={convo ? { id: convo.conversation.id, title: convo.conversation.title } : null}
      initialMessages={(convo?.messages ?? []).map((m) => ({
        id: m.id,
        role: m.role as "creator" | "brain",
        kind: m.kind,
        content: m.content,
        payload: m.payload as Record<string, unknown>,
        createdAt: m.created_at,
        materialIds: ((m.conversation_attachments as Array<{ material_id: string | null }>) ?? []).map((a) => a.material_id).filter((x): x is string => !!x),
      }))}
      materials={Object.fromEntries((mats ?? []).map((m) => [m.id, { ...m, previewUrl: m.storage_object_id ? urls[m.storage_object_id] ?? null : null }]))}
      preselectedMaterialIds={preselected}
      focusArtifact={focusArtifact}
      prompt={sp.prompt?.slice(0, 500)}
      creatorName={creator.display_name}
      offline={!providerReadiness().live}
    />
  );
}
