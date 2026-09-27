import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addWebhookDestination, createArtifact, publicationOutcomes, recordPlatformMetrics, signWebhook, formatOutcome } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk, type TestCreator } from "./helpers";

const admin = adminClient() as unknown as AppDb;
let maya: TestCreator;
let other: TestCreator;
let pubId: string;
let secret: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;

async function report(body: object, opts: { secret?: string; ts?: number } = {}) {
  const raw = JSON.stringify(body);
  const ts = opts.ts ?? Math.floor(Date.now() / 1000);
  const sig = `v1=${await signWebhook(opts.secret ?? secret, ts, raw)}`;
  return recordPlatformMetrics(admin, { publicationId: pubId, timestamp: String(ts), signature: sig, body: raw });
}

beforeAll(async () => {
  [maya, other] = await Promise.all(["metMaya", "metOther"].map((l) => createTestCreator(l)));
  const piece = (await createArtifact(db(maya), maya.creatorId, { artifactType: "poem", title: "Harbour", content: "The harbour keeps its lights.", authorKind: "creator", provenance: { origin: "typed" } })).id;
  const dest = await addWebhookDestination(db(maya), maya.creatorId, { name: "My site", url: "https://hooks.example.com/wonder" });
  secret = dest.signing_secret;
  // Published by the pipeline (clients can't set outcomes).
  pubId = expectOk(
    await admin
      .from("publications")
      .insert({ artifact_id: piece, creator_id: maya.creatorId, destination_kind: "webhook", destination_id: dest.id, destination_name: "My site", title: "Harbour", status: "published", published_at: new Date().toISOString() })
      .select("id")
      .single(),
  ).id;
});
afterAll(cleanupTestCreators);

describe("platform-reported outcomes (P1-20)", () => {
  it("stores signed reports from the destination and shows the latest numbers, never a score", async () => {
    expect(await report({ observedAt: "2026-09-27T10:00:00Z", metrics: { views: 900, shares: 20 } })).toEqual({ stored: 2 });
    expect(await report({ observedAt: "2026-09-27T12:00:00Z", metrics: { views: 1204, shares: 38 } })).toEqual({ stored: 2 });
    const [o] = await publicationOutcomes(db(maya), { publicationIds: [pubId] });
    expect(o).toMatchObject({ publicationId: pubId, reportedBy: "My site" });
    expect(o!.metrics.map((m) => [m.metric, m.value])).toEqual([
      ["views", 1204],
      ["shares", 38],
    ]);
    expect(formatOutcome(o!)).toBe("1,204 views · 38 shares");
  });

  it("refuses unsigned, wrongly signed, stale, unknown and like metrics", async () => {
    await expect(report({ metrics: { views: 1 } }, { secret: "x".repeat(40) })).rejects.toThrow(/Signature/);
    await expect(report({ metrics: { views: 1 } }, { ts: Math.floor(Date.now() / 1000) - 3600 })).rejects.toThrow(/signed for now/);
    await expect(recordPlatformMetrics(admin, { publicationId: pubId, timestamp: null, signature: null, body: "{}" })).rejects.toThrow(/signed for now/);
    await expect(report({ metrics: { likes: 500 } })).rejects.toThrow(/Not accepted: likes/);
    await expect(report({ metrics: { quality_score: 9 } })).rejects.toThrow(/Not accepted/);
    await expect(report({ metrics: { views: -3 } })).rejects.toThrow();
  });

  it("is the creator's own: others see nothing and nobody writes directly", async () => {
    expect(await publicationOutcomes(db(other), { publicationIds: [pubId] })).toEqual([]);
    expect(expectOk(await db(other).from("publication_metrics").select("id").eq("publication_id", pubId))).toEqual([]);
    const { data: row } = await admin.from("publications").select("artifact_id").eq("id", pubId).single();
    expect((await db(maya).from("publication_metrics").insert({ publication_id: pubId, creator_id: maya.creatorId, artifact_id: row!.artifact_id, reported_by: "me", metric: "views", value: 1e9, observed_at: new Date().toISOString() })).error).not.toBeNull();
  });
});
