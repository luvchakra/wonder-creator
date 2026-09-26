import { createShareLink, getArtifact, listShares, shareWithCreator } from "@wonder/creator-studio";
import { DomainError } from "@wonder/core";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** The owner's shares of a piece: private links and named creators, live and past. */
export const GET = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  const a = await getArtifact(db, requireUuid(id, "piece"));
  if (a.creator_id !== creatorId) throw new DomainError("not_found", "We couldn't find that piece.");
  return { shares: await listShares(db, a.id) };
});

/** Create a private link (its token is returned once) or share with a creator by @handle. */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  const artifactId = requireUuid(id, "piece");
  const body = (await readJson(req)) as { kind?: string };
  const kind = z.enum(["link", "creator"]).parse(body.kind);
  if (kind === "link") {
    const { share, token } = await createShareLink(db, creatorId, artifactId, body);
    const origin = req.nextUrl.origin;
    return { shareId: share.id, url: `${origin}/s/${token}`, embedUrl: share.allow_embed ? `${origin}/embed/${token}` : null };
  }
  return { share: await shareWithCreator(db, creatorId, artifactId, body) };
}, { rateLimit: 30 });
