import { describe, expect, it } from "vitest";
import { selectMediaProvider } from "./media";

describe("media provider", () => {
  it("is honestly unconfigured without credentials", async () => {
    const p = selectMediaProvider({});
    expect(p.configured).toBe(false);
    await expect(p.issueJoinToken({ huddleId: "h", creatorId: "c", displayName: "x", canPublish: true })).rejects.toThrow();
  });
  it("issues room-scoped LiveKit tokens when configured", async () => {
    const p = selectMediaProvider({ LIVEKIT_URL: "wss://example.livekit.cloud", LIVEKIT_API_KEY: "key", LIVEKIT_API_SECRET: "secret-secret-secret-secret-secret" });
    expect(p.configured).toBe(true);
    const t = await p.issueJoinToken({ huddleId: "abc", creatorId: "creator-1", displayName: "Maya", canPublish: true });
    const claims = JSON.parse(Buffer.from(t.token.split(".")[1], "base64url").toString());
    expect(claims.sub).toBe("creator-1");
    expect(claims.video.room).toBe("huddle_abc");
    expect(claims.video.roomJoin).toBe(true);
  });
});
