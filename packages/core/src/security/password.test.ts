import { describe, expect, it } from "vitest";
import { passwordProblem } from "./password";

describe("password policy", () => {
  it("asks for length, letters and numbers, and refuses the obvious", () => {
    expect(passwordProblem("short1")).toMatch(/10 characters/);
    expect(passwordProblem("onlyletterslong")).toMatch(/letters and numbers/);
    expect(passwordProblem("1234567890123")).toMatch(/letters and numbers/);
    expect(passwordProblem("Password123")).toMatch(/too common/);
    expect(passwordProblem("maya.writes2026", { email: "maya.writes@example.com" })).toMatch(/email/);
    expect(passwordProblem("quiet harbour lamps 42")).toBeNull();
    expect(passwordProblem("x".repeat(129) + "1")).toMatch(/at most/);
  });
});
