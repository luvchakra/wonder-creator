import { refine } from "@wonder/creator-brain";
import { sourceDetail, USAGE_LABEL, workingSetView } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";
import { studioSigner } from "@/lib/studio";

export const maxDuration = 300;

const schema = z.object({
  instruction: z.string().trim().min(1).max(2000),
  action: z.string().max(40).optional(),
  /** Working Set rows to work from ("Use this" in the Studio). Read here, as the creator; never taken from the client. */
  sourceIds: z.array(z.string().uuid()).max(6).optional(),
});

export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req, requestId }, { id }) => {
    const b = schema.parse(await readJson(req));
    const artifactId = requireUuid(id, "Creation");
    let sources: Array<{ title: string; use: string; text: string }> | undefined;
    if (b.sourceIds?.length) {
      const { data: rows } = await db.from("studio_sources").select("id, session_id").in("id", b.sourceIds);
      const sessionId = rows?.[0]?.session_id;
      const { data: s } = sessionId ? await db.from("studio_sessions").select("artifact_id").eq("id", sessionId).maybeSingle() : { data: null };
      if (sessionId && s?.artifact_id === artifactId) {
        const view = await workingSetView(db, sessionId, studioSigner(db));
        sources = [];
        for (const r of view.sources.filter((x) => x.available && b.sourceIds!.includes(x.id))) {
          const text = (r.fragment?.text ?? (await sourceDetail(db, r.id)).text ?? "").trim();
          sources.push({ title: r.title, use: r.usageNote ?? (r.usageIntent ? USAGE_LABEL[r.usageIntent] : "Use it"), text: text || `(${r.kind}; no words — use what its title and kind suggest)` });
        }
      }
    }
    return refine(await brainDeps(db, creatorId, { correlationId: requestId }), { artifactId, instruction: b.instruction, action: b.action ?? null, sources });
  },
  { rateLimit: 20, reindex: true },
);
