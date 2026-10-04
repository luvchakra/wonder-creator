import { ORNAMENT_KEYS } from "@wonder/creator-studio/pages";
import { ORNAMENTS } from "@wonder/ui";
import { describe, expect, it } from "vitest";

describe("writing ornaments", () => {
  it("stores exactly the ornaments the UI can draw", () => {
    expect([...ORNAMENT_KEYS]).toEqual([...ORNAMENTS]);
  });
});
