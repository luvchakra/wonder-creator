import { describe, expect, it } from "vitest";
import { globalPalette, MAX_PRIMARY, resolvePalette } from "./resolve";
import type { Lifecycle, PaletteContext, Permission } from "./types";

const OWNER: Permission[] = ["edit", "publish", "rights", "collaborate", "invite"];
const labels = (ctx: PaletteContext) => resolvePalette(ctx).primary.map((x) => x.label);
const creation = (lifecycle: Lifecycle, permissions: Permission[] = OWNER): PaletteContext => ({ page: "creation", lifecycle, permissions, ids: { artifactId: "a1" } });

describe("context-aware Palette", () => {
  it("global has the four destinations (Huddles is in Explore); Home leaves out Home", () => {
    expect(globalPalette().primary.map((x) => x.label)).toEqual(["Home", "Create", "Materials", "Explore", "Me"]);
    expect(labels({ page: "home" })).toEqual(["Create", "Materials", "Explore", "Me"]);
  });

  it("never shows more than three first-level actions in a context, and never a dangerous one", () => {
    const pages: PaletteContext[] = [
      creation("in-progress"),
      creation("finished"),
      { page: "room", permissions: OWNER, ids: { projectId: "p1", crewId: "c1" }, facts: { hasCrew: true, activeCreationId: "a1" } },
      { page: "studio", permissions: OWNER, ids: { artifactId: "a1" } },
      { page: "material", entityType: "photo", permissions: OWNER, ids: { materialId: "m1" }, facts: { related: "tide" } },
      { page: "me" },
    ];
    for (const p of pages) {
      const m = resolvePalette(p);
      expect(m.primary.length).toBeLessThanOrEqual(MAX_PRIMARY);
      expect(m.primary.some((x) => x.class === "dangerous")).toBe(false);
      // Global destinations don't leak into a context.
      expect(m.primary.map((x) => x.id)).not.toContain("home");
    }
  });

  it("follows the Creation's lifecycle (§7, §32)", () => {
    expect(labels(creation("idea"))).toEqual(["Bring Material", "Explore", "meTalk"]);
    expect(labels(creation("in-progress"))).toEqual(["Continue Creating", "Bring Material", "Refine"]);
    expect(resolvePalette(creation("in-progress")).more.map((x) => x.label)).toContain("Publish");
    expect(labels(creation("review"))).toEqual(["Review", "Refine", "Compare Versions"]);
    expect(labels(creation("finished"))).toEqual(["Create from this", "Share", "Publish"]);
    expect(labels(creation("published"))).toEqual(["Transform", "Publication history", "Share"]);
  });

  it("follows the Material's medium (§9.5–9.8)", () => {
    const m = (entityType: PaletteContext["entityType"]) => labels({ page: "material", entityType, permissions: OWNER, ids: { materialId: "m1" }, facts: { related: "tide" } });
    // The page itself shows Use in creation and Details (owner, 4 Oct 2026: fewer buttons), so the Palette doesn't repeat them.
    expect(m("photo")).toEqual(["Find related", "Add to Collection", "Explore possibilities"]);
    expect(m("audio")).toEqual(["Use the words", "Find related", "Add to Collection"]);
    expect(m("note")).toEqual(["Extract ideas", "Find related", "Add to Collection"]);
  });

  it("respects permissions (§11, §31): a viewer never sees edit, publish or rights changes", () => {
    const viewer = resolvePalette(creation("finished", []));
    const all = [...viewer.primary, ...viewer.more].map((x) => x.id);
    for (const id of ["continue", "refine", "publish", "share", "license", "create-from", "people"]) expect(all).not.toContain(id);
    expect(viewer.primary.map((x) => x.label)).toEqual(["Context", "Versions", "Rights & licensing"]);
    // A collaborator can reach People, still not Publish.
    const collaborator = resolvePalette(creation("finished", ["collaborate"]));
    expect(collaborator.primary.map((x) => x.id)).toContain("people");
    expect([...collaborator.primary, ...collaborator.more].map((x) => x.id)).not.toContain("publish");
    // The owner sees Publish first, and License under More….
    expect(labels(creation("finished"))).toContain("Publish");
    expect(resolvePalette(creation("finished")).more.map((x) => x.label)).toContain("License");
  });

  it("a Creative Room offers the Studio when there's active work, and a start when there isn't", () => {
    const room = (activeCreationId: string | null) => labels({ page: "room", permissions: OWNER, ids: { projectId: "p1" }, facts: { activeCreationId, hasCrew: false } });
    expect(room("a1")).toEqual(["Open Studio", "Bring Material", "Invite People"]);
    expect(room(null)[0]).toBe("Start Creation");
  });

  it("a community offers what's next beyond its own page controls, by membership", () => {
    const community = (member: boolean) => labels({ page: "community", ids: { projectId: "p1" }, facts: { member, host: false } });
    expect(community(true)).toEqual(["Share a Creation here", "Chat & Huddle", "Open Creative Room"]);
    expect(community(false)).toEqual(["All communities", "Pulse"]);
  });

  it("Settings only offers a way out", () => {
    expect(labels({ page: "settings" })).toEqual(["Home", "Me"]);
  });
});
