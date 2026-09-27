import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assembleContext, draftPublicationCopy, selectProvider } from "@wonder/creator-brain";
import { setAutonomy } from "@wonder/creator-identity";
import {
  addWebhookDestination,
  approvePublication,
  attemptPublication,
  cancelPublication,
  createArtifact,
  duePublications,
  listPublications,
  preparePublications,
  signWebhook,
  updatePublication,
} from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectDenied, expectOk, loose, type TestCreator } from "./helpers";

let a: TestCreator;
let b: TestCreator;
let piece: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;
const service = adminClient() as unknown as AppDb;
const provider = selectProvider({ WONDERCREATOR_AI_PROVIDER: "offline" });

type Call = { url: string; headers: Record<string, string>; body: string; statusSeen?: string };
let calls: Call[] = [];
let answer: () => Response = () => Response.json({ id: "post-1", url: "https://example.com/p/1" });
const fetchImpl = (async (url: URL, init: RequestInit) => {
  const call: Call = { url: String(url), headers: init.headers as Record<string, string>, body: String(init.body) };
  // What the creator would see while the destination hasn't answered yet.
  const { data } = await a.client.from("publications").select("status").eq("idempotency_key", call.headers["idempotency-key"]).single();
  call.statusSeen = data?.status;
  calls.push(call);
  return answer();
}) as unknown as typeof fetch;
const deps = () => ({ service, creatorId: a.creatorId, appOrigin: "https://app.example", fetchOptions: { resolve: async () => ["93.184.216.34"], fetchImpl } });

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("pubOwner"), createTestCreator("pubOther")]);
  piece = (await createArtifact(db(a), a.creatorId, { artifactType: "poem", title: "Lanterns", content: "First light over the harbour.", authorKind: "creator", provenance: { origin: "typed" } })).id;
});
afterAll(cleanupTestCreators);

describe("preparing and approving", () => {
  it("drafts can be edited, but outcomes can't be set by the creator", async () => {
    const [p] = await preparePublications(db(a), a.creatorId, piece, { destinations: [{ kind: "profile" }], title: "Lanterns" });
    expect(p).toMatchObject({ status: "draft", destination_kind: "profile" });
    await updatePublication(db(a), p.id, { caption: "New poem." });
    expectDenied(await loose(a.client).from("publications").update({ status: "published", external_url: "https://fake" }).eq("id", p.id), "42501");
    expectDenied(await loose(a.client).from("publications").insert({ artifact_id: piece, creator_id: a.creatorId, destination_kind: "profile", destination_name: "x", title: "x", status: "published" }));
    await expect(approvePublication(db(b), p.id)).rejects.toThrow(/couldn't find/);
    expect(await listPublications(db(b), piece)).toEqual([]);
    await cancelPublication(db(a), p.id);
  });

  it("approval fixes the version and copy; profile publishing is confirmed by the database", async () => {
    const [p] = await preparePublications(db(a), a.creatorId, piece, { destinations: [{ kind: "profile" }], title: "Lanterns", caption: "Out now." });
    const approved = await approvePublication(db(a), p.id);
    expect(approved.status).toBe("approved");
    expect(approved.version_id).toBeTruthy();
    await expect(updatePublication(db(a), p.id, { title: "Changed" })).rejects.toThrow(/already approved/);
    const done = await attemptPublication(deps(), p.id);
    expect(done).toMatchObject({ status: "published", external_id: piece });
    const art = expectOk(await a.client.from("artifacts").select("status, privacy").eq("id", piece).single());
    expect(art).toEqual({ status: "published", privacy: "public" });
  });
});

describe("webhooks", () => {
  it("send signed JSON with an idempotency key, and record the destination's answer", async () => {
    const dest = await addWebhookDestination(db(a), a.creatorId, { name: "My site", url: "https://hooks.example.com/wonder" });
    await expect(addWebhookDestination(db(a), a.creatorId, { name: "Local", url: "http://localhost/x" })).rejects.toThrow(/https/);
    const [p] = await preparePublications(db(a), a.creatorId, piece, { destinations: [{ kind: "webhook", id: dest.id }], title: "Lanterns", caption: "Hello" });
    await approvePublication(db(a), p.id);
    calls = [];
    const done = await attemptPublication(deps(), p.id);
    expect(done).toMatchObject({ status: "published", external_id: "post-1", external_url: "https://example.com/p/1" });
    const [call] = calls;
    expect(call.statusSeen).toBe("publishing"); // never "published" before the answer
    expect(call.headers["idempotency-key"]).toBe(p.idempotency_key);
    const ts = Number(call.headers["x-wonder-timestamp"]);
    expect(call.headers["x-wonder-signature"]).toBe(`v1=${await signWebhook(dest.signing_secret, ts, call.body)}`);
    expect(JSON.parse(call.body)).toMatchObject({ title: "Lanterns", caption: "Hello", content: "First light over the harbour." });
  });

  it("failures are per destination and retry with the same key", async () => {
    const dest = await addWebhookDestination(db(a), a.creatorId, { name: "Flaky", url: "https://flaky.example.com/hook" });
    const [p, profile] = await preparePublications(db(a), a.creatorId, piece, { destinations: [{ kind: "webhook", id: dest.id }, { kind: "profile" }], title: "Lanterns" });
    await approvePublication(db(a), p.id);
    await approvePublication(db(a), profile.id);
    calls = [];
    answer = () => new Response("down", { status: 503 });
    const failed = await attemptPublication(deps(), p.id);
    expect(failed).toMatchObject({ status: "failed", failure_reason: "The destination answered 503." });
    expect((await attemptPublication(deps(), profile.id)).status).toBe("published");
    answer = () => new Response(null, { status: 204 });
    const retried = await attemptPublication(deps(), p.id);
    expect(retried).toMatchObject({ status: "published", attempts: 2, external_url: null });
    expect(calls.map((c) => c.headers["idempotency-key"])).toEqual([p.idempotency_key, p.idempotency_key]);
    const [row] = (await listPublications(db(a), piece)).filter((x) => x.id === p.id);
    expect(row.publication_attempts.map((x) => x.outcome)).toEqual(["succeeded", "failed"]);
    // Published is final.
    expect((await attemptPublication(deps(), p.id)).attempts).toBe(2);
  });

  it("scheduled publications wait for their time", async () => {
    const later = new Date(Date.now() + 3600_000).toISOString();
    const [p] = await preparePublications(db(a), a.creatorId, piece, { destinations: [{ kind: "profile" }], title: "Later", scheduledFor: later });
    expect((await approvePublication(db(a), p.id)).status).toBe("scheduled");
    await expect(attemptPublication(deps(), p.id)).rejects.toThrow(/scheduled for later/);
    expect((await duePublications(service)).map((d) => d.id)).not.toContain(p.id);
    await cancelPublication(db(a), p.id);
  });

  it("unapproved drafts are never attempted", async () => {
    const [p] = await preparePublications(db(a), a.creatorId, piece, { destinations: [{ kind: "profile" }], title: "Draft" });
    await expect(attemptPublication(deps(), p.id)).rejects.toThrow(/isn't approved/);
  });
});

describe("context, CreativeMind and audit", () => {
  it("publication outcomes enter the Creative Context", async () => {
    const ctx = await assembleContext(db(a), a.creatorId, { intent: "question", instruction: "x", artifactIds: [piece] });
    expect(ctx.selectedArtifacts[0].publications.join(" ")).toMatch(/Your Wonder Creator profile/);
  });

  it("CreativeMind drafts copy only as far as Publishing autonomy allows", async () => {
    const copy = await draftPublicationCopy({ db: db(a), creatorId: a.creatorId, provider }, piece);
    expect(copy.title).toBeTruthy();
    await setAutonomy(db(a), a.creatorId, "publishing", "observe");
    await expect(draftPublicationCopy({ db: db(a), creatorId: a.creatorId, provider }, piece)).rejects.toThrow(/Creator Autonomy/);
    await setAutonomy(db(a), a.creatorId, "publishing", "execute_with_approval");
  });

  it("approvals and outcomes are audited", async () => {
    const actions = expectOk(await a.client.from("audit_logs").select("action").eq("object_type", "publication")).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["publication.approved", "publication.published", "publication.failed", "publication.cancelled"]));
  });
});
