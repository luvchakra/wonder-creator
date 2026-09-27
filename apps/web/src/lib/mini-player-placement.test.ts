import { describe, expect, it } from "vitest";
import { placeClear } from "./mini-player-placement";

const panel = { top: 330, bottom: 510, left: 60, right: 380 }; // a 320×180 panel centred on a 390×844 screen
const bounds = { min: 80, max: 696 };

describe("placeClear", () => {
  it("stays put when nothing important is underneath", () => {
    expect(placeClear(panel, [{ top: 600, bottom: 640, left: 16, right: 200 }], bounds)).toBe(0);
    // Something beside it (not under it) doesn't count.
    expect(placeClear({ ...panel, left: 200 }, [{ top: 400, bottom: 440, left: 16, right: 150 }], bounds)).toBe(0);
  });

  it("moves the shortest distance clear of a primary action, up or down", () => {
    const cta = { top: 410, bottom: 450, left: 32, right: 180 };
    const dy = placeClear(panel, [cta], bounds)!;
    expect(Math.abs(dy)).toBeLessThanOrEqual(130);
    const moved = { top: panel.top + dy, bottom: panel.bottom + dy };
    expect(moved.bottom <= cta.top - 8 || moved.top >= cta.bottom + 8).toBe(true);
    expect(moved.top).toBeGreaterThanOrEqual(bounds.min);
    expect(moved.bottom).toBeLessThanOrEqual(bounds.max);
  });

  it("gives up (null) when no position within the bounds is clear", () => {
    const wall = { top: 80, bottom: 696, left: 0, right: 390 };
    expect(placeClear(panel, [wall], bounds)).toBeNull();
  });
});
