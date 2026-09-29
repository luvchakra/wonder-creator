import { describe, expect, it } from "vitest";
import { flagsForStage } from "./flags";

describe("rollout flags (Phase 05 §19–20)", () => {
  it("each stage turns on its own flags and every earlier one", () => {
    const a = flagsForStage("A");
    expect(a.moments_enabled && a.dejavu_enabled && a.home_orchestration_enabled).toBe(true);
    expect(a.community_enabled || a.ask_community_enabled || a.semantic_connections_enabled).toBe(false);
    const c = flagsForStage("C");
    expect(c.community_enabled && c.ask_community_enabled && c.external_image_sources_enabled).toBe(true);
    expect(c.conversation_summaries_enabled).toBe(false);
    expect(Object.values(flagsForStage("E")).every(Boolean)).toBe(true);
  });
  it("a single flag can be forced either way", () => {
    expect(flagsForStage("E", { ask_community_enabled: false }).ask_community_enabled).toBe(false);
    expect(flagsForStage("A", { semantic_connections_enabled: true }).semantic_connections_enabled).toBe(true);
  });
});
