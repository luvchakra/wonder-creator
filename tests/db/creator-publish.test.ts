import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { planPublishing, selectProvider } from "@wonder/creator-brain";
import { setAutonomy } from "@wonder/creator-identity";
import {
  addWebhookDestination,
  approvePublication,
  attemptPublication,
  cancelPublication,
  createArtifact,
  getPublishingPreferences,
  preparePublications,
  publishingOverview,
  savePublishingPreferences,
  updatePublication,
} from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk, type TestCreator } from "./helpers";

let a: TestCreator;
let b: TestCreator;
let piece: string;
let hook: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;
const service = adminClient() as unknown as AppDb;
const provider = selectProvider({ WONDERCREATOR_AI_PROVIDER: "offline" });
const bodies: string[] = [];
const fetchImpl = (async (_url: URL, init: RequestInit) => {
  bodies.push(String(init.body));
  return Response.json({ id: "post-9", url: "https://example.com/p/9" });
}) as unknown as typeof fetch;
const deps = () => ({ service, creatorId: a.creatorId, appOrigin: "https://app.example", fetchOptions: { resolve: async () => ["93.184.216.34"], fetchImpl } });

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("cpOwner"), createTestCreator("cpOther")]);
  piece = (await createArtifact(db(a), a.creatorId, { artifactType: "poem", title: "Tide Tables", content: "The sea keeps its own hours.", authorKind: "creator", provenance: { origin: "typed" } })).id;
  hook = (await addWebhookDestination(db(a), a.creatorId, { name: "My site", url: "https://hooks.example.com/wonder" })).id;
});
afterAll(cleanupTestCreators);

describe("preferences", () => {
  it("are private, validated and only prefill", async () => {
    expect(await getPublishingPreferences(db(a), a.creatorId)).toMatchObject({ defaultDestinations: [], defaultTags: [], preferredTime: null });
    await expect(savePublishingPreferences(db(a), a.creatorId, { timeZone: "Mars/Olympus" })).rejects.toThrow();
    await savePublishingPreferences(db(a), a.creatorId, { defaultDestinations: [hook], defaultTags: ["#poetry", "sea", "poetry"], preferredTime: "18:30", timeZone: "Asia/Kolkata", captionStyle: "Short." });
    expect(await getPublishingPreferences(db(a), a.creatorId)).toMatchObject({ defaultDestinations: [hook], defaultTags: ["poetry", "sea"], preferredTime: "18:30", timeZone: "Asia/Kolkata" });
    expect(expectOk(await b.client.from("publishing_preferences").select("creator_id"))).toEqual([]);
    const forged = await b.client.from("publishing_preferences").insert({ creator_id: a.creatorId });
    expect(forged.error).toBeTruthy();
  });
});

describe("per-destination preparation and metadata", () => {
  it("shares copy, customizes per destination, sends metadata with the webhook, and freezes it on approval", async () => {
    const drafts = await preparePublications(db(a), a.creatorId, piece, {
      destinations: [{ kind: "profile" }, { kind: "webhook", id: hook }],
      title: "Tide Tables",
      caption: "A new poem.",
      metadata: { tags: ["poetry"], altText: "Waves at dusk" },
      perDestination: { [hook]: { caption: "New on the blog: a poem about the sea.", metadata: { tags: ["sea"], link: "https://example.com/tide" } } },
    });
    const byKind = Object.fromEntries(drafts.map((d) => [d.destination_kind, d]));
    expect(byKind.profile).toMatchObject({ caption: "A new poem.", metadata: { tags: ["poetry"], altText: "Waves at dusk" } });
    expect(byKind.webhook).toMatchObject({ caption: "New on the blog: a poem about the sea.", metadata: { tags: ["sea"], altText: "Waves at dusk", link: "https://example.com/tide" } });
    await expect(preparePublications(db(a), a.creatorId, piece, { destinations: [{ kind: "profile" }], title: "x", metadata: { link: "http://insecure" } })).rejects.toThrow();

    // Editing tags keeps the rest of the metadata.
    await updatePublication(db(a), byKind.webhook!.id, { metadata: { tags: ["sea", "poetry"] } });
    await approvePublication(db(a), byKind.webhook!.id);
    const done = await attemptPublication(deps(), byKind.webhook!.id);
    expect(done.status).toBe("published");
    expect(JSON.parse(bodies.at(-1)!).metadata).toEqual({ tags: ["sea", "poetry"], altText: "Waves at dusk", link: "https://example.com/tide" });
    await expect(updatePublication(db(a), byKind.webhook!.id, { metadata: { tags: ["late"] } })).rejects.toThrow(/already approved/);
    await cancelPublication(db(a), byKind.profile!.id);
  });

  it("the overview shows the queue and history across pieces, and only the creator's own", async () => {
    const [p] = await preparePublications(db(a), a.creatorId, piece, { destinations: [{ kind: "profile" }], title: "Again" });
    const o = await publishingOverview(db(a));
    expect(o.queue.map((q) => q.id)).toContain(p!.id);
    expect(o.queue.find((q) => q.id === p!.id)!.artifacts).toMatchObject({ title: "Tide Tables" });
    expect(o.history.map((h) => h.status).sort()).toEqual(["cancelled", "published"]);
    expect((await publishingOverview(db(b))).queue).toEqual([]);
  });
});

describe("CreatorBrain publishing plan", () => {
  it("offline, follows preferences; owner only; governed by Publishing autonomy; prepares nothing", async () => {
    const before = expectOk(await service.from("publications").select("id").eq("artifact_id", piece)).length;
    const plan = await planPublishing({ db: db(a), creatorId: a.creatorId, provider }, piece);
    expect(plan.offline).toBe(true);
    expect(plan.destinations.map((d) => d.key)).toEqual([hook]);
    expect(plan.adaptations[0]).toMatchObject({ key: hook, tags: ["poetry", "sea"] });
    expect(Date.parse(plan.schedule[0]!.at!)).toBeGreaterThan(Date.now());
    expect(expectOk(await service.from("publications").select("id").eq("artifact_id", piece)).length).toBe(before);
    await expect(planPublishing({ db: db(b), creatorId: b.creatorId, provider }, piece)).rejects.toThrow(/couldn't find/);
    await setAutonomy(db(a), a.creatorId, "publishing", "never");
    await expect(planPublishing({ db: db(a), creatorId: a.creatorId, provider }, piece)).rejects.toThrow(/Creator Autonomy/);
  });
});
