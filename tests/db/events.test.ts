import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  cleanupTestCreators,
  createTestCreator,
  expectDenied,
  expectNoRowsAffected,
  expectOk,
  loose,
  type TestCreator,
} from "./helpers";

const admin = adminClient();
let a: TestCreator;
let b: TestCreator;
let eventId: string;
const aggregateId = randomUUID();
const auditAction = `test.action.${randomUUID()}`;

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("eventsA"), createTestCreator("eventsB")]);
});
afterAll(cleanupTestCreators);

describe("domain events", () => {
  it("record_domain_event stamps the caller's creator and tenant", async () => {
    eventId = expectOk(
      await a.client.rpc("record_domain_event", {
        p_event_type: "TestHappened",
        p_aggregate_type: "test",
        p_aggregate_id: aggregateId,
        p_payload: { hello: "world" },
        p_correlation_id: "corr-1",
      }),
    );
    expect(eventId).toMatch(/^[0-9a-f-]{36}$/);
    const row = expectOk(await a.client.from("domain_events").select("*").eq("id", eventId).single());
    expect(row).toMatchObject({
      event_type: "TestHappened",
      aggregate_type: "test",
      aggregate_id: aggregateId,
      creator_id: a.creatorId,
      tenant_id: a.tenantId,
      payload: { hello: "world" },
      correlation_id: "corr-1",
    });
  });

  it("rejects malformed event types", async () => {
    expectDenied(
      await a.client.rpc("record_domain_event", { p_event_type: "not-pascal", p_aggregate_type: "t", p_aggregate_id: aggregateId }),
      "23514",
    );
  });

  it("a creator reads only their own events", async () => {
    expect(expectOk(await b.client.from("domain_events").select("id").eq("id", eventId))).toHaveLength(0);
    const own = expectOk(await a.client.from("domain_events").select("creator_id"));
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((e) => e.creator_id === a.creatorId)).toBe(true);
  });

  it("clients cannot insert events directly (no forging another creator's event)", async () => {
    expectDenied(
      await b.client
        .from("domain_events")
        .insert({ event_type: "Forged", aggregate_type: "test", creator_id: a.creatorId, tenant_id: a.tenantId }),
      "42501",
    );
  });

  it("events cannot be updated or deleted by their creator", async () => {
    expectNoRowsAffected(await a.client.from("domain_events").update({ payload: { tampered: true } }).eq("id", eventId).select());
    expectNoRowsAffected(await a.client.from("domain_events").delete().eq("id", eventId).select());
    const row = expectOk(await admin.from("domain_events").select("payload").eq("id", eventId).single());
    expect(row.payload).toEqual({ hello: "world" });
  });

  it("events are immutable even with the secret key", async () => {
    expectDenied(await admin.from("domain_events").update({ payload: {} }).eq("id", eventId), "42501");
    expectDenied(await admin.from("domain_events").delete().eq("id", eventId), "42501");
  });

  it("anon cannot record events", async () => {
    expectDenied(
      await anonClient().rpc("record_domain_event", { p_event_type: "AnonEvent", p_aggregate_type: "t", p_aggregate_id: aggregateId }),
    );
  });
});

describe("audit logs", () => {
  it("record_audit_log stamps the caller's user, creator and tenant", async () => {
    expectOk(
      await a.client.rpc("record_audit_log", {
        p_action: auditAction,
        p_object_type: "test",
        p_object_id: aggregateId,
        p_metadata: { k: 1 },
        p_request_id: "req-1",
      }),
    );
    const rows = expectOk(await a.client.from("audit_logs").select("*").eq("action", auditAction));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actor_user_id: a.userId,
      actor_creator_id: a.creatorId,
      tenant_id: a.tenantId,
      object_id: aggregateId,
      metadata: { k: 1 },
      request_id: "req-1",
    });
  });

  it("another creator cannot read the audit entry", async () => {
    expect(expectOk(await b.client.from("audit_logs").select("id").eq("action", auditAction))).toHaveLength(0);
  });

  it("clients cannot insert audit rows directly", async () => {
    expectDenied(
      await b.client.from("audit_logs").insert({ action: "forged", object_type: "x", actor_creator_id: a.creatorId }),
      "42501",
    );
  });

  it("audit rows are immutable", async () => {
    expectNoRowsAffected(await a.client.from("audit_logs").update({ action: "rewritten" }).eq("action", auditAction).select());
    expectNoRowsAffected(await a.client.from("audit_logs").delete().eq("action", auditAction).select());
    expectDenied(await admin.from("audit_logs").update({ action: "rewritten" }).eq("action", auditAction), "42501");
    expectDenied(await admin.from("audit_logs").delete().eq("action", auditAction), "42501");
    expect(expectOk(await admin.from("audit_logs").select("id").eq("action", auditAction))).toHaveLength(1);
  });

  it("anon cannot write audit rows", async () => {
    expectDenied(
      await anonClient().rpc("record_audit_log", { p_action: "anon", p_object_type: "x", p_object_id: aggregateId }),
    );
  });
});

describe("reserved event types", () => {
  const reserved = ["HuddleStarted", "HuddleDissolved", "HuddleJoinApproved", "ArtifactVersionCreated", "RightsUpdated"];

  it.each(reserved)("clients cannot record %s", async (eventType) => {
    expectDenied(
      await a.client.rpc("record_domain_event", { p_event_type: eventType, p_aggregate_type: "x", p_aggregate_id: aggregateId }),
      "42501",
    );
    const rows = expectOk(
      await admin.from("domain_events").select("id").eq("event_type", eventType).eq("aggregate_id", aggregateId),
    );
    expect(rows).toHaveLength(0);
  });

  it("HuddleContentPreserved remains recordable by clients", async () => {
    const id = expectOk(
      await a.client.rpc("record_domain_event", {
        p_event_type: "HuddleContentPreserved",
        p_aggregate_type: "huddle",
        p_aggregate_id: aggregateId,
      }),
    );
    const row = expectOk(await a.client.from("domain_events").select("creator_id").eq("id", id).single());
    expect(row.creator_id).toBe(a.creatorId);
  });
});

describe("internal app.* functions", () => {
  const internal = ["dissolve_huddle", "record_event", "record_audit", "current_creator_id", "record_version_event"];

  it.each(internal)("app.%s is not callable through the API", async (fn) => {
    const res = await loose(a.client).schema("app").rpc(fn, {});
    expect(res.error).not.toBeNull();
  });

  it.each(internal)("app.%s is not reachable as a public RPC either", async (fn) => {
    const res = await loose(a.client).rpc(fn, {});
    expect(res.error).not.toBeNull();
  });
});
