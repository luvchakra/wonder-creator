import { describe, expect, it } from "vitest";
import { autosaveLine } from "./use-autosave";

describe("autosaveLine", () => {
  it("says nothing until something happens, then where it stands", () => {
    expect(autosaveLine("idle")).toBe("");
    expect(autosaveLine("saving")).toBe("Saving…");
    expect(autosaveLine("saved")).toBe("Saved");
    expect(autosaveLine("error")).toMatch(/Couldn't save yet/);
  });
});
