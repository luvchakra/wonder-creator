import { beforeEach, describe, expect, it } from "vitest";

// The trail lives in sessionStorage; a tiny in-memory one stands in for the browser's.
const store = new Map<string, string>();
Object.assign(globalThis, {
  sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  window: Object.assign(new EventTarget(), { location: { pathname: "/", search: "" } }),
});

const { syncCurrentQuery, trailSnapshot, trailTarget } = await import("./nav-memory");
const trail = () => JSON.parse(trailSnapshot()) as Array<{ p: string; t?: string }>;
const seed = (list: Array<{ p: string; t?: string }>) => store.set("wc.nav.trail", JSON.stringify(list));

describe("Back keeps the list as it was left (back-navigation.md)", () => {
  beforeEach(() => store.clear());

  it("follows filter changes on the current page, so Back from a Material returns to the filtered Library", () => {
    seed([{ p: "/" }, { p: "/materials?tab=ideas", t: "Materials" }]);
    syncCurrentQuery("/materials?tab=ideas&type=images&q=tide");
    expect(trail()).toEqual([{ p: "/" }, { p: "/materials?tab=ideas&type=images&q=tide", t: "Materials" }]);
    // Then a Material opens; its Back goes to the Library with those filters.
    seed([...trail(), { p: "/materials/0f8e8a3c-5b1e-4c55-9d7a-1f2a3b4c5d6e" }]);
    expect(trailTarget(trailSnapshot(), "/materials/0f8e8a3c-5b1e-4c55-9d7a-1f2a3b4c5d6e")?.p).toBe("/materials?tab=ideas&type=images&q=tide");
  });

  it("never rewrites an earlier page, and does nothing once the page has changed", () => {
    seed([{ p: "/materials?tab=ideas" }, { p: "/rooms" }]);
    syncCurrentQuery("/materials?tab=shared");
    expect(trail()).toEqual([{ p: "/materials?tab=ideas" }, { p: "/rooms" }]);
    syncCurrentQuery("/rooms");
    expect(trail()).toEqual([{ p: "/materials?tab=ideas" }, { p: "/rooms" }]);
  });
});
