import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  cleanupTestCreators,
  createTestCreator,
  expectDenied,
  expectNoRowsAffected,
  expectOk,
  type TestCreator,
} from "./helpers";

const admin = adminClient();
let a: TestCreator;
let b: TestCreator;

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("tenancyA"), createTestCreator("tenancyB")]);
});
afterAll(cleanupTestCreators);

describe("tenancy and identity bootstrap", () => {
  it("gives a new user their own personal tenant", async () => {
    const tenants = expectOk(await a.client.from("tenants").select("id, kind"));
    expect(tenants).toEqual([{ id: a.tenantId, kind: "personal" }]);
    expect(a.tenantId).not.toBe(b.tenantId);
  });

  it("creates an owner membership in that tenant", async () => {
    const memberships = expectOk(await a.client.from("tenant_memberships").select("tenant_id, user_id, role"));
    expect(memberships).toEqual([{ tenant_id: a.tenantId, user_id: a.userId, role: "owner" }]);
  });

  it("creates exactly one creator bound to the user and tenant", async () => {
    const rows = expectOk(await admin.from("creators").select("id, user_id, tenant_id").eq("user_id", a.userId));
    expect(rows).toEqual([{ id: a.creatorId, user_id: a.userId, tenant_id: a.tenantId }]);
  });

  it("seeds the 10 default autonomy policies with rights/commerce/destructive = never", async () => {
    const policies = expectOk(await a.client.from("creator_autonomy_policies").select("creator_id, domain, level"));
    expect(policies).toHaveLength(10);
    expect(policies.every((p) => p.creator_id === a.creatorId)).toBe(true);
    const byDomain = Object.fromEntries(policies.map((p) => [p.domain, p.level]));
    expect(byDomain).toEqual({
      creative_generation: "auto_execute",
      research: "auto_execute",
      transformation: "draft",
      organization: "draft",
      collaboration: "execute_with_approval",
      communication: "execute_with_approval",
      publishing: "execute_with_approval",
      commerce: "never",
      rights: "never",
      destructive_actions: "never",
    });
  });

  it("seeds a private voice profile", async () => {
    const own = expectOk(await a.client.from("creator_voice_profiles").select("creator_id"));
    expect(own).toEqual([{ creator_id: a.creatorId }]);
  });

  it("does not expose another creator's tenant, membership, autonomy or voice profile", async () => {
    expect(expectOk(await a.client.from("tenants").select("id").eq("id", b.tenantId))).toHaveLength(0);
    expect(expectOk(await a.client.from("tenant_memberships").select("tenant_id").eq("user_id", b.userId))).toHaveLength(0);
    expect(
      expectOk(await a.client.from("creator_autonomy_policies").select("domain").eq("creator_id", b.creatorId)),
    ).toHaveLength(0);
    expect(
      expectOk(await a.client.from("creator_voice_profiles").select("creator_id").eq("creator_id", b.creatorId)),
    ).toHaveLength(0);
  });

  it("does not let a user add themselves to another tenant", async () => {
    expectDenied(
      await a.client.from("tenant_memberships").insert({ tenant_id: b.tenantId, user_id: a.userId, role: "owner" }),
    );
    expectDenied(await a.client.from("tenants").insert({ name: "Rogue", kind: "team" }));
  });
});

describe("creator bindings", () => {
  it("lets a creator edit their own profile fields", async () => {
    const rows = expectOk(
      await a.client.from("creators").update({ display_name: "Renamed" }).eq("id", a.creatorId).select("display_name"),
    );
    expect(rows).toEqual([{ display_name: "Renamed" }]);
  });

  it("rejects changing tenant_id", async () => {
    expectDenied(await a.client.from("creators").update({ tenant_id: b.tenantId }).eq("id", a.creatorId).select());
    const row = expectOk(await admin.from("creators").select("tenant_id").eq("id", a.creatorId).single());
    expect(row.tenant_id).toBe(a.tenantId);
  });

  it("rejects changing user_id", async () => {
    expectDenied(await a.client.from("creators").update({ user_id: b.userId }).eq("id", a.creatorId).select());
    const row = expectOk(await admin.from("creators").select("user_id").eq("id", a.creatorId).single());
    expect(row.user_id).toBe(a.userId);
  });

  it("rejects binding changes even through the secret key (trigger, not just RLS)", async () => {
    expectDenied(await admin.from("creators").update({ tenant_id: b.tenantId }).eq("id", a.creatorId), "42501");
  });

  it("does not let a creator update another creator", async () => {
    expectNoRowsAffected(
      await a.client.from("creators").update({ display_name: "Hijacked" }).eq("id", b.creatorId).select("id"),
    );
    const row = expectOk(await admin.from("creators").select("display_name").eq("id", b.creatorId).single());
    expect(row.display_name).not.toBe("Hijacked");
  });
});

describe("autonomy guard", () => {
  for (const domain of ["rights", "commerce", "destructive_actions"] as const) {
    it(`rejects auto_execute for ${domain}`, async () => {
      expectDenied(
        await a.client
          .from("creator_autonomy_policies")
          .update({ level: "auto_execute" })
          .eq("creator_id", a.creatorId)
          .eq("domain", domain)
          .select(),
        "22023",
      );
      const row = expectOk(
        await a.client
          .from("creator_autonomy_policies")
          .select("level")
          .eq("creator_id", a.creatorId)
          .eq("domain", domain)
          .single(),
      );
      expect(row.level).toBe("never");
    });
  }

  it("rejects auto_execute for rights even with the secret key", async () => {
    expectDenied(
      await admin
        .from("creator_autonomy_policies")
        .update({ level: "auto_execute" })
        .eq("creator_id", a.creatorId)
        .eq("domain", "rights"),
      "22023",
    );
  });

  it("allows raising rights to execute_with_approval and lowering other domains", async () => {
    expectOk(
      await a.client
        .from("creator_autonomy_policies")
        .update({ level: "execute_with_approval" })
        .eq("creator_id", a.creatorId)
        .eq("domain", "rights"),
    );
    const rows = expectOk(
      await a.client
        .from("creator_autonomy_policies")
        .update({ level: "suggest" })
        .eq("creator_id", a.creatorId)
        .eq("domain", "creative_generation")
        .select("level"),
    );
    expect(rows).toEqual([{ level: "suggest" }]);
  });

  it("does not let a creator change another creator's autonomy", async () => {
    expectNoRowsAffected(
      await a.client
        .from("creator_autonomy_policies")
        .update({ level: "never" })
        .eq("creator_id", b.creatorId)
        .eq("domain", "research")
        .select(),
    );
    const row = expectOk(
      await admin
        .from("creator_autonomy_policies")
        .select("level")
        .eq("creator_id", b.creatorId)
        .eq("domain", "research")
        .single(),
    );
    expect(row.level).toBe("auto_execute");
  });

  it("does not let a creator insert autonomy rows directly (for anyone)", async () => {
    expectDenied(
      await a.client
        .from("creator_autonomy_policies")
        .insert({ creator_id: b.creatorId, domain: "research", level: "never" }),
    );
  });
});
