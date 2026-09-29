import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mediaLink, verifyMediaLink } from "./media-links";

const ID = "3f0b9f4e-2a55-4a37-9d8e-6b8f1f2a7c11";
const params = (link: string) => new URL(link, "http://x").searchParams;

describe("stable media links", () => {
  beforeEach(() => void (process.env.WONDERCREATOR_MEDIA_SECRET = "test-secret"));
  afterEach(() => void delete process.env.WONDERCREATOR_MEDIA_SECRET);

  it("is the same all day (so the browser caches it) and changes on another day", () => {
    const morning = Date.UTC(2026, 8, 29, 1);
    expect(mediaLink(ID, morning)).toBe(mediaLink(ID, Date.UTC(2026, 8, 29, 23)));
    expect(mediaLink(ID, morning)).not.toBe(mediaLink(ID, Date.UTC(2026, 8, 30, 1)));
  });

  it("verifies only for its own object and within its time", () => {
    const now = Date.UTC(2026, 8, 29, 12);
    const p = params(mediaLink(ID, now)!);
    expect(verifyMediaLink(ID, p.get("e"), p.get("s"), now)).toBeGreaterThan(86_400);
    expect(verifyMediaLink("00000000-0000-0000-0000-000000000000", p.get("e"), p.get("s"), now)).toBeNull();
    expect(verifyMediaLink(ID, p.get("e"), "x".repeat(32), now)).toBeNull();
    expect(verifyMediaLink(ID, String(Number(p.get("e")) + 5), p.get("s"), now)).toBeNull();
    expect(verifyMediaLink(ID, p.get("e"), p.get("s"), Date.UTC(2026, 9, 2, 1))).toBeNull();
  });

  it("isn't made without a server secret", () => {
    delete process.env.WONDERCREATOR_MEDIA_SECRET;
    const saved = [process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY];
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(mediaLink(ID)).toBeNull();
    if (saved[0] !== undefined) process.env.SUPABASE_SECRET_KEY = saved[0];
    if (saved[1] !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = saved[1];
  });
});
