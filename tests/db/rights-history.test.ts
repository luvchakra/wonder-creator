import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { selectProvider, transform } from "@wonder/creator-brain";
import { addLicense, createArtifact, getRights, saveRights, setLicenseStatus } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectDenied, expectOk, loose, type TestCreator } from "./helpers";

const admin = adminClient();
const provider = selectProvider({ WONDERCREATOR_AI_PROVIDER: "offline" });
let a: TestCreator;
let b: TestCreator;
let artifactId: string;
let rightsId: string;
const events = async () => expectOk(await a.client.from("rights_events").select("event, details").eq("rights_id", rightsId).order("created_at")).map((e) => e.event);

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("rightsHistA"), createTestCreator("rightsHistB")]);
  // Created through the app path so it gets a version and a rights record.
  const art = await createArtifact(a.client as unknown as AppDb, a.creatorId, { artifactType: "poem", title: "Harbour", content: "The lamps.", authorKind: "creator", provenance: { origin: "typed" } });
  artifactId = art.id;
  rightsId = expectOk(await a.client.from("rights_records").select("id").eq("artifact_id", artifactId).single()).id;
});
afterAll(cleanupTestCreators);

describe("rights history", () => {
  it("records semantic, append-only events for every rights change", async () => {
    await saveRights(a.client as unknown as AppDb, a.creatorId, artifactId, {
      ownershipKind: "joint",
      copyrightHolder: "A and Co-writer",
      attributionRequired: false,
      derivativesAllowed: true,
      owners: [
        { name: "A", sharePercent: 60, creatorId: a.creatorId },
        { name: "Co-writer", sharePercent: 40 },
      ],
    });
    const lic = await addLicense(a.client as unknown as AppDb, a.creatorId, artifactId, { licenseType: "editorial", licenseeName: "Harbour Times", territory: "Worldwide" });
    await setLicenseStatus(a.client as unknown as AppDb, lic.id, "active");
    expectOk(await a.client.from("artifacts").update({ status: "final", privacy: "public" }).eq("id", artifactId).select("id"));

    const e = await events();
    expect(e[0]).toBe("rights.created");
    expect(e).toEqual(expect.arrayContaining(["ownership.updated", "copyright.updated", "attribution.changed", "derivatives.changed", "owner.added", "owner.removed", "license.created", "license.activated", "publication.changed"]));
    const own = expectOk(await a.client.from("rights_events").select("details").eq("rights_id", rightsId).eq("event", "ownership.updated").single());
    expect(own.details).toEqual({ from: "sole", to: "joint" });

    // The feed reads as sentences, newest first.
    const r = await getRights(a.client as unknown as AppDb, artifactId);
    expect(r!.events[0].title).toMatch(/^Sharing changed: /);
    expect(r!.events.some((x) => x.title === "Editorial Use for Harbour Times activated")).toBe(true);
  });

  it("a derivative made from the piece is recorded in the source's history, by anyone allowed to make one", async () => {
    await transform({ db: b.client as unknown as AppDb, creatorId: b.creatorId, provider }, { artifactId, targetType: "lyrics", instruction: "Make it singable." });
    const d = expectOk(await a.client.from("rights_events").select("details").eq("rights_id", rightsId).eq("event", "derivative.created").single());
    expect(d.details).toMatchObject({ by_self: false });
  });

  it("history can't be rewritten, forged or read by others", async () => {
    const any = expectOk(await a.client.from("rights_events").select("id").eq("rights_id", rightsId).limit(1).single());
    const upd = await loose(a.client).from("rights_events").update({ event: "rights.created" }).eq("id", any.id).select("id");
    expect(upd.error ?? (upd.data?.length === 0 ? "none" : null)).toBeTruthy();
    const del = await loose(a.client).from("rights_events").delete().eq("id", any.id).select("id");
    expect(del.data ?? []).toEqual([]);
    expect(expectOk(await admin.from("rights_events").select("id").eq("id", any.id))).toHaveLength(1);
    expectDenied(await loose(a.client).from("rights_events").insert({ rights_id: rightsId, creator_id: a.creatorId, event: "license.activated", details: {} }));
    expect(expectOk(await b.client.from("rights_events").select("id").eq("rights_id", rightsId))).toEqual([]);
  });
});
