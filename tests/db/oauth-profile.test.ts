import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { adminClient, expectOk } from "./helpers";

// Google sign-in (migration 072): a new account takes its name from Google's `full_name` / `name`.
const admin = adminClient();
const made: string[] = [];
afterAll(async () => {
  for (const id of made) await admin.auth.admin.deleteUser(id).catch(() => undefined);
});

async function creatorNameFor(metadata: Record<string, string>) {
  const { data, error } = await admin.auth.admin.createUser({ email: `oauth-${randomUUID()}@wonder.test`, email_confirm: true, user_metadata: metadata });
  if (error || !data.user) throw error;
  made.push(data.user.id);
  return expectOk(await admin.from("creators").select("display_name").eq("user_id", data.user.id).single()).display_name;
}

describe("new accounts from Google", () => {
  it("uses Google's full name, then name, and never prefers them over a chosen display name", async () => {
    expect(await creatorNameFor({ full_name: "Asha Rao", name: "Asha", avatar_url: "https://lh3.googleusercontent.com/x" })).toBe("Asha Rao");
    expect(await creatorNameFor({ name: "  Ravi Kumar " })).toBe("Ravi Kumar");
    expect(await creatorNameFor({ display_name: "Maya", full_name: "Maya Iyer" })).toBe("Maya");
    expect(await creatorNameFor({})).toMatch(/^oauth-/);
  });
});
