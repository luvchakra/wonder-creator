import { describe, expect, it } from "vitest";
import { createMemoryRateLimiter } from "./rate-limit";

describe("rate limiter", () => {
  it("allows up to the limit then throws, and resets after the window", () => {
    let t = 0;
    const rl = createMemoryRateLimiter(() => t);
    rl.check("k", 2, 1000);
    rl.check("k", 2, 1000);
    expect(() => rl.check("k", 2, 1000)).toThrow(/little fast/);
    t = 1001;
    expect(() => rl.check("k", 2, 1000)).not.toThrow();
  });
});
