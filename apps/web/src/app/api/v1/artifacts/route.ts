import { DomainError } from "@wonder/core";
import { createArtifact, isKnownArtifactType, listArtifacts } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";

export const GET = withApi(async ({ db, creatorId, req }) => ({
  artifacts: await listArtifacts(db, { creatorId, q: req.nextUrl.searchParams.get("q")?.slice(0, 200) ?? undefined, limit: 100 }),
}));

const blank = z.object({ artifactType: z.string(), title: z.string().trim().min(1).max(200), content: z.string().max(500000).default(""), materialIds: z.array(z.string().uuid()).max(12).default([]) });

/** Start from blank (or from material, creator-authored). AI creation goes through CreatorTalk. */
export const POST = withApi(async ({ db, creatorId, req }) => {
  const b = blank.parse(await readJson(req, 600_000));
  if (!isKnownArtifactType(b.artifactType)) throw new DomainError("validation", "Choose a kind of piece.");
  const artifact = await createArtifact(db, creatorId, {
    artifactType: b.artifactType,
    title: b.title,
    content: b.content,
    authorKind: "creator",
    sources: b.materialIds.map((id) => ({ type: "material" as const, id, relationship: "created_from" as const })),
    provenance: { origin: "typed" },
  });
  return { artifact };
});
