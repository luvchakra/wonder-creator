import { describe, expect, it } from "vitest";
import { isPlatformAdminEmail } from "./platform-admin";

describe("platform administrators", () => {
  it("are only the configured emails, case-insensitively", () => {
    const env = { WONDERCREATOR_PLATFORM_ADMIN_EMAILS: " Ops@Example.com , lead@example.com" };
    expect(isPlatformAdminEmail("ops@example.com", env)).toBe(true);
    expect(isPlatformAdminEmail("LEAD@example.com", env)).toBe(true);
    expect(isPlatformAdminEmail("someone@example.com", env)).toBe(false);
    expect(isPlatformAdminEmail(null, env)).toBe(false);
  });
  it("are nobody when none are configured", () => {
    expect(isPlatformAdminEmail("ops@example.com", {})).toBe(false);
    expect(isPlatformAdminEmail("", { WONDERCREATOR_PLATFORM_ADMIN_EMAILS: "" })).toBe(false);
  });
});

describe("requirePlatformAdmin", () => {
  const db = (email: string | null) => ({ auth: { getClaims: async () => ({ data: email ? { claims: { email } } : null }) } }) as never;
  it("lets an administrator through and answers anyone else as if nothing were there", async () => {
    process.env.WONDERCREATOR_PLATFORM_ADMIN_EMAILS = "ops@example.com";
    const { requirePlatformAdmin } = await import("./platform-admin");
    await expect(requirePlatformAdmin(db("ops@example.com"))).resolves.toBeUndefined();
    await expect(requirePlatformAdmin(db("creator@example.com"))).rejects.toMatchObject({ code: "not_found" });
    await expect(requirePlatformAdmin(db(null))).rejects.toMatchObject({ code: "not_found" });
    delete process.env.WONDERCREATOR_PLATFORM_ADMIN_EMAILS;
  });
});
