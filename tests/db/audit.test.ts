import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { audit } from "@wonder/core";
import { setAutonomy } from "@wonder/creator-identity";
import { addLicense, createArtifact, createShareLink, revokeShare } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { auditCsv, listAudit } from "../../apps/web/src/lib/audit";
import { cleanupTestCreators, createTestCreator, type TestCreator } from "./helpers";

let a: TestCreator;
let b: TestCreator;
let piece: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("auditA"), createTestCreator("auditB")]);
  piece = (await createArtifact(db(a), a.creatorId, { artifactType: "poem", title: "Private diary poem", content: "Secret words nobody should see.", authorKind: "creator", provenance: { origin: "typed" } })).id;
  await audit(db(a), { action: "auth.signed_in", objectType: "creator", objectId: a.creatorId, metadata: { device: "Firefox on Linux", network: "203.0.113.x" } });
  await audit(db(a), { action: "auth.step_up_failed", objectType: "creator", objectId: null, metadata: { for: "delete your account" } });
  const { share } = await createShareLink(db(a), a.creatorId, piece, { allowDownload: true });
  await revokeShare(db(a), share.id);
  await setAutonomy(db(a), a.creatorId, "research", "draft");
  await addLicense(db(a), a.creatorId, piece, { licenseType: "editorial" });
});
afterAll(cleanupTestCreators);

describe("security & activity history", () => {
  it("describes events in plain words, with actor, outcome and related piece", async () => {
    const { entries } = await listAudit(db(a), {});
    const titles = entries.map((e) => e.title);
    expect(titles).toEqual(expect.arrayContaining(["Signed in", "A password confirmation didn't match", "Made a private link", "Turned off a private link", "Changed Creator Autonomy"]));
    const signIn = entries.find((e) => e.title === "Signed in")!;
    expect(signIn).toMatchObject({ category: "security", outcome: "done", actor: "You" });
    expect(signIn.details).toContainEqual({ label: "Device", value: "Firefox on Linux" });
    expect(entries.find((e) => e.title === "A password confirmation didn't match")?.outcome).toBe("failed");
    const shared = entries.find((e) => e.title === "Made a private link")!;
    expect(shared.entity).toEqual({ label: "Creation: Private diary poem", href: `/creations/${piece}` });
    // Licensing comes from the semantic rights history; raw table audits are hidden.
    expect(entries.some((e) => e.category === "rights" && /Editorial Use recorded/.test(e.title))).toBe(true);
    expect(entries.some((e) => e.title === "Account activity")).toBe(false);
    // Never creative content.
    expect(JSON.stringify(entries)).not.toMatch(/Secret words/);
  });

  it("filters by category and date range, and pages", async () => {
    const security = await listAudit(db(a), { category: "security" });
    expect(security.entries.length).toBeGreaterThan(0);
    expect(security.entries.every((e) => e.category === "security")).toBe(true);
    const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
    expect((await listAudit(db(a), { from: tomorrow })).entries).toEqual([]);
    const first = await listAudit(db(a), { limit: 2 });
    expect(first.entries).toHaveLength(2);
    expect(first.nextBefore).toBeTruthy();
    const next = await listAudit(db(a), { limit: 2, before: first.nextBefore! });
    expect(next.entries[0].at <= first.entries[1].at).toBe(true);
    await expect(listAudit(db(a), { category: "nonsense" })).rejects.toThrow();
  });

  it("is private to its creator", async () => {
    const { entries } = await listAudit(db(b), {});
    expect(entries.some((e) => e.entity?.href?.includes(piece))).toBe(false);
    expect(entries.some((e) => e.title === "Made a private link")).toBe(false);
  });

  it("exports CSV safely", async () => {
    const csv = auditCsv([{ id: "x", at: "2026-09-26T10:00:00Z", category: "sharing", title: "=HYPERLINK(evil)", outcome: "done", actor: "You", entity: { label: 'Piece: "Quotes", commas', href: null }, details: [] }]);
    expect(csv.split("\n")[1]).toBe(`2026-09-26T10:00:00Z,Sharing & access,'=HYPERLINK(evil),done,You,"Piece: ""Quotes"", commas",`);
  });
});
