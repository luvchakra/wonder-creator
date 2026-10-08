import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanupTestCreators, createTestCreator, expectDenied, expectOk, loose } from "./helpers";

// "Send us a message" on /contact: written by the server with the service role only; kept for 12 months.
const admin = adminClient();
afterAll(cleanupTestCreators);
const row = (over: Record<string, unknown> = {}) => ({ client_id: randomUUID(), name: "Asha Rao", email: "asha@example.com", message: "The Contact page works, thank you for it.", ...over });

describe("contact messages", () => {
  it("the server stores one with its defaults, and a retry with the same id is refused", async () => {
    const r = row();
    const saved = expectOk(await admin.from("contact_messages").insert(r).select("topic, notified_at, handled_at").single());
    expect(saved).toEqual({ topic: "general", notified_at: null, handled_at: null });
    expectDenied(await admin.from("contact_messages").insert(r), "23505");
  });

  it("refuses what the form would never send: a short name or message, a bad address, an unknown topic, a huge page", async () => {
    for (const bad of [{ name: "A" }, { message: "too short" }, { email: "not-an-address" }, { email: "a b@example.com" }, { topic: "gossip" }, { page: "x".repeat(301) }]) {
      expectDenied(await admin.from("contact_messages").insert(row(bad)), "23514");
    }
  });

  it("nobody reaches it from the browser — signed in or not", async () => {
    const r = row();
    expectOk(await admin.from("contact_messages").insert(r));
    const anon = anonClient();
    expectDenied(await loose(anon).from("contact_messages").insert(row()));
    expectDenied(await loose(anon).from("contact_messages").select("id"));
    // Same for a signed-in role: no grants, no policies.
    const creator = await createTestCreator("contactmsg");
    expectDenied(await loose(creator.client).from("contact_messages").select("id"));
    expectDenied(await loose(creator.client).from("contact_messages").insert(row()));
    expectDenied(await loose(creator.client).from("contact_messages").update({ handled_at: new Date().toISOString() }).eq("client_id", r.client_id));
  });

  it("retention removes messages older than 12 months and keeps recent ones", async () => {
    const old = row({ created_at: new Date(Date.now() - 400 * 86_400_000).toISOString() });
    const recent = row({ created_at: new Date(Date.now() - 20 * 86_400_000).toISOString() });
    expectOk(await admin.from("contact_messages").insert([old, recent]));
    const out = expectOk(await admin.rpc("run_retention")) as Record<string, number>;
    expect(out.contact_messages).toBeGreaterThanOrEqual(1);
    expect(expectOk(await admin.from("contact_messages").select("client_id").eq("client_id", old.client_id))).toHaveLength(0);
    expect(expectOk(await admin.from("contact_messages").select("client_id").eq("client_id", recent.client_id))).toHaveLength(1);
  });
});
