import { describe, expect, it } from "vitest";
import { connectionSignature, findCandidates, isMeaningfulName, type MomentRow } from "./connections";
import { repeatedlyDismissed } from "./suggest";

const now = Date.parse("2026-09-29T12:00:00Z");
const m = (id: string, subtype: string, iso: string, over: Partial<MomentRow> = {}): MomentRow => ({ id, entity_type: "material", entity_id: `mat-${id}`, subtype, occurred_at: iso, title: null, ...over });
const base = { now, tags: new Map<string, string[]>(), linked: new Set<string>(), drafts: [], text: new Map<string, string>() };

describe("Your world is connecting (Phase 05 §5)", () => {
  it("prefers human concepts over metadata", () => {
    for (const n of ["Dad", "Railways", "Waiting", "Things We Almost Forgot"]) expect(isMeaningfulName(n)).toBe(true);
    for (const n of ["Photo", "Blue", "Tuesday", "Content", "IMG_2041", "2024", "ab"]) expect(isMeaningfulName(n)).toBe(false);
  });

  it("a voice note and photographs from the same day may be the same memory", () => {
    const c = findCandidates({ ...base, moments: [m("v", "voice", "2026-03-12T09:00:00Z"), m("p1", "image", "2026-03-12T10:00:00Z"), m("p2", "image", "2026-03-12T18:00:00Z"), m("n", "note", "2026-03-14T10:00:00Z")] });
    expect(c[0]).toMatchObject({ connectionType: "same_memory", momentIds: ["v", "p1", "p2"], evidence: ["All captured on 12 March"] });
    expect(c[0]!.shortExplanation).toBe("Your voice note from March and these two photographs may describe the same memory.");
  });

  it("a meaningful tag shared across time, never a generic one — and never what the creator already connected", () => {
    const moments = [m("old", "image", "2026-03-01T10:00:00Z"), m("new", "note", "2026-09-27T10:00:00Z")];
    const tags = new Map([
      ["mat-old", ["waiting", "photo"]],
      ["mat-new", ["waiting", "photo"]],
    ]);
    const c = findCandidates({ ...base, moments, tags });
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ connectionType: "shared_theme", momentIds: ["old", "new"], evidence: ["Both are tagged “waiting”"] });
    expect(findCandidates({ ...base, moments, tags, linked: new Set(["new,old"]) })).toEqual([]);
  });

  it("a fresh note that names an unfinished Creation is a creative opportunity", () => {
    const note = m("n", "note", "2026-09-29T08:00:00Z");
    const c = findCandidates({ ...base, moments: [note], drafts: [{ momentId: "c1", title: "Platform 3 Railways", materialIds: new Set() }], text: new Map([["mat-n", "The railways at dusk, again."]]) });
    expect(c[0]).toMatchObject({ connectionType: "creative_opportunity", momentIds: ["n", "c1"], shortExplanation: "Today's note may fit “Platform 3 Railways”." });
    // Already part of it: nothing to suggest.
    expect(findCandidates({ ...base, moments: [note], drafts: [{ momentId: "c1", title: "Railways", materialIds: new Set(["mat-n"]) }], text: new Map([["mat-n", "railways"]]) })).toEqual([]);
  });

  it("one signature per set of Moments and kind, whatever the order", () => {
    expect(connectionSignature("same_memory", ["b", "a"])).toBe(connectionSignature("same_memory", ["a", "b", "a"]));
  });
});

describe("DejaVu suggestions (Phase 05 §6)", () => {
  it("stop offering a DejaVu turned down twice", () => {
    expect(repeatedlyDismissed(["a", "b", "a", null, "c"])).toEqual(["a"]);
  });
});
