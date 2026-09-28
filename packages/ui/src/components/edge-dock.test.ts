import { describe, expect, it } from "vitest";
import { settleDock } from "./edge-dock";

const base = { vw: 390, min: 100, max: 800, h: 60 };

describe("settleDock", () => {
  it("snaps to the nearer edge at the height it was dropped", () => {
    expect(settleDock({ x: 120, y: 400 }, base)).toEqual({ side: "left", y: 400 });
    expect(settleDock({ x: 300, y: 400 }, base)).toEqual({ side: "right", y: 400 });
  });

  it("keeps the centre within bounds", () => {
    expect(settleDock({ x: 10, y: 20 }, base)).toEqual({ side: "left", y: 100 });
    expect(settleDock({ x: 380, y: 2000 }, base)).toEqual({ side: "right", y: 800 });
  });

  it("keeps clear of another control on the same edge, moving to the closer free spot", () => {
    const others = [{ side: "right" as const, y: 400, h: 104 }];
    // Needs (60 + 104) / 2 + 72 = 154px between centres.
    expect(settleDock({ x: 380, y: 420 }, { ...base, others })).toEqual({ side: "right", y: 554 });
    expect(settleDock({ x: 380, y: 380 }, { ...base, others })).toEqual({ side: "right", y: 246 });
    // The other edge is free.
    expect(settleDock({ x: 10, y: 400 }, { ...base, others })).toEqual({ side: "left", y: 400 });
  });

  it("uses the other edge when there's no room on the chosen one", () => {
    const others = [{ side: "right" as const, y: 450, h: 104 }];
    expect(settleDock({ x: 380, y: 450 }, { ...base, min: 400, max: 500, others })).toEqual({ side: "left", y: 450 });
  });
});
