import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addPart,
  addMixNote,
  addTemplateParts,
  attachPartArtifact,
  claimPart,
  createProject,
  deleteMixNote,
  deletePart,
  inviteToCrew,
  inviteToPart,
  leavePart,
  listParts,
  myPartInvites,
  partContextFor,
  partMix,
  mixNotes,
  partTakes,
  partWords,
  partsTimeline,
  respondToCrew,
  resolveMixNote,
  respondToPart,
  setPartFinal,
  setPartMix,
  startCrew,
  suggestToPart,
  updatePart,
} from "@wonder/creator-projects";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createArtifact, createProvenance, createTestCreator, createVersion, expectDenied, expectOk, registerStorageObject, type TestCreator } from "./helpers";

// Parts (docs/creative-room-parts.md): peers, with one or more people each; someone invited to a part alone sees the
// Room's name and its parts, not its items, tasks or chat. Membership moves only through the functions.
let owner: TestCreator;
let ana: TestCreator; // crew member
let dee: TestCreator; // invited to one part only
let cy: TestCreator; // outsider
const db = (x: TestCreator) => x.client as unknown as AppDb;

beforeAll(async () => {
  [owner, ana, dee, cy] = await Promise.all(["partOwner", "partAna", "partDee", "partCy"].map((l) => createTestCreator(l)));
});
afterAll(cleanupTestCreators);

async function songRoom() {
  const p = await createProject(db(owner), owner.creatorId, { title: "Platform 3", brief: "A song about waiting.", status: "active" });
  await addTemplateParts(db(owner), owner.creatorId, p.id, "song");
  const crew = await startCrew(db(owner), owner.creatorId, p.id, { purpose: "Make the song." });
  await inviteToCrew(db(owner), crew.id, { creatorId: ana.creatorId, access: "member" });
  await respondToCrew(db(ana), crew.id, true);
  const parts = await listParts(db(owner), p.id, owner.creatorId);
  return { p, crew, lyrics: parts[0]!, tune: parts[1]!, voice: parts[2]! };
}

describe("parts: who sees and does what", () => {
  it("a template lays out the parts in order; only the owner or admins add, rename or remove them", async () => {
    const { p, lyrics } = await songRoom();
    expect((await listParts(db(ana), p.id, ana.creatorId)).map((x) => [x.title, x.kind, x.status])).toEqual([
      ["Lyrics", "writing", "open"],
      ["Tune", "audio", "open"],
      ["Voice", "audio", "open"],
    ]);
    await expect(addPart(db(ana), ana.creatorId, p.id, { title: "Cover art", kind: "image" })).rejects.toThrow();
    await expect(updatePart(db(ana), lyrics.id, { title: "Words" })).rejects.toThrow(/owner or admins/);
    await expect(deletePart(db(ana), lyrics.id)).rejects.toThrow(/owner or admins/);
    const art = await addPart(db(owner), owner.creatorId, p.id, { title: "Cover art", kind: "image" });
    await updatePart(db(owner), art, { title: "Cover" });
    expect((await listParts(db(owner), p.id, owner.creatorId)).map((x) => x.title)).toEqual(["Lyrics", "Tune", "Voice", "Cover"]);
    await deletePart(db(owner), art);
    // An outsider sees nothing of the Room or its parts.
    expect(expectOk(await cy.client.from("projects").select("id").eq("id", p.id))).toEqual([]);
    expect(await listParts(db(cy), p.id, cy.creatorId)).toEqual([]);
  });

  it("crew members claim parts (two may share one); outsiders can't claim, and no one writes membership rows directly", async () => {
    const { p, lyrics } = await songRoom();
    await claimPart(db(ana), lyrics.id);
    await claimPart(db(owner), lyrics.id);
    const [l] = await listParts(db(owner), p.id, owner.creatorId);
    expect(l!.status).toBe("in_rounds");
    expect(l!.people.map((x) => x.id).sort()).toEqual([ana.creatorId, owner.creatorId].sort());
    await expect(claimPart(db(ana), lyrics.id)).rejects.toThrow(/already/);
    await expect(claimPart(db(cy), lyrics.id)).rejects.toThrow();
    expectDenied(await cy.client.from("project_part_members").insert({ part_id: lyrics.id, creator_id: cy.creatorId, status: "active" }));
    expectDenied(await ana.client.from("project_part_members").insert({ part_id: lyrics.id, creator_id: cy.creatorId, status: "active" }));
    // Leaving the only person's part opens it again.
    await leavePart(db(ana), lyrics.id);
    await leavePart(db(owner), lyrics.id);
    expect((await listParts(db(owner), p.id, owner.creatorId))[0]!.status).toBe("open");
  });

  it("someone invited to one part sees the Room and its parts, not its items or tasks; the invite is theirs to answer", async () => {
    const { p, voice, lyrics } = await songRoom();
    await claimPart(db(ana), lyrics.id);
    // Ana (on Lyrics) can invite to Voice? No: only people on that part, or the owner/admins.
    await expect(inviteToPart(db(ana), voice.id, { creatorId: dee.creatorId })).rejects.toThrow(/people on this part/);
    await inviteToPart(db(owner), voice.id, { creatorId: dee.creatorId, note: "Would you sing it?" });
    expect((await myPartInvites(db(dee), dee.creatorId)).map((i) => [i.partTitle, i.projectTitle, i.note])).toEqual([["Voice", "Platform 3", "Would you sing it?"]]);
    // Dee sees the Room row and the parts, and nothing else of it.
    expect(expectOk(await dee.client.from("projects").select("id").eq("id", p.id))).toHaveLength(1);
    expect((await listParts(db(dee), p.id, dee.creatorId)).map((x) => x.title)).toEqual(["Lyrics", "Tune", "Voice"]);
    expect(expectOk(await dee.client.from("project_items").select("id").eq("project_id", p.id))).toEqual([]);
    expect(expectOk(await dee.client.from("project_tasks").select("id").eq("project_id", p.id))).toEqual([]);
    expect(expectOk(await dee.client.from("crew_members").select("creator_id"))).toEqual([]);
    // Only Dee answers; accepting puts her on the part, outside the crew.
    await expect(respondToPart(db(cy), voice.id, true)).rejects.toThrow();
    await respondToPart(db(dee), voice.id, true);
    const v = (await listParts(db(owner), p.id, owner.creatorId))[2]!;
    expect(v.status).toBe("in_rounds");
    expect(v.people).toMatchObject([{ id: dee.creatorId, status: "active", outside: true }]);
    expect((await listParts(db(dee), p.id, dee.creatorId))[2]!.mine).toBe(true);
  });

  it("a part's Creation is the member's own; everyone else on the part edits it, and everyone making the work reads it", async () => {
    const { p, tune, voice } = await songRoom();
    await claimPart(db(ana), tune.id);
    await claimPart(db(owner), tune.id);
    await inviteToPart(db(owner), voice.id, { creatorId: dee.creatorId });
    await respondToPart(db(dee), voice.id, true);
    const anasTune = await createArtifact(ana, { title: "Platform 3 · Tune", artifact_type: "song_concept", category: "audio" });
    // Not on the part, or not your own Creation: refused.
    await expect(attachPartArtifact(db(dee), tune.id, anasTune)).rejects.toThrow(/people on this part/);
    const owners = await createArtifact(owner, { title: "Not mine to give", artifact_type: "song_concept", category: "audio" });
    await expect(attachPartArtifact(db(ana), tune.id, owners)).rejects.toThrow(/their own/);
    await attachPartArtifact(db(ana), tune.id, anasTune);
    await expect(attachPartArtifact(db(owner), tune.id, owners)).rejects.toThrow(/already has/);
    // The owner, also on Tune, can now edit Ana's Creation; Dee (on Voice only) can read it; an outsider cannot.
    expect(expectOk(await owner.client.from("artifact_contributors").select("access").eq("artifact_id", anasTune).eq("contributor_creator_id", owner.creatorId))).toEqual([{ access: "edit" }]);
    expect(expectOk(await dee.client.from("artifacts").select("id").eq("id", anasTune))).toHaveLength(1);
    expect(expectOk(await cy.client.from("artifacts").select("id").eq("id", anasTune))).toEqual([]);
    const t = (await listParts(db(dee), p.id, dee.creatorId))[1]!;
    expect(t.artifact).toMatchObject({ id: anasTune, title: "Platform 3 · Tune", versionNumber: 1 });
    // The crew sees it as work shared with the Room.
    expect(expectOk(await owner.client.from("project_items").select("artifact_id, shared").eq("project_id", p.id).eq("kind", "artifact"))).toEqual([{ artifact_id: anasTune, shared: true }]);
    // Leaving takes the edit access back.
    await leavePart(db(owner), tune.id);
    expect(expectOk(await owner.client.from("artifact_contributors").select("access").eq("artifact_id", anasTune).eq("contributor_creator_id", owner.creatorId))).toEqual([]);
  });

  it("final is said by the people on the part (or the owner), needs a Creation, and can be taken back; the timeline tells it", async () => {
    const { p, lyrics } = await songRoom();
    await claimPart(db(ana), lyrics.id);
    await expect(setPartFinal(db(ana), lyrics.id, true)).rejects.toThrow(/Creation first/);
    const words = await createArtifact(ana, { title: "Platform 3 · Lyrics", artifact_type: "lyrics", category: "writing" });
    await attachPartArtifact(db(ana), lyrics.id, words);
    await expect(setPartFinal(db(cy), lyrics.id, true)).rejects.toThrow();
    await setPartFinal(db(ana), lyrics.id, true);
    expect((await listParts(db(owner), p.id, owner.creatorId))[0]).toMatchObject({ status: "final" });
    await expect(claimPart(db(owner), lyrics.id)).rejects.toThrow(/final/);
    await setPartFinal(db(owner), lyrics.id, false);
    expect((await listParts(db(owner), p.id, owner.creatorId))[0]).toMatchObject({ status: "in_rounds", finalAt: null });
    const kinds = (await partsTimeline(db(ana), p.id, await listParts(db(ana), p.id, ana.creatorId))).map((e) => e.kind);
    expect(kinds.slice(0, 4)).toEqual(["reopened", "final", "started", "claimed"]);
    expect(kinds).toContain("added");
    // Events are the Room's: an outsider reads none.
    expect(expectOk(await cy.client.from("project_part_events").select("id").eq("project_id", p.id))).toEqual([]);
  });

  it("made with: each version records the other parts' versions; what moved on is a comparison; a suggestion is a proposal", async () => {
    const { p, lyrics, voice } = await songRoom();
    await claimPart(db(ana), lyrics.id);
    await inviteToPart(db(owner), voice.id, { creatorId: dee.creatorId });
    await respondToPart(db(dee), voice.id, true);
    const words = await createArtifact(ana, { title: "Platform 3 · Lyrics", artifact_type: "lyrics", category: "writing" });
    await attachPartArtifact(db(ana), lyrics.id, words);
    const w1 = await createVersion(ana, words, "Every Sunday my father waited");
    const take = await createArtifact(dee, { title: "Platform 3 · Voice", artifact_type: "song_concept", category: "audio" });
    await attachPartArtifact(db(dee), voice.id, take);
    await createVersion(dee, take, "first take");
    // Dee's take was made with Lyrics v1; Tune wasn't started.
    let ctx = (await partContextFor(db(dee), take, dee.creatorId))!;
    expect(ctx.part.title).toBe("Voice");
    expect(ctx.others.map((o) => [o.title, o.madeWith?.number ?? null, o.current?.number ?? null, o.movedOn])).toEqual([
      ["Lyrics", 1, 1, false],
      ["Tune", null, null, false],
    ]);
    expect(ctx.others[0]!.canSuggest).toBe(true);
    // The lyrics move on: the take's page says so, and Dee reads what changed (she's on a part, not the crew).
    await createVersion(ana, words, "Every Sunday my father waited\nat Platform 3");
    ctx = (await partContextFor(db(dee), take, dee.creatorId))!;
    expect(ctx.others[0]).toMatchObject({ movedOn: true, madeWith: { number: 1 }, current: { number: 2 } });
    const read = await partWords(db(dee), lyrics.id, w1.id);
    expect([read.from?.content, read.current.content]).toEqual(["Every Sunday my father waited", "Every Sunday my father waited\nat Platform 3"]);
    // An outsider reads neither the versions nor the context.
    await expect(partWords(db(cy), lyrics.id)).rejects.toThrow();
    expect(expectOk(await cy.client.from("project_part_version_context").select("version_id").eq("project_id", p.id))).toEqual([]);
    // The Room's row says what the take was made with; the timeline too.
    const rows = await listParts(db(owner), p.id, owner.creatorId);
    expect(rows[2]!.madeWith?.find((m) => m.title === "Lyrics")?.versionNumber).toBe(1);
    // Dee suggests to the lyricist: a proposal on the current version; nothing changes until Ana decides.
    const proposalId = await suggestToPart(db(dee), lyrics.id, { content: "Every Sunday my father waited\nat Platform 3, coat folded", summary: "One more beat in line two" });
    expect(expectOk(await ana.client.from("artifact_change_proposals").select("id, status, creator_id").eq("artifact_id", words))).toEqual([{ id: proposalId, status: "open", creator_id: dee.creatorId }]);
    expect(expectOk(await dee.client.from("artifact_change_proposals").select("id").eq("id", proposalId))).toHaveLength(1);
    // A second take, made with the new lyrics: the timeline says what each version was made with.
    await createVersion(dee, take, "second take");
    expect((await partContextFor(db(dee), take, dee.creatorId))!.others[0]).toMatchObject({ movedOn: false, madeWith: { number: 2 } });
    const timeline = await partsTimeline(db(owner), p.id, rows);
    expect(timeline.find((e) => e.kind === "suggested")).toMatchObject({ partTitle: "Lyrics", detail: { summary: "One more beat in line two" } });
    expect(timeline.find((e) => e.kind === "version" && e.partTitle === "Voice")?.detail.madeWith).toEqual(["Lyrics v2"]);
    // Refused: an outsider; your own words (just write); a part with nothing yet.
    await expect(suggestToPart(db(cy), lyrics.id, { content: "x", summary: "x" })).rejects.toThrow(/making this work/);
    await expect(suggestToPart(db(ana), lyrics.id, { content: "x", summary: "x" })).rejects.toThrow(/your own/);
    const tune = rows[1]!;
    await expect(suggestToPart(db(dee), tune.id, { content: "x", summary: "x" })).rejects.toThrow(/no words yet/);
    // Version context is history: it can't be written by clients.
    expectDenied(await dee.client.from("project_part_version_context").insert({ version_id: w1.id, part_id: lyrics.id, project_id: p.id }));
  });

  it("play-along: a part's kept take is offered to the people making the work, never to anyone else", async () => {
    const { p, lyrics, tune } = await songRoom();
    await claimPart(db(ana), tune.id);
    await claimPart(db(owner), lyrics.id);
    await inviteToPart(db(owner), lyrics.id, { creatorId: dee.creatorId });
    await respondToPart(db(dee), lyrics.id, true);
    // Ana keeps a take on Tune: a checked recording of her own, as the Audio page saves it.
    const admin = adminClient();
    const take = async (status: "clean" | "quarantined") => {
      const obj = await registerStorageObject(ana);
      expectOk(await admin.from("storage_objects").update({ security_status: status, mime_type: "audio/webm" }).eq("id", obj));
      const mat = expectOk(
        await admin
          .from("creative_materials")
          .insert({ creator_id: ana.creatorId, type: "audio", title: "Tune take", storage_object_id: obj, provenance_id: await createProvenance(ana, "upload"), security_status: status })
          .select("id")
          .single(),
      ).id;
      return { obj, mat };
    };
    const tuneArt = await createArtifact(ana, { title: "Platform 3 · Tune", artifact_type: "song_concept", category: "audio" });
    await attachPartArtifact(db(ana), tune.id, tuneArt);
    const good = await take("clean");
    expectOk(await ana.client.rpc("create_artifact_version", { p_artifact_id: tuneArt, p_content: "", p_label: "First take", p_author_kind: "creator", p_structured_content: { kind: "audio", take: { materialId: good.mat, seconds: 42 } } }));
    // The lyricist (crew owner) and Dee (on Lyrics only) both get it; an outsider gets nothing.
    for (const who of [owner, dee]) {
      expect(await partTakes(db(who), p.id)).toEqual([{ partId: tune.id, title: "Tune", artifactId: tuneArt, versionNumber: 1, storageObjectId: good.obj, seconds: 42 }]);
    }
    expect(await partTakes(db(cy), p.id)).toEqual([]);
    // A written part is no take; a recording held for safety is never offered.
    const bad = await take("quarantined");
    expectOk(await ana.client.rpc("create_artifact_version", { p_artifact_id: tuneArt, p_content: "", p_label: "Second take", p_author_kind: "creator", p_structured_content: { kind: "audio", take: { materialId: bad.mat, seconds: 40 } } }));
    expect(await partTakes(db(owner), p.id)).toEqual([]);
    // Someone else's Material named in a take isn't offered either: the take must be the part owner's own recording.
    const lyricsArt = await createArtifact(owner, { title: "Platform 3 · Lyrics", artifact_type: "lyrics", category: "writing" });
    await attachPartArtifact(db(owner), lyrics.id, lyricsArt);
    expectOk(await owner.client.rpc("create_artifact_version", { p_artifact_id: lyricsArt, p_content: "words", p_label: "Draft", p_author_kind: "creator", p_structured_content: { kind: "audio", take: { materialId: good.mat, seconds: 1 } } }));
    expect((await partTakes(db(dee), p.id)).map((t) => t.partId)).not.toContain(lyrics.id);
  });

  it("listen together: the people making the work set the mix; whoever sees the Room reads it; nothing else rides along", async () => {
    const { p, lyrics, tune } = await songRoom();
    await claimPart(db(ana), tune.id);
    await inviteToPart(db(owner), lyrics.id, { creatorId: dee.creatorId });
    const set = { [tune.id]: { offsetMs: 1500, gain: 0.8, muted: false } };
    // Invited isn't making the work yet; accepting is.
    await expect(setPartMix(db(dee), p.id, set)).rejects.toThrow();
    await respondToPart(db(dee), lyrics.id, true);
    await setPartMix(db(dee), p.id, set);
    for (const who of [owner, ana, dee]) expect((await partMix(db(who), p.id)).tracks).toEqual(set);
    // An outsider neither reads nor changes it.
    expect((await partMix(db(cy), p.id)).tracks).toEqual({});
    await expect(setPartMix(db(cy), p.id, {})).rejects.toThrow();
    // Only this Room's parts, only in range, only through the function; unknown fields are dropped.
    const other = await songRoom();
    expectDenied(await owner.client.rpc("part_mix_set", { p_project: p.id, p_tracks: { [other.tune.id]: { offsetMs: 0, gain: 1, muted: false } } }));
    expectDenied(await owner.client.rpc("part_mix_set", { p_project: p.id, p_tracks: { [tune.id]: { offsetMs: 0, gain: 5, muted: false } } }));
    expectDenied(await owner.client.rpc("part_mix_set", { p_project: p.id, p_tracks: { [tune.id]: { offsetMs: 0, gain: "loud", muted: false } } }));
    expectDenied(await owner.client.from("project_mixes").update({ tracks: {} }).eq("project_id", p.id));
    expectDenied(await owner.client.from("project_mixes").insert({ project_id: other.p.id, tracks: {} }));
    expectOk(await owner.client.rpc("part_mix_set", { p_project: p.id, p_tracks: { [tune.id]: { offsetMs: 250.4, gain: 1, muted: true, url: "https://example.com/x.mp3" } } }));
    const row = expectOk(await adminClient().from("project_mixes").select("tracks, updated_by").eq("project_id", p.id).single());
    expect(row).toEqual({ tracks: { [tune.id]: { offsetMs: 250, gain: 1, muted: true } }, updated_by: owner.creatorId });
  });

  it("notes on a moment: left by the people making the work, read by the Room, resolved by their author or the owner", async () => {
    const { p, lyrics, tune } = await songRoom();
    await claimPart(db(ana), tune.id);
    await inviteToPart(db(owner), lyrics.id, { creatorId: dee.creatorId });
    // Invited isn't making the work yet; an outsider never is.
    await expect(addMixNote(db(dee), p.id, { atMs: 1000, body: "Too early" })).rejects.toThrow();
    await expect(addMixNote(db(cy), p.id, { atMs: 1000, body: "Too early" })).rejects.toThrow();
    await respondToPart(db(dee), lyrics.id, true);
    // Tune has a take (v1) when Dee leaves her note about it.
    const tuneArt = await createArtifact(ana, { title: "Platform 3 · Tune", artifact_type: "song_concept", category: "audio" });
    await attachPartArtifact(db(ana), tune.id, tuneArt);
    expectOk(await ana.client.rpc("create_artifact_version", { p_artifact_id: tuneArt, p_content: "", p_label: "Take", p_author_kind: "creator", p_structured_content: { kind: "audio", take: { materialId: "00000000-0000-0000-0000-000000000000", seconds: 40 } } }));
    const deeNote = await addMixNote(db(dee), p.id, { atMs: 42_000, body: "The voice comes in early here", partId: tune.id });
    const anaNote = await addMixNote(db(ana), p.id, { atMs: 5_000, body: "Lovely intro" });
    for (const who of [owner, ana, dee]) {
      const notes = await mixNotes(db(who), p.id, who.creatorId, who === owner);
      expect(notes.map((n) => [n.atMs, n.body, n.partTitle, n.author?.id])).toEqual([
        [5_000, "Lovely intro", null, ana.creatorId],
        [42_000, "The voice comes in early here", "Tune", dee.creatorId],
      ]);
      expect(notes[1]!.heard).toEqual([{ partId: tune.id, title: "Tune", versionNumber: 1 }]);
    }
    expect(await mixNotes(db(cy), p.id, cy.creatorId, false)).toEqual([]);
    // A note about a part shows in the Room's timeline.
    expect((await partsTimeline(db(owner), p.id, await listParts(db(owner), p.id, owner.creatorId))).find((e) => e.kind === "noted")?.detail).toMatchObject({ noteId: deeNote, atMs: 42_000 });
    // Resolving: its author or the owner — not another member. Deleting likewise.
    await expect(resolveMixNote(db(ana), deeNote, true)).rejects.toThrow();
    await resolveMixNote(db(owner), deeNote, true);
    expect((await mixNotes(db(dee), p.id, dee.creatorId, false)).find((n) => n.id === deeNote)?.resolved).toBe(true);
    await resolveMixNote(db(dee), deeNote, false);
    expect((await mixNotes(db(dee), p.id, dee.creatorId, false)).find((n) => n.id === deeNote)?.resolved).toBe(false);
    await expect(deleteMixNote(db(dee), anaNote)).rejects.toThrow();
    await deleteMixNote(db(owner), anaNote);
    // Only through the function: no direct writes, no notes on another Room's part, nothing out of range.
    const other = await songRoom();
    expectDenied(await owner.client.from("project_mix_notes").insert({ project_id: p.id, at_ms: 0, body: "x", creator_id: owner.creatorId }));
    expectDenied(await owner.client.from("project_mix_notes").update({ body: "edited" }).eq("id", deeNote));
    expectDenied(await owner.client.rpc("mix_note_add", { p_project: p.id, p_at_ms: 0, p_body: "x", p_part: other.tune.id }));
    expectDenied(await owner.client.rpc("mix_note_add", { p_project: p.id, p_at_ms: -1, p_body: "x" }));
    expectDenied(await owner.client.rpc("mix_note_add", { p_project: p.id, p_at_ms: 0, p_body: "   " }));
    expect((await mixNotes(db(owner), p.id, owner.creatorId, true)).map((n) => n.id)).toEqual([deeNote]);
  });
});
