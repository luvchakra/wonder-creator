import { describe, expect, it } from "vitest";
import { relativeTime } from "./util";

describe("relativeTime", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  const at = (s: number) => new Date(now.getTime() + s * 1000).toISOString();
  it("describes past and future times", () => {
    expect(relativeTime(at(-10), now)).toBe("just now");
    expect(relativeTime(at(-600), now)).toBe("10 min ago");
    expect(relativeTime(at(600), now)).toBe("in 10 min");
    expect(relativeTime(at(3600), now)).toBe("in 1 hour");
    expect(relativeTime(at(5 * 3600), now)).toBe("in 5 hours");
    expect(relativeTime(at(7 * 86400), now)).toBe("in 7 days");
  });
});
