import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { selectProvider } from "@wonder/creator-brain";
import { handleTurn } from "@wonder/creator-talk";
import type { Db as AppDb } from "@wonder/db";
import { cleanupTestCreators, createTestCreator, expectOk, type TestCreator } from "./helpers";

// Intent clarification end to end through the turn engine, with the deterministic offline provider.
const provider = selectProvider({ WONDERCREATOR_AI_PROVIDER: "offline" });
let a: TestCreator;
let b: TestCreator;
const turn = (c: TestCreator, input: Record<string, unknown>) => handleTurn({ db: c.client as unknown as AppDb, creatorId: c.creatorId, provider }, input);
const last = (r: Awaited<ReturnType<typeof turn>>) => r.messages[r.messages.length - 1];

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("intentA"), createTestCreator("intentB")]);
});
afterAll(cleanupTestCreators);

describe("intent clarification", () => {
  it("a clear request proceeds without questions and records the inferred brief on the run", async () => {
    const r = await turn(a, { message: "Write a poem about rain on the harbour" });
    const reply = last(r);
    expect(reply.kind).toBe("artifact");
    expect((reply.payload as { assumptions?: string[] }).assumptions?.length).toBeGreaterThan(0);
    const run = expectOk(await a.client.from("ai_runs").select("intent_brief").eq("conversation_id", r.conversationId).eq("intent", "create").single());
    expect(run.intent_brief).toMatchObject({ format: "poem", source: "inferred" });
  });

  it("an ambiguous long-form request asks first; the confirmed brief drives the run and is audited", async () => {
    const q = await turn(a, { message: "Write a screenplay about the harbour" });
    const question = last(q);
    expect(question.kind).toBe("question");
    expect((question.payload as { intent: { missingInformation: string[] } }).intent.missingInformation).toEqual(["length"]);
    // Nothing was created yet.
    expect(expectOk(await a.client.from("ai_runs").select("id").eq("conversation_id", q.conversationId))).toEqual([]);

    const r = await turn(a, { clarified: { messageId: question.id, brief: { format: "screenplay", length: "short", style: "experiment", audience: "festival jury" } } });
    expect(r.conversationId).toBe(q.conversationId);
    expect(r.messages[0].payload).toMatchObject({ clarifies: question.id, brief: { length: "short" } });
    expect(last(r).kind).toBe("artifact");
    const run = expectOk(await a.client.from("ai_runs").select("intent_brief").eq("conversation_id", q.conversationId).eq("intent", "create").single());
    expect(run.intent_brief).toMatchObject({ format: "screenplay", length: "short", style: "experiment", audience: "festival jury", source: "confirmed" });

    // A question is answered once.
    await expect(turn(a, { clarified: { messageId: question.id, brief: { format: "screenplay" } } })).rejects.toThrow(/already answered/);
  });

  it("consequential assumptions must be acknowledged before anything is created", async () => {
    const q = await turn(a, { message: "Write a poem and publish it to Instagram" });
    const question = last(q);
    expect((question.payload as { intent: { consequentialAssumptions: Array<{ key: string }> } }).intent.consequentialAssumptions.map((c) => c.key)).toEqual(["publish"]);

    await expect(turn(a, { clarified: { messageId: question.id, brief: { format: "poem" }, acknowledged: [] } })).rejects.toThrow(/confirm/i);

    const ok = await turn(a, { clarified: { messageId: question.id, brief: { format: "poem" }, acknowledged: ["publish"] } });
    expect(last(ok).kind).toBe("artifact");
    const run = expectOk(await a.client.from("ai_runs").select("intent_brief").eq("conversation_id", q.conversationId).eq("intent", "create").single());
    expect(run.intent_brief).toMatchObject({ acknowledged: ["publish"] });
    // Creating never published anything.
    const art = expectOk(await a.client.from("artifacts").select("privacy, status").eq("id", (last(ok).payload as { artifactId: string }).artifactId).single());
    expect(art.privacy).toBe("creator_private");
  });

  it("another creator can't answer someone else's question", async () => {
    const q = await turn(a, { message: "Write a newsletter about the tour" });
    await expect(turn(b, { clarified: { messageId: last(q).id, brief: { format: "newsletter" } } })).rejects.toThrow(/no longer available/);
  });
});
