import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMaterial } from "@wonder/creator-library";
import { createArtifact, getCreatorPage, publishCreation, saveCreatorPage, saveCreatorVersion, unpublishCreation, updatePublishedWork, type PublishedSnapshot } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, anonClient, cleanupTestCreators, createTestCreator, expectDenied, expectOk, loose, registerStorageObject, type TestCreator } from "./helpers";

// CreatorPublish: frozen published revisions at stable addresses, Private / Unlisted / Public, a curated Creator Page,
// public DejaVus that never leak private Moments — all reached by signed-out readers only through publication-safe
// functions.
const admin = adminClient();
const anon = anonClient();
let a: TestCreator;
let b: TestCreator;
let handle: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;
const work = async (h: string, slug: string) => (await anon.rpc("public_work", { p_handle: h, p_slug: slug })).data as { snapshot: PublishedSnapshot; revision: { number: number }; manifest: { experience: string; poem?: boolean } } | null;

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("pubA"), createTestCreator("pubB")]);
  handle = `pub${Date.now().toString(36)}`;
  expectOk(await admin.from("creators").update({ handle }).eq("id", a.creatorId).select("id"));
});
afterAll(cleanupTestCreators);

describe("published revisions", () => {
  it("freeze what readers see: edits stay private until the creator updates the published version, under the same address", async () => {
    const poem = await createArtifact(db(a), a.creatorId, { artifactType: "poem", title: "Chand Amavas", content: "The moon wanes,\n  slipping into the new moon's pocket.\n\nIn the mirror\nonly stubble.", authorKind: "creator", provenance: { origin: "typed" } });
    const pub = await publishCreation(db(a), a.creatorId, poem.id, { visibility: "public" });
    expect(pub.slug).toBe("chand-amavas");
    let seen = await work(handle, "chand-amavas");
    expect(seen?.manifest).toMatchObject({ experience: "read", poem: true });
    // Line breaks, indentation and stanza spacing survive.
    expect(seen?.snapshot.content).toBe("The moon wanes,\n  slipping into the new moon's pocket.\n\nIn the mirror\nonly stubble.");

    const { data: cur } = await admin.from("artifacts").select("current_version_id").eq("id", poem.id).single();
    await saveCreatorVersion(db(a), poem.id, { content: "A private rewrite.", baseVersionId: cur!.current_version_id, label: "Rewrite" });
    seen = await work(handle, "chand-amavas");
    expect(seen?.snapshot.content).not.toContain("private rewrite");
    expect(seen?.revision.number).toBe(1);

    const again = await publishCreation(db(a), a.creatorId, poem.id, { visibility: "public" });
    expect(again.slug).toBe("chand-amavas");
    seen = await work(handle, "chand-amavas");
    expect(seen?.snapshot.content).toBe("A private rewrite.");
    expect(seen?.revision.number).toBe(2);

    // Revisions are immutable and the creator's alone.
    expectDenied(await loose(a.client).from("published_revisions").update({ revision_number: 9 }).eq("artifact_id", poem.id).select("id"));
    expect(expectOk(await b.client.from("published_revisions").select("id").eq("artifact_id", poem.id))).toEqual([]);
    expectDenied(await b.client.from("published_works").insert({ artifact_id: poem.id, creator_id: b.creatorId, slug: "stolen" }));
    // The working Creation itself stays private.
    expect(expectOk(await anon.from("artifacts").select("id").eq("id", poem.id))).toEqual([]);
  });

  it("Private, Unlisted, Public — and unpublishing takes it down everywhere", async () => {
    const essay = await createArtifact(db(a), a.creatorId, { artifactType: "essay", title: "Waiting Rooms", content: "Sometimes a place remains inside you.", authorKind: "creator", provenance: { origin: "typed" } });
    await publishCreation(db(a), a.creatorId, essay.id, { visibility: "unlisted" });
    expect(await work(handle, "waiting-rooms")).not.toBeNull();
    await updatePublishedWork(db(a), essay.id, { visibility: "private" });
    expect(await work(handle, "waiting-rooms")).toBeNull();
    await updatePublishedWork(db(a), essay.id, { visibility: "public" });
    expect(await work(handle, "waiting-rooms")).not.toBeNull();
    await unpublishCreation(db(a), essay.id);
    expect(await work(handle, "waiting-rooms")).toBeNull();
  });

  it("a Carousel publishes as a Swipe with its slides, words and overlays", async () => {
    const c = await createArtifact(db(a), a.creatorId, { artifactType: "carousel", title: "A Life in Moments", content: "One. Two.", authorKind: "creator", provenance: { origin: "typed" } });
    expectOk(await admin.from("carousels").insert({ artifact_id: c.id, creator_id: a.creatorId, requested_count: 2, aspect_ratio: "4:5", visual_style: "auto" }).select("artifact_id"));
    expectOk(await admin.from("carousel_slides").insert([
      { artifact_id: c.id, creator_id: a.creatorId, order_index: 0, source_text: "One", display_text: "One" },
      { artifact_id: c.id, creator_id: a.creatorId, order_index: 1, source_text: "Two", display_text: "Two" },
    ]));
    await publishCreation(db(a), a.creatorId, c.id, {});
    const seen = await work(handle, "a-life-in-moments");
    expect(seen?.manifest).toMatchObject({ experience: "swipe", descriptor: "Visual story · 2 slides" });
    expect(seen?.snapshot.slides?.map((s) => [s.text, s.overlay.enabled])).toEqual([
      ["One", true],
      ["Two", true],
    ]);
  });
});

describe("the Creator Page", () => {
  it("shows only what the creator chose, and only once they publish it", async () => {
    expect((await anon.rpc("public_creator_page", { p_handle: handle })).data).toBeNull();
    await saveCreatorPage(db(a), a.creatorId, { isPublished: true, headline: "Writer · Photographer" });
    const page = (await anon.rpc("public_creator_page", { p_handle: handle })).data as { works: Array<{ slug: string }>; dejavus: unknown[]; moments: unknown[]; headline: string };
    expect(page.headline).toBe("Writer · Photographer");
    // Public works only (the unlisted and unpublished ones never appear).
    expect(page.works.map((w) => w.slug).sort()).toEqual(["a-life-in-moments", "chand-amavas"]);
    expect(page.dejavus).toEqual([]);
    expect(page.moments).toEqual([]);
    // Someone else's DejaVu or Scrapbook entry can't be put on this page.
    const theirs = expectOk(await b.client.from("dejavus").insert({ creator_id: b.creatorId, name: "Theirs" }).select("id").single()).id;
    await expect(saveCreatorPage(db(a), a.creatorId, { publicDejaVuIds: [theirs] })).rejects.toThrow();
  });

  it("a public DejaVu holds public works and chosen Moments — never the private Moments beside them", async () => {
    const dv = expectOk(await a.client.from("dejavus").insert({ creator_id: a.creatorId, name: "Railways" }).select("id").single()).id;
    const privateNote = await createMaterial(db(a), a.creatorId, { type: "note", title: "Dad's private letter", textContent: "private", provenance: { origin: "typed" } });
    const { data: poem } = await admin.from("published_works").select("artifact_id").eq("slug", "chand-amavas").eq("creator_id", a.creatorId).single();
    const post = expectOk(await a.client.from("scrapbook_posts").insert({ creator_id: a.creatorId, body: "Platform 3 at dawn.", visibility: "public" }).select("id").single()).id;
    const moments = await Promise.all([
      admin.from("moment_references").select("id").eq("entity_type", "creation").eq("entity_id", poem!.artifact_id).single(),
      admin.from("moment_references").select("id").eq("entity_type", "material").eq("entity_id", privateNote.id).single(),
    ]);
    let postMoment = (await admin.from("moment_references").select("id").eq("entity_type", "scrapbook_entry").eq("entity_id", post).maybeSingle()).data?.id;
    postMoment ??= expectOk(await a.client.from("moment_references").insert({ creator_id: a.creatorId, entity_type: "scrapbook_entry", entity_id: post, visibility: "public" }).select("id").single()).id;
    for (const m of [moments[0].data!.id, moments[1].data!.id, postMoment]) expectOk(await a.client.from("dejavu_moments").insert({ dejavu_id: dv, moment_id: m, creator_id: a.creatorId, added_by: a.creatorId }));

    // Not on the page yet: not public.
    expect((await anon.rpc("public_dejavu", { p_handle: handle, p_dejavu: dv })).data).toBeNull();
    await saveCreatorPage(db(a), a.creatorId, { publicDejaVuIds: [dv], publicMomentIds: [post] });
    const d = (await anon.rpc("public_dejavu", { p_handle: handle, p_dejavu: dv })).data as { items: Array<{ kind: string; card?: { slug: string }; moment?: { body: string } }> };
    expect(d.items.map((i) => i.kind).sort()).toEqual(["creation", "moment"]);
    expect(JSON.stringify(d)).not.toContain("private letter");
  });
});

describe("light analytics", () => {
  it("counts views and shares per day — no visitor data — readable only by the creator", async () => {
    const { data: w } = await admin.from("published_works").select("id").eq("slug", "chand-amavas").eq("creator_id", a.creatorId).single();
    await anon.rpc("record_publication_event", { p_work: w!.id, p_kind: "view" });
    await anon.rpc("record_publication_event", { p_work: w!.id, p_kind: "view" });
    await anon.rpc("record_publication_event", { p_work: w!.id, p_kind: "share" });
    await anon.rpc("record_publication_event", { p_work: w!.id, p_kind: "like" });
    const rows = expectOk(await a.client.from("published_work_stats").select("views, shares, completions").eq("work_id", w!.id));
    expect(rows).toEqual([{ views: 2, shares: 1, completions: 0 }]);
    expect(expectOk(await b.client.from("published_work_stats").select("views").eq("work_id", w!.id))).toEqual([]);
  });
});

describe("type-aware snapshots", () => {
  it("a photo essay becomes a Journey of its words and pictures — only files that passed the upload checks", async () => {
    const essay = await createArtifact(db(a), a.creatorId, { artifactType: "photo_essay", title: "Coastal Notes", content: "A week along the coast.\n\nSalt air, warmer light.\n\nA slower rhythm.", authorKind: "creator", provenance: { origin: "typed" } });
    const [clean, dirty] = [await registerStorageObject(a), await registerStorageObject(a)];
    expectOk(await admin.from("storage_objects").update({ security_status: "clean" }).eq("id", clean).select("id"));
    const pics = await Promise.all([
      createMaterial(db(a), a.creatorId, { type: "image", title: "Cliffs at dusk", storageObjectId: clean, provenance: { origin: "typed" } }),
      createMaterial(db(a), a.creatorId, { type: "image", title: "Unscanned", storageObjectId: dirty, provenance: { origin: "typed" } }),
    ]);
    for (const p of pics) expectOk(await admin.from("lineage_edges").insert({ creator_id: a.creatorId, source_type: "material", source_id: p.id, target_type: "artifact", target_id: essay.id, relationship: "contains_material" }).select("id"));
    await publishCreation(db(a), a.creatorId, essay.id, {});
    const seen = await work(handle, "coastal-notes");
    expect(seen?.manifest.experience).toBe("journey");
    const blocks = seen!.snapshot.blocks!;
    expect(blocks.map((b) => b.kind)).toEqual(["image", "text", "text", "text"]);
    expect(JSON.stringify(seen)).not.toContain(dirty);
    expect(blocks[0]).toMatchObject({ kind: "image", objectId: clean, alt: "Cliffs at dusk" });
  });
});


describe("Creator Page templates", () => {
  it("a template is presentation only: switching keeps the content, the address and each template's own settings", async () => {
    await saveCreatorPage(db(a), a.creatorId, { templateId: "cinematic_dark", templateSettings: { template: "cinematic_dark", settings: { accentMode: "cool" } } });
    await saveCreatorPage(db(a), a.creatorId, { templateId: "minimal_editorial", templateSettings: { template: "minimal_editorial", settings: { paperTone: "neutral" } } });
    await saveCreatorPage(db(a), a.creatorId, { templateId: "cinematic_dark" });
    const mine = await getCreatorPage(db(a), a.creatorId);
    expect(mine.templateId).toBe("cinematic_dark");
    expect(mine.templateSettings.cinematic_dark!.accentMode).toBe("cool");
    expect(mine.templateSettings.minimal_editorial!.paperTone).toBe("neutral");

    const pub = (await anon.rpc("public_creator_page", { p_handle: handle })).data as { templateId: string; works: Array<{ slug: string; excerpt: string | null; poem: boolean }>; creator: Record<string, unknown> };
    expect(pub.templateId).toBe("cinematic_dark");
    expect(pub.works.map((w) => w.slug).sort()).toEqual(["a-life-in-moments", "chand-amavas", "coastal-notes"]);
    // Text work carries its words for typographic cards; private Profile fields never leave.
    expect(pub.works.find((w) => w.slug === "chand-amavas")).toMatchObject({ poem: true, excerpt: "A private rewrite." });
    expect(Object.keys(pub.creator).sort()).toEqual(["avatarObjectId", "bio", "handle", "id", "location", "name", "roles"]);

    // Only offered choices are accepted, and the database refuses unknown templates too.
    await expect(saveCreatorPage(db(a), a.creatorId, { templateSettings: { template: "soft_gradient", settings: { gradientPreset: "#ff00ff" } } })).rejects.toThrow();
    expectDenied(await loose(a.client).from("creator_pages").update({ template_id: "brutalist" }).eq("creator_id", a.creatorId).select("creator_id"));
  });

  it("the owner previews exactly the public payload, published or not; nobody else can", async () => {
    await saveCreatorPage(db(b), b.creatorId, { isPublished: false, headline: "Not yet public" });
    const bh = (await admin.from("creators").select("handle").eq("id", b.creatorId).single()).data!.handle!;
    expect((await anon.rpc("public_creator_page", { p_handle: bh })).data).toBeNull();
    const preview = (await b.client.rpc("creator_page_preview")).data as { headline: string; isPublished: boolean; creator: { id: string } };
    expect(preview).toMatchObject({ headline: "Not yet public", isPublished: false, creator: { id: b.creatorId } });
    expectDenied(await anon.rpc("creator_page_preview"));
  });
});
