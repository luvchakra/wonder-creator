import { createHash } from "node:crypto";
import { ConnectorError, cancelSync, importCandidate, indexPhotos, nativeNotes, requestSync, runSyncJobs, DEFAULT_BUDGETS, type Connector, type SourcesDeps } from "@wonder/creator-sources/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, cleanupTestCreators, createProvenance, createTestCreator, expectDenied, expectNoRowsAffected, expectOk, loose, registerStorageObject, type TestCreator } from "./helpers";

/**
 * Personal Sources (docs/personal-sources.md): RLS on every table, credentials server-only, and the sync pipeline's
 * guarantees — bounded, deduplicated, resumable, cancellable, isolated per source, and nothing imported without a choice.
 */
const admin = adminClient();
let a: TestCreator;
let b: TestCreator;

const DAY = 86_400_000;
const budgets = { ...DEFAULT_BUDGETS, sliceMs: 20_000, staleMs: 120_000 };
const deps = (over: Partial<SourcesDeps> = {}): SourcesDeps => ({ service: admin, connectors: { native_notes: nativeNotes }, budgets, ...over });

async function note(c: TestCreator, title: string, text: string, place?: string, daysAgo = 1) {
  const provenance_id = await createProvenance(c);
  const at = new Date(Date.now() - daysAgo * DAY).toISOString();
  return expectOk(
    await admin
      .from("creative_materials")
      .insert({ creator_id: c.creatorId, type: "note", title, text_content: text, provenance_id, metadata: place ? { place } : {}, created_at: at, updated_at: at })
      .select("id")
      .single(),
  ).id;
}
async function connectNotes(c: TestCreator) {
  return expectOk(await c.client.from("source_connections").insert({ creator_id: c.creatorId, provider: "native_notes" }).select("id").single()).id;
}

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("srcA"), createTestCreator("srcB")]);
});
afterAll(cleanupTestCreators);

describe("Personal Sources — access rules", () => {
  it("a creator connects their own notes, but never a mail/calendar source directly or for someone else", async () => {
    expectDenied(await a.client.from("source_connections").insert({ creator_id: a.creatorId, provider: "gmail" }));
    expectDenied(await a.client.from("source_connections").insert({ creator_id: b.creatorId, provider: "native_notes" }));
    expectDenied(await loose(a.client).from("source_connections").insert({ creator_id: a.creatorId, provider: "native_notes", status: "syncing" }));
    const id = await connectNotes(a);
    expect(expectOk(await b.client.from("source_connections").select("id"))).toEqual([]);
    // Status and timestamps belong to the pipeline.
    expectDenied(await loose(a.client).from("source_connections").update({ status: "error" }).eq("id", id));
    expectOk(await a.client.from("source_connections").update({ scope_settings: { lookback: 30 } }).eq("id", id));
    expectNoRowsAffected(await b.client.from("source_connections").delete().eq("id", id).select("id"));
  });

  it("credentials are stored in Vault by the server only and destroyed on disconnect", async () => {
    const id = expectOk(await admin.from("source_connections").insert({ creator_id: a.creatorId, provider: "gmail", status: "connected" }).select("id").single()).id;
    expectDenied(await loose(a.client).rpc("source_secret_store", { p_creator: a.creatorId, p_connection: id, p_secret: "refresh-token-xyz" }));
    expectDenied(await loose(a.client).rpc("source_secret_read", { p_creator: a.creatorId, p_connection: id }));
    expectDenied(await loose(b.client).rpc("source_secret_store", { p_creator: a.creatorId, p_connection: id, p_secret: "x" }));
    // The server can't store a credential against another creator's connection either.
    expect((await admin.rpc("source_secret_store", { p_creator: b.creatorId, p_connection: id, p_secret: "x" })).error).not.toBeNull();
    expectOk(await admin.rpc("source_secret_store", { p_creator: a.creatorId, p_connection: id, p_secret: "refresh-token-xyz" }));
    expect(expectOk(await admin.rpc("source_secret_read", { p_creator: a.creatorId, p_connection: id }))).toBe("refresh-token-xyz");
    expect(expectOk(await a.client.from("source_connections").select("*").eq("id", id)).map((r) => JSON.stringify(r)).join()).not.toContain("refresh-token");
    expect((await loose(a.client).from("source_connection_secrets").select("*")).data ?? []).toEqual([]);
    const vaultId = expectOk(await admin.from("source_connection_secrets").select("vault_secret_id").eq("connection_id", id).single()).vault_secret_id;
    expectOk(await a.client.from("source_connections").delete().eq("id", id));
    expect((await admin.rpc("source_secret_read", { p_creator: a.creatorId, p_connection: id })).data).toBeNull();
    const left = await admin.schema("vault" as never).from("secrets" as never).select("id").eq("id", vaultId);
    expect(left.data ?? []).toEqual([]);
    const audit = expectOk(await admin.from("audit_logs").select("action").eq("object_id", id));
    expect(audit.map((x) => x.action).sort()).toEqual(["personal_source.connected", "personal_source.disconnected"]);
  });

  it("only the pipeline writes the index and jobs; creators can cancel, dismiss and delete their own", async () => {
    const conn = expectOk(await admin.from("source_connections").select("id").eq("creator_id", a.creatorId).eq("provider", "native_notes").single()).id;
    expectDenied(await loose(a.client).from("source_context_records").insert({ creator_id: a.creatorId, connection_id: conn, provider_item_id: "x", source_type: "note" }));
    expectDenied(await loose(a.client).from("source_sync_jobs").insert({ creator_id: a.creatorId, connection_id: conn, idempotency_key: "k" }));
    expectDenied(await loose(a.client).from("context_candidates").insert({ creator_id: a.creatorId, signature: "s", title: "t" }));
    const job = expectOk(await admin.from("source_sync_jobs").insert({ creator_id: a.creatorId, connection_id: conn, idempotency_key: "rls-test", status: "completed" }).select("id").single()).id;
    expectDenied(await loose(a.client).from("source_sync_jobs").update({ status: "running" }).eq("id", job));
    expectOk(await a.client.from("source_sync_jobs").update({ cancel_requested: true }).eq("id", job));
    expectNoRowsAffected(await b.client.from("source_sync_jobs").update({ cancel_requested: true }).eq("id", job).select("id"));
    const cand = expectOk(await admin.from("context_candidates").insert({ creator_id: a.creatorId, signature: "rls", title: "A day" }).select("id").single()).id;
    expectDenied(await a.client.from("context_candidates").update({ state: "imported" }).eq("id", cand));
    expectNoRowsAffected(await b.client.from("context_candidates").update({ state: "dismissed" }).eq("id", cand).select("id"));
    expectOk(await a.client.from("context_candidates").update({ state: "dismissed" }).eq("id", cand));
    expect(expectOk(await b.client.from("context_candidates").select("id"))).toEqual([]);
    expect(expectOk(await b.client.from("source_sync_jobs").select("id"))).toEqual([]);
  });

  it("a repeated tap can't create a second active job, and records never duplicate", async () => {
    const conn = expectOk(await admin.from("source_connections").select("id").eq("creator_id", a.creatorId).eq("provider", "native_notes").single()).id;
    expectOk(await admin.from("source_sync_jobs").insert({ creator_id: a.creatorId, connection_id: conn, idempotency_key: "dup", status: "queued" }));
    expectDenied(await admin.from("source_sync_jobs").insert({ creator_id: a.creatorId, connection_id: conn, idempotency_key: "dup", status: "queued" }), "23505");
    expectDenied(await admin.from("source_sync_jobs").insert({ creator_id: a.creatorId, connection_id: conn, idempotency_key: "other", status: "running" }), "23505");
    await admin.from("source_sync_jobs").delete().eq("idempotency_key", "dup");
    const row = { creator_id: a.creatorId, connection_id: conn, provider_item_id: "same", source_type: "note" };
    expectOk(await admin.from("source_context_records").upsert(row, { onConflict: "connection_id,provider_item_id" }));
    expectOk(await admin.from("source_context_records").upsert({ ...row, safe_title: "again" }, { onConflict: "connection_id,provider_item_id" }));
    expect(expectOk(await admin.from("source_context_records").select("id").eq("provider_item_id", "same"))).toHaveLength(1);
    await admin.from("source_context_records").delete().eq("provider_item_id", "same");
  });

  it("allows the personal_source provenance origin", async () => {
    expectOk(await a.client.from("provenance_records").insert({ creator_id: a.creatorId, origin: "personal_source" }));
  });
});

describe("Personal Sources — sync pipeline", () => {
  let c: TestCreator;
  let conn: string;
  beforeAll(async () => {
    c = await createTestCreator("srcPipe");
    await note(c, "Café ideas", "Loved the quiet corners at Vohuman. The streets felt unusually quiet.", "Pune", 2);
    await note(c, "Sketches from Pune", "People, light, architecture —", "Pune", 2);
    await note(c, "Booking", "Your PNR: 4521889012, seat 32. Call +91 98765 43210.", "Pune", 2);
    await note(c, "Reset your password", "Use code 829114 to sign in", undefined, 2);
    await note(c, "Lighthouse", "What if the lighthouse kept every name it ever saw,", undefined, 120);
    conn = await connectNotes(c);
  });

  it("returns a job at once, reuses it on a repeated tap, indexes a bounded, redacted, sensitive-free set and checkpoints", async () => {
    const first = await requestSync(deps(), c.creatorId);
    expect(first.jobs).toHaveLength(1);
    const again = await requestSync(deps(), c.creatorId);
    expect(again.jobs[0]!.id).toBe(first.jobs[0]!.id);
    expect(again.jobs[0]!.reused).toBe(true);

    await runSyncJobs(deps(), { creatorId: c.creatorId });
    const job = expectOk(await admin.from("source_sync_jobs").select("*").eq("id", first.jobs[0]!.id).single());
    expect(job.status).toBe("completed");
    expect(job.indexed_count).toBe(4);
    const records = expectOk(await c.client.from("source_context_records").select("safe_title, safe_excerpt, material_id, hydration_level"));
    expect(records).toHaveLength(4);
    expect(JSON.stringify(records)).not.toMatch(/4521889012|98765|829114|password/i);
    expect(records.every((r) => r.material_id && r.hydration_level <= 2)).toBe(true);
    const cursor = expectOk(await c.client.from("source_sync_cursors").select("provider_cursor, last_successful_sync_at").eq("connection_id", conn).single());
    expect(cursor.provider_cursor).toBeTruthy();
    expect(cursor.last_successful_sync_at).toBeTruthy();
    expect(expectOk(await c.client.from("source_connections").select("status, last_successful_sync_at").eq("id", conn).single())).toMatchObject({ status: "connected" });

    // Cheap grouping found the day in Pune (with the creator's own words) and the unfinished thought.
    const cands = expectOk(await c.client.from("context_candidates").select("title, quote, state").order("score", { ascending: false }));
    expect(cands.map((x) => x.title)).toEqual(expect.arrayContaining(["An unfinished thought", expect.stringMatching(/ in Pune$/)]));
    expect(cands.find((x) => x.title.endsWith("in Pune"))!.quote).toBe("Loved the quiet corners at Vohuman.");
  });

  it("the next sync only looks at what changed since the checkpoint", async () => {
    const r = await requestSync(deps(), c.creatorId);
    await runSyncJobs(deps(), { creatorId: c.creatorId });
    expect(expectOk(await admin.from("source_sync_jobs").select("status, scanned_count").eq("id", r.jobs[0]!.id).single())).toMatchObject({ status: "completed", scanned_count: 0 });
    await note(c, "New one", "Platform 3 at dawn.", undefined, 0);
    const r2 = await requestSync(deps(), c.creatorId);
    await runSyncJobs(deps(), { creatorId: c.creatorId });
    expect(expectOk(await admin.from("source_sync_jobs").select("scanned_count").eq("id", r2.jobs[0]!.id).single()).scanned_count).toBe(1);
  });

  it("stops at its budget and says so (partially complete), then continues from the checkpoint", async () => {
    const d = await createTestCreator("srcBudget");
    for (let i = 0; i < 5; i++) await note(d, `Note ${i}`, `Thought number ${i}.`, undefined, 3);
    await connectNotes(d);
    const tight = deps({ budgets: { ...budgets, pageSize: 2, quickRecordCap: 3 } });
    const r = await requestSync(tight, d.creatorId);
    await runSyncJobs(tight, { creatorId: d.creatorId });
    expect(expectOk(await admin.from("source_sync_jobs").select("status, scanned_count, phase").eq("id", r.jobs[0]!.id).single())).toMatchObject({ status: "partially_complete", phase: "limit" });
    expect(expectOk(await d.client.from("source_connections").select("status").single()).status).toBe("partially_synced");
    const r2 = await requestSync(tight, d.creatorId);
    await runSyncJobs(tight, { creatorId: d.creatorId });
    expect(expectOk(await admin.from("source_sync_jobs").select("status").eq("id", r2.jobs[0]!.id).single()).status).toBe("completed");
    expect(expectOk(await d.client.from("source_context_records").select("id"))).toHaveLength(5);
  });

  it("cancels before it starts, and a crashed run resumes without duplicating anything", async () => {
    const r = await requestSync(deps(), c.creatorId);
    await cancelSync(admin, c.creatorId, r.jobs[0]!.id);
    expect(expectOk(await admin.from("source_sync_jobs").select("status").eq("id", r.jobs[0]!.id).single()).status).toBe("cancelled");
    // A job left "running" with an old heartbeat is picked up again from its committed checkpoint.
    const r2 = await requestSync(deps(), c.creatorId);
    await admin.from("source_sync_jobs").update({ status: "running", heartbeat_at: new Date(Date.now() - 10 * 60_000).toISOString() }).eq("id", r2.jobs[0]!.id);
    await runSyncJobs(deps(), { creatorId: c.creatorId });
    expect(expectOk(await admin.from("source_sync_jobs").select("status").eq("id", r2.jobs[0]!.id).single()).status).toBe("completed");
    expect(expectOk(await c.client.from("source_context_records").select("id"))).toHaveLength(5);
  });

  it("one source's failure stays with that source: rate limits pause, revoked access asks to reconnect", async () => {
    const e = await createTestCreator("srcFail");
    await note(e, "A note", "Something worth keeping.", undefined, 1);
    await connectNotes(e);
    const gmail = expectOk(await admin.from("source_connections").insert({ creator_id: e.creatorId, provider: "gmail", status: "connected" }).select("id").single()).id;
    const limited: Connector = { provider: "gmail", scope: () => ({}), fetchPage: async () => Promise.reject(new ConnectorError("rate_limited", "slow down", 90_000)) };
    const d = deps({ connectors: { native_notes: nativeNotes, gmail: limited } });
    const r = await requestSync(d, e.creatorId);
    expect(r.parent).not.toBeNull();
    await runSyncJobs(d, { creatorId: e.creatorId });
    const jobs = expectOk(await admin.from("source_sync_jobs").select("connection_id, status, phase, run_after").eq("creator_id", e.creatorId).not("connection_id", "is", null));
    const g = jobs.find((j) => j.connection_id === gmail)!;
    expect(g).toMatchObject({ status: "paused", phase: "rate_limited" });
    expect(Date.parse(g.run_after)).toBeGreaterThan(Date.now() + 60_000);
    expect(jobs.find((j) => j.connection_id !== gmail)!.status).toBe("completed");

    const revoked: Connector = { provider: "gmail", scope: () => ({}), fetchPage: async () => Promise.reject(new ConnectorError("revoked", "token revoked")) };
    await admin.from("source_sync_jobs").update({ run_after: new Date().toISOString() }).eq("connection_id", gmail);
    await runSyncJobs(deps({ connectors: { native_notes: nativeNotes, gmail: revoked } }), { creatorId: e.creatorId });
    expect(expectOk(await e.client.from("source_connections").select("status").eq("id", gmail).single()).status).toBe("needs_reconnect");
    expect(expectOk(await e.client.from("source_connections").select("status").eq("provider", "native_notes").single()).status).toBe("connected");
    await expect(requestSync(d, e.creatorId, { connectionId: gmail })).rejects.toMatchObject({ code: "conflict" });
  });

  it("imports only what the creator selected from that candidate, with provenance; disconnect removes the rest", async () => {
    const cand = expectOk(await c.client.from("context_candidates").select("id, record_ids").like("title", "% in Pune").single());
    const other = expectOk(await c.client.from("source_context_records").select("id").not("id", "in", `(${cand.record_ids.join(",")})`).limit(1).single());
    await expect(importCandidate(deps(), c.client, c.creatorId, cand.id, [other.id])).rejects.toMatchObject({ code: "validation" });
    const res = await importCandidate(deps(), c.client, c.creatorId, cand.id, [cand.record_ids[0]!]);
    expect(res.materialIds).toHaveLength(1);
    expect(expectOk(await c.client.from("context_candidates").select("state").eq("id", cand.id).single()).state).toBe("imported");
    // b can't import a's candidate.
    await expect(importCandidate(deps(), b.client, b.creatorId, cand.id, [cand.record_ids[0]!])).rejects.toMatchObject({ code: "not_found" });

    expectOk(await c.client.from("source_connections").delete().eq("id", conn));
    expect(expectOk(await c.client.from("source_context_records").select("id"))).toEqual([]);
    expect(expectOk(await c.client.from("source_sync_cursors").select("connection_id"))).toEqual([]);
    expect(expectOk(await c.client.from("source_sync_jobs").select("id"))).toEqual([]);
    // The Materials the creator had stay.
    expect(expectOk(await c.client.from("creative_materials").select("id").in("id", res.materialIds))).toHaveLength(1);
  });

  it("retention purges expired discoveries and old runs", async () => {
    const f = await createTestCreator("srcRetain");
    const cn = await connectNotes(f);
    expectOk(await admin.from("source_context_records").insert({ creator_id: f.creatorId, connection_id: cn, provider_item_id: "old", source_type: "note", expires_at: new Date(Date.now() - DAY).toISOString() }));
    expectOk(await admin.from("context_candidates").insert({ creator_id: f.creatorId, signature: "old", title: "Old", expires_at: new Date(Date.now() - DAY).toISOString() }));
    const res = expectOk(await admin.rpc("run_retention")) as Record<string, number>;
    expect(res.source_context_records).toBeGreaterThanOrEqual(1);
    expect(res.context_candidates).toBeGreaterThanOrEqual(1);
    expect(expectOk(await f.client.from("source_context_records").select("id"))).toEqual([]);
  });
});

describe("Personal Sources — photos chosen on the device", () => {
  // A real 1×1 JPEG (content-detected), as a browser would send for a thumbnail.
  const JPEG = Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    "base64",
  );
  const thumb = `data:image/jpeg;base64,${JPEG.toString("base64")}`;
  const sha = (n: number) => createHash("sha256").update(`photo-${n}`).digest("hex");

  it("keeps only metadata and a real, tiny thumbnail; a burst of photos from one day becomes a group", async () => {
    const p = await createTestCreator("srcPhotos");
    const conn = expectOk(await p.client.from("source_connections").insert({ creator_id: p.creatorId, provider: "phone_photos" }).select("id").single()).id;
    const day = new Date(Date.now() - 3 * DAY).toISOString();
    const photos = [1, 2, 3, 4, 5].map((n) => ({ sha256: sha(n), takenAt: day, width: 4000, height: 3000, thumb }));
    const bad = [
      { sha256: sha(6), takenAt: day, thumb: "data:image/jpeg;base64,PHN2Zz48L3N2Zz4=" }, // not a JPEG at all
      { sha256: "nope", takenAt: day, thumb },
      { sha256: sha(7), takenAt: day, thumb: `data:image/jpeg;base64,${Buffer.alloc(20_000, 1).toString("base64")}` },
    ];
    const r = await indexPhotos(admin, p.creatorId, conn, [...photos, ...bad]);
    expect(r).toMatchObject({ indexed: 5, skipped: 3 });
    const rows = expectOk(await p.client.from("source_context_records").select("source_type, preview_ref, fingerprint, hydration_level"));
    expect(rows).toHaveLength(5);
    expect(rows.every((x) => x.source_type === "photo" && x.preview_ref!.startsWith("data:image/jpeg;base64,") && x.hydration_level === 2)).toBe(true);
    // Re-sending the same photos never duplicates them.
    await indexPhotos(admin, p.creatorId, conn, photos);
    expect(expectOk(await p.client.from("source_context_records").select("id"))).toHaveLength(5);
    const cand = expectOk(await p.client.from("context_candidates").select("id, title, explanation, record_ids").single());
    expect(cand.explanation).toBe("A day you kept in photos.");
    // Another creator's connection can't be fed.
    await expect(indexPhotos(admin, b.creatorId, conn, photos)).rejects.toMatchObject({ code: "not_found" });
    // A thumbnail can't smuggle anything bigger or other than an image into the index.
    expectDenied(await admin.from("source_context_records").update({ preview_ref: "javascript:alert(1)" }).eq("connection_id", conn));

    // Import needs the very same original (matching SHA-256), uploaded by this creator.
    const rec = expectOk(await p.client.from("source_context_records").select("id, fingerprint").eq("fingerprint", sha(1)).single());
    await expect(importCandidate(deps(), p.client, p.creatorId, cand.id, [rec.id])).rejects.toMatchObject({ code: "validation" });
    const other = await registerStorageObject(p);
    const prov = await createProvenance(p, "upload");
    const wrong = expectOk(await p.client.from("creative_materials").insert({ creator_id: p.creatorId, type: "image", provenance_id: prov, storage_object_id: other }).select("id").single()).id;
    await expect(importCandidate(deps(), p.client, p.creatorId, cand.id, [rec.id], { [rec.id]: wrong })).rejects.toMatchObject({ code: "validation" });
    await admin.from("storage_objects").update({ sha256: sha(1) }).eq("id", other);
    const res = await importCandidate(deps(), p.client, p.creatorId, cand.id, [rec.id], { [rec.id]: wrong });
    expect(res.materialIds).toEqual([wrong]);
    expect(expectOk(await p.client.from("source_context_records").select("material_id, hydration_level").eq("id", rec.id).single())).toEqual({ material_id: wrong, hydration_level: 4 });
  });
});
