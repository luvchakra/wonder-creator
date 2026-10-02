import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, cleanupTestCreators, createTestCreator, expectDenied, expectNoRowsAffected, expectOk, fakeSha, type TestCreator } from "./helpers";

/**
 * Photo album (docs/photo-album.md): the creator's own pictures, shown to anyone who can see their profile. Only the
 * creator adds, captions, orders or removes; files must be their own clean images; blocks and private profiles hold.
 */
const admin = adminClient();
const BUCKET = "creator-media";
let ana: TestCreator; // album owner, public profile
let ben: TestCreator; // can see Ana
let cara: TestCreator; // blocked by Ana
let dev: TestCreator; // private profile

const image = async (c: TestCreator, status: "clean" | "pending" = "clean", mime = "image/webp") =>
  expectOk(
    await admin
      .from("storage_objects")
      .insert({ creator_id: c.creatorId, bucket: BUCKET, path: `${c.creatorId}/album-${randomUUID()}`, mime_type: mime, size_bytes: 1000, sha256: fakeSha(), security_status: status })
      .select("id")
      .single(),
  ).id as string;
const photo = async (c: TestCreator, caption?: string) =>
  expectOk(await c.client.from("creator_album_photos").insert({ creator_id: c.creatorId, object_id: await image(c), thumb_object_id: await image(c), width: 1600, height: 1067, caption }).select("id").single()).id as string;

beforeAll(async () => {
  [ana, ben, cara, dev] = await Promise.all(["alAna", "alBen", "alCara", "alDev"].map((l) => createTestCreator(l)));
  await admin.from("creators").update({ visibility: "public" }).in("id", [ana.creatorId, ben.creatorId, cara.creatorId]);
  await admin.from("creators").update({ visibility: "private" }).eq("id", dev.creatorId);
  expectOk(await ana.client.from("creator_blocks").insert({ blocker_creator_id: ana.creatorId, blocked_creator_id: cara.creatorId }).select("blocker_creator_id"));
});
afterAll(cleanupTestCreators);

describe("Photo album", () => {
  it("the creator adds photos; anyone who can see the profile sees them, a blocked person never does", async () => {
    const id = await photo(ana, "Harbour at first light");
    expect(expectOk(await ben.client.from("creator_album_photos").select("id, caption").eq("creator_id", ana.creatorId))).toEqual([{ id, caption: "Harbour at first light" }]);
    expect(expectOk(await cara.client.from("creator_album_photos").select("id").eq("creator_id", ana.creatorId))).toEqual([]);
    // A private profile's album stays with its owner.
    const hidden = await photo(dev);
    expect(expectOk(await ben.client.from("creator_album_photos").select("id").eq("id", hidden))).toEqual([]);
    expect(expectOk(await dev.client.from("creator_album_photos").select("id").eq("id", hidden))).toHaveLength(1);
  });

  it("only your own clean images can go in; nobody else can add to, edit or empty your album", async () => {
    // Someone else's file, an unchecked file, and a non-image are refused.
    expectDenied(await ben.client.from("creator_album_photos").insert({ creator_id: ben.creatorId, object_id: await image(ana), thumb_object_id: await image(ben), width: 10, height: 10 }), "42501");
    expectDenied(await ben.client.from("creator_album_photos").insert({ creator_id: ben.creatorId, object_id: await image(ben, "pending"), thumb_object_id: await image(ben), width: 10, height: 10 }), "42501");
    expectDenied(await ben.client.from("creator_album_photos").insert({ creator_id: ben.creatorId, object_id: await image(ben, "clean", "application/pdf"), thumb_object_id: await image(ben), width: 10, height: 10 }), "42501");
    // Writing into someone else's album.
    expectDenied(await ben.client.from("creator_album_photos").insert({ creator_id: ana.creatorId, object_id: await image(ben), thumb_object_id: await image(ben), width: 10, height: 10 }), "42501");
    const id = expectOk(await ana.client.from("creator_album_photos").select("id").eq("creator_id", ana.creatorId).limit(1).single()).id;
    expectNoRowsAffected(await ben.client.from("creator_album_photos").update({ caption: "Not mine to change" }).eq("id", id).select("id"));
    expectNoRowsAffected(await ben.client.from("creator_album_photos").delete().eq("id", id).select("id"));
    // Pointing your photo at someone else's file is refused too.
    expectDenied(await ana.client.from("creator_album_photos").update({ object_id: await image(ben) }).eq("id", id));
  });

  it("the creator captions, orders and removes; the album holds up to 60 photos", async () => {
    const second = await photo(ana);
    expectOk(await ana.client.from("creator_album_photos").update({ caption: "Nets drying", position: -1 }).eq("id", second).select("id"));
    const order = expectOk(await ben.client.from("creator_album_photos").select("id, caption").eq("creator_id", ana.creatorId).order("position").order("created_at", { ascending: false }));
    expect(order[0]).toEqual({ id: second, caption: "Nets drying" });
    expectDenied(await ana.client.from("creator_album_photos").update({ caption: "x".repeat(201) }).eq("id", second));
    expectOk(await ana.client.from("creator_album_photos").delete().eq("id", second).select("id"));
    // Fill to the limit with admin, then one more is refused.
    const n = expectOk(await admin.from("creator_album_photos").select("id", { count: "exact", head: false }).eq("creator_id", ana.creatorId)).length;
    const rows = await Promise.all(Array.from({ length: 60 - n }, async () => ({ creator_id: ana.creatorId, object_id: await image(ana), thumb_object_id: await image(ana), width: 10, height: 10 })));
    expectOk(await admin.from("creator_album_photos").insert(rows).select("id"));
    expectDenied(await ana.client.from("creator_album_photos").insert({ creator_id: ana.creatorId, object_id: await image(ana), thumb_object_id: await image(ana), width: 10, height: 10 }), "54000");
  });
});
