import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { selectProvider, transform } from "@wonder/creator-brain";
import { addWebhookDestination, approvePublication, attemptPublication, createArtifact, listDerivatives, preparePublications, saveCreatorVersion } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk, type TestCreator } from "./helpers";

let a: TestCreator;
let b: TestCreator;
let film: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;
const service = adminClient() as unknown as AppDb;
const provider = selectProvider({ WONDERCREATOR_AI_PROVIDER: "offline" });
const bodies: string[] = [];
const fetchImpl = (async (_url: URL, init: RequestInit) => {
  bodies.push(String(init.body));
  return Response.json({ id: "yt-1" });
}) as unknown as typeof fetch;

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("pdOwner"), createTestCreator("pdOther")]);
  film = (await createArtifact(db(a), a.creatorId, { artifactType: "short_film", title: "Low Tide", content: "EXT. BEACH - DAWN\nA girl waits for the tide.", authorKind: "creator", provenance: { origin: "typed" } })).id;
});
afterAll(cleanupTestCreators);

describe("publication derivatives", () => {
  it("are real derivatives: made for a destination, from a source version, with inherited rights, and link back when published", async () => {
    const v1 = expectOk(await service.from("artifacts").select("current_version_id").eq("id", film).single()).current_version_id!;
    const { artifact: desc } = await transform({ db: db(a), creatorId: a.creatorId, provider }, { artifactId: film, targetType: "video_description", instruction: "YouTube description", madeFor: "YouTube" });
    // A newer source version doesn't change what an existing derivative came from.
    await saveCreatorVersion(db(a), film, { content: "EXT. BEACH - DUSK\nThe tide returns.", baseVersionId: v1 });
    await transform({ db: db(a), creatorId: a.creatorId, provider }, { artifactId: film, targetType: "trailer", instruction: "Trailer", madeFor: "Trailer" });

    const list = await listDerivatives(db(a), film);
    expect(list.map((d) => [d.type, d.madeFor, d.sourceVersion])).toEqual([
      ["trailer", "Trailer", 2],
      ["video_description", "YouTube", 1],
    ]);
    expect(list[1]!.rights).toMatchObject({ attributionRequired: expect.any(Boolean) });

    // Publishing the derivative still needs approval; the payload says what it was adapted from.
    const hook = (await addWebhookDestination(db(a), a.creatorId, { name: "Channel", url: "https://hooks.example.com/yt" })).id;
    const [p] = await preparePublications(db(a), a.creatorId, desc.id, { destinations: [{ kind: "webhook", id: hook }], title: "Low Tide" });
    expect((await listDerivatives(db(a), film)).find((d) => d.id === desc.id)!.publications).toEqual([expect.objectContaining({ destination: "Channel", status: "draft" })]);
    await approvePublication(db(a), p!.id);
    await attemptPublication({ service, creatorId: a.creatorId, appOrigin: "https://app.example", fetchOptions: { resolve: async () => ["93.184.216.34"], fetchImpl } }, p!.id);
    const payload = JSON.parse(bodies.at(-1)!);
    expect(payload.artifact).toMatchObject({ type: "video_description", madeFor: "YouTube" });
    expect(payload.derivedFrom).toEqual({ id: film, title: "Low Tide" });

    // Other creators don't see someone's derivatives.
    expect(await listDerivatives(db(b), film)).toEqual([]);
  });
});
