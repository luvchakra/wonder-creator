import { describe, expect, it } from "vitest";
import { resolveContextStrip } from "./resolve";

describe("resolveContextStrip", () => {
  it("shows a Creation's version and stage, not its title", () => {
    expect(resolveContextStrip({ page: "creation", lifecycle: "in-progress", facts: { version: 4 } }).primary?.text).toBe("v4 · In progress");
    expect(resolveContextStrip({ page: "creation", lifecycle: "finished", facts: { visibility: "private" } }).primary?.text).toBe("Finished · Private");
    expect(resolveContextStrip({ page: "creation", lifecycle: "published", facts: { publishedTo: "Instagram" } }).primary).toMatchObject({ text: "Published · Instagram", tone: "success" });
  });

  it("follows the §12 priority: failure beats offline beats publishing beats lifecycle", () => {
    const base = { page: "creation" as const, lifecycle: "in-progress" as const, facts: { version: 4 } };
    expect(resolveContextStrip({ ...base, facts: { ...base.facts, publishState: "publishing" } }).primary?.text).toBe("Publishing…");
    expect(resolveContextStrip({ ...base, facts: { ...base.facts, publishState: "publishing" }, online: false }).primary?.text).toBe("Offline");
    expect(resolveContextStrip({ ...base, facts: { publishState: "failed" }, online: false }).primary).toMatchObject({ text: "Publish failed", tone: "error" });
  });

  it("transient save states win while fresh and give way when expired", () => {
    const now = 1_000;
    const saved = { id: "save", text: "Saved", tone: "success" as const, priority: 6, expiresAt: now + 1500 };
    expect(resolveContextStrip({ page: "studio", lifecycle: "in-progress", facts: { version: 2 }, signals: [saved], now }).primary?.text).toBe("Saved");
    expect(resolveContextStrip({ page: "studio", lifecycle: "in-progress", facts: { version: 2 }, signals: [saved], now: now + 2000 }).primary?.text).toBe("v2 · In progress");
    expect(resolveContextStrip({ page: "studio", online: false }).primary?.text).toBe("Offline · Saved locally");
  });

  it("keeps a secondary signal from a lower tier only", () => {
    const m = resolveContextStrip({ page: "creation", lifecycle: "in-progress", facts: { version: 3, collaboratorCount: 2 }, signals: [{ id: "save", text: "Saved", tone: "success", priority: 6 }] });
    expect(m.primary?.text).toBe("Saved");
    expect(m.secondary?.text).toBe("v3 · In progress");
    expect(resolveContextStrip({ page: "creation", lifecycle: "idea", facts: { collaboratorCount: 0 } }).secondary).toBeNull();
  });

  it("Home is calm: the Creation in progress, one waiting idea, or ready to create — never counts", () => {
    expect(resolveContextStrip({ page: "home", facts: { continueTitle: "A Life in Moments" } }).primary?.text).toBe("A Life in Moments · In progress");
    expect(resolveContextStrip({ page: "home", facts: { ideasWaiting: 1 } }).primary?.text).toBe("1 idea waiting");
    expect(resolveContextStrip({ page: "home" }).primary?.text).toBe("Ready to create");
  });

  it("lists count, selection outranks count, and material shows kind and length", () => {
    expect(resolveContextStrip({ page: "materials", facts: { count: [64, "material", "materials"] } }).primary?.text).toBe("64 materials");
    expect(resolveContextStrip({ page: "materials", facts: { count: [64, "material", "materials"], selectedCount: 3 } }).primary?.text).toBe("3 selected");
    expect(resolveContextStrip({ page: "material", facts: { kindLabel: "Voice", durationSeconds: 134 } }).primary?.text).toBe("Voice · 02:14");
    expect(resolveContextStrip({ page: "material", facts: { kindLabel: "Voice", processing: "Transcribing…" } }).primary?.text).toBe("Transcribing…");
  });

  it("live Huddles carry a timer; approvals link out except on the Approval Center", () => {
    expect(resolveContextStrip({ page: "huddle", facts: { liveSince: "2026-09-27T10:00:00Z", participantCount: 4 } }).primary).toMatchObject({ text: "Live · 4 people", tone: "live", since: "2026-09-27T10:00:00Z" });
    expect(resolveContextStrip({ page: "home", facts: { pendingApprovalCount: 3 } }).primary).toMatchObject({ text: "3 approvals pending", href: "/approvals" });
    expect(resolveContextStrip({ page: "approvals", facts: { pendingApprovalCount: 1 } }).primary?.href).toBeUndefined();
    expect(resolveContextStrip({ page: null }).primary).toBeNull();
  });
});
