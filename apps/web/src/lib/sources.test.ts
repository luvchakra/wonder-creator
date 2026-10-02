import { afterEach, describe, expect, it, vi } from "vitest";
import { connectors, googleClient, openOAuth, sealOAuth, sourcesAiOn, sourcesHomeOn } from "./sources";

afterEach(() => vi.unstubAllEnvs());

describe("Personal Sources app wiring", () => {
  it("offers Gmail only when its own OAuth client is configured (never borrowed from sign-in)", () => {
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "");
    vi.stubEnv("SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID", "sign-in-client");
    expect(googleClient()).toBeNull();
    expect(Object.keys(connectors())).toEqual(["native_notes"]);
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "cid");
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "secret");
    expect(Object.keys(connectors()).sort()).toEqual(["gmail", "google_calendar", "native_notes"]);
  });

  it("kill switches turn off one provider or the AI without touching the rest", () => {
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "cid");
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "secret");
    vi.stubEnv("WONDERCREATOR_SOURCES_DISABLED", "gmail");
    expect(Object.keys(connectors()).sort()).toEqual(["google_calendar", "native_notes"]);
    vi.stubEnv("WONDERCREATOR_SOURCES_AI", "off");
    vi.stubEnv("WONDERCREATOR_SOURCES_HOME", "OFF");
    expect(sourcesAiOn()).toBe(false);
    expect(sourcesHomeOn()).toBe(false);
  });

  it("seals the consent state so the PKCE verifier can't be read or altered in the browser", () => {
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "secret");
    const v = { state: "s", verifier: "verifier-123", creatorId: "c", provider: "gmail" as const, at: 1 };
    const sealed = sealOAuth(v);
    expect(sealed).not.toContain("verifier-123");
    expect(openOAuth(sealed)).toEqual(v);
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");
    expect(openOAuth(tampered)).toBeNull();
    expect(openOAuth(undefined)).toBeNull();
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "rotated");
    expect(openOAuth(sealed)).toBeNull();
  });
});
