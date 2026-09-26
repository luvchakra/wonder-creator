import { describe, expect, it } from "vitest";
import { clampLevel, decideAutonomy, DEFAULT_AUTONOMY } from "./autonomy";

describe("autonomy", () => {
  it("rights, commerce and destructive actions can never auto-execute", () => {
    expect(clampLevel("rights", "auto_execute")).toBe("execute_with_approval");
    expect(decideAutonomy("destructive_actions", "auto_execute", "execute").outcome).toBe("needs_approval");
    expect(decideAutonomy("commerce", "auto_execute", "execute").outcome).toBe("needs_approval");
  });
  it("defaults: generation runs, transformation drafts, publishing asks, rights never", () => {
    expect(decideAutonomy("creative_generation", DEFAULT_AUTONOMY.creative_generation, "execute").outcome).toBe("allowed");
    expect(decideAutonomy("transformation", DEFAULT_AUTONOMY.transformation, "draft").outcome).toBe("allowed");
    expect(decideAutonomy("transformation", DEFAULT_AUTONOMY.transformation, "execute").outcome).toBe("needs_approval");
    expect(decideAutonomy("publishing", DEFAULT_AUTONOMY.publishing, "execute").outcome).toBe("needs_approval");
    expect(decideAutonomy("rights", DEFAULT_AUTONOMY.rights, "suggest").outcome).toBe("denied");
  });
  it("observe allows analysis only", () => {
    expect(decideAutonomy("research", "observe", "analyze").outcome).toBe("allowed");
    expect(decideAutonomy("research", "observe", "suggest").outcome).toBe("denied");
    expect(decideAutonomy("research", "observe", "execute").outcome).toBe("denied");
  });
  it("suggest cannot draft", () => {
    expect(decideAutonomy("creative_generation", "suggest", "draft").outcome).toBe("denied");
  });
});
