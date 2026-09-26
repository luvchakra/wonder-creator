import { describe, expect, it } from "vitest";
import { incomingPath, isOwnIncomingPath } from "./intake";

const me = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";

describe("direct upload paths", () => {
  it("accepts only the caller's own incoming folder", () => {
    const p = incomingPath(me);
    expect(isOwnIncomingPath(me, p)).toBe(true);
    expect(isOwnIncomingPath(other, p)).toBe(false);
    expect(isOwnIncomingPath(me, `${me}/incoming/../${other}/x`)).toBe(false);
    expect(isOwnIncomingPath(me, `${me}/avatar-123`)).toBe(false);
  });
});
