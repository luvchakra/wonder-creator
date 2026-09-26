import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getRunProgress, requestCancel, selectProvider, type CreativeModelProvider } from "@wonder/creator-brain";
import { handleTurn, retryRun } from "@wonder/creator-talk";
import type { Db as AppDb } from "@wonder/db";
import { cleanupTestCreators, createTestCreator, expectDenied, expectOk, loose, type TestCreator } from "./helpers";

const offline = selectProvider({ WONDERCREATOR_AI_PROVIDER: "offline" });
let a: TestCreator;
let b: TestCreator;
const db = (c: TestCreator) => c.client as unknown as AppDb;
const last = <T>(xs: T[]) => xs[xs.length - 1];

/** Offline provider that asks to cancel its own run the first time it's called (i.e. during "plan"). */
function cancellingProvider(c: TestCreator, runIdRef: { id: string | null }): CreativeModelProvider {
  let fired = false;
  const cancelFirst = async () => {
    if (!fired && runIdRef.id) {
      fired = true;
      await requestCancel(db(c), runIdRef.id);
    }
  };
  return new Proxy(offline, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver);
      if (prop === "structured" || prop === "generate") {
        return async (...args: unknown[]) => {
          await cancelFirst();
          return (v as (...a: unknown[]) => unknown).apply(target, args);
        };
      }
      return v;
    },
  });
}

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("runsA"), createTestCreator("runsB")]);
});
afterAll(cleanupTestCreators);

describe("creation run progress", () => {
  it("a finished run reports its stages, its piece, and can't be retried", async () => {
    const r = await handleTurn({ db: db(a), creatorId: a.creatorId, provider: offline }, { message: "Write a poem about lanterns" });
    const runId = (last(r.messages).payload as { runId: string }).runId;
    const p = await getRunProgress(db(a), runId);
    expect(p.run.status).toBe("succeeded");
    expect(p.artifact?.id).toBeTruthy();
    expect(p.stages.find((s) => s.step === "generate")?.state).toBe("done");
    expect(p.stages.find((s) => s.step === "render")?.state).toBe("done");
    expect(p.stages.some((s) => s.state === "pending" || s.state === "current")).toBe(false);
    expect(p.run.canRetry).toBe(false);
    expect(p.run.canCancel).toBe(false);
    await expect(retryRun({ db: db(a), creatorId: a.creatorId, provider: offline }, runId)).rejects.toThrow(/already finished/);
  });

  it("cancelling stops before the next stage and saves nothing; retry reruns it once, exactly as asked", async () => {
    const ref = { id: null as string | null };
    const provider = cancellingProvider(a, ref);
    const r = await handleTurn({ db: db(a), creatorId: a.creatorId, provider, onRunStarted: (id) => (ref.id = id) }, { message: "Write a poem about the ferry at night" });
    const reply = last(r.messages);
    expect(reply.kind).toBe("error");
    expect(reply.payload).toMatchObject({ code: "cancelled", runId: ref.id });

    const cancelled = await getRunProgress(db(a), ref.id!);
    expect(cancelled.run.status).toBe("cancelled");
    expect(cancelled.artifact).toBeNull();
    expect(cancelled.stages.find((s) => s.step === "render")?.state).toBe("pending");
    expect(cancelled.run.canRetry).toBe(true);
    const before = expectOk(await a.client.from("artifacts").select("id").eq("creator_id", a.creatorId));

    const retried = await retryRun({ db: db(a), creatorId: a.creatorId, provider: offline }, ref.id!);
    expect(retried.conversationId).toBe(r.conversationId);
    expect(last(retried.messages).kind).toBe("artifact");
    const after = expectOk(await a.client.from("artifacts").select("id").eq("creator_id", a.creatorId));
    expect(after.length).toBe(before.length + 1);

    const again = await getRunProgress(db(a), ref.id!);
    expect(again.run.retriedBy).toBe(retried.runId);
    expect(again.run.canRetry).toBe(false);
    await expect(retryRun({ db: db(a), creatorId: a.creatorId, provider: offline }, ref.id!)).rejects.toThrow(/already being retried/);
    // The database enforces it too.
    expectDenied(await a.client.from("ai_runs").insert({ creator_id: a.creatorId, intent: "create", provider: "x", model: "x", retry_of: ref.id }), "23505");
  });

  it("a run is private to its creator: nobody else can read, cancel or retry it", async () => {
    const r = await handleTurn({ db: db(a), creatorId: a.creatorId, provider: offline }, { message: "Write a poem about salt" });
    const runId = (last(r.messages).payload as { runId: string }).runId;
    await expect(getRunProgress(db(b), runId)).rejects.toThrow(/couldn't find/);
    await expect(requestCancel(db(b), runId)).rejects.toThrow(/couldn't find/);
    await expect(retryRun({ db: db(b), creatorId: b.creatorId, provider: offline }, runId)).rejects.toThrow(/couldn't find/);
    const tamper = await loose(b.client).from("ai_runs").update({ cancel_requested_at: new Date().toISOString() }).eq("id", runId).select("id");
    expect(tamper.data ?? []).toEqual([]);
  });
});
