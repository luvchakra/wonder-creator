import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

/**
 * Provider-neutral realtime media (SFU). Audio/video never pass through app servers:
 * the app only issues short-lived, room-scoped join tokens to verified participants.
 */
export interface MediaRoom {
  roomName: string;
}
export interface JoinToken {
  provider: string;
  url: string;
  token: string;
  expiresInSeconds: number;
}

export interface RealtimeMediaProvider {
  readonly name: string;
  readonly configured: boolean;
  createRoom(input: { huddleId: string }): Promise<MediaRoom>;
  issueJoinToken(input: { huddleId: string; creatorId: string; displayName: string; canPublish: boolean }): Promise<JoinToken>;
  endRoom(input: { huddleId: string }): Promise<void>;
  /** Disconnect one creator from the room now (removal or leaving); their token can't rejoin once they're not a participant. */
  evictParticipant(input: { huddleId: string; creatorId: string }): Promise<void>;
}

/**
 * Join tokens only need to outlive the connect handshake: LiveKit refreshes an active connection itself.
 * Keeping them short limits what a token leaked or kept after removal could do.
 */
export const JOIN_TOKEN_TTL_SECONDS = 5 * 60;

export const roomNameFor = (huddleId: string) => `huddle_${huddleId}`;

class LiveKitProvider implements RealtimeMediaProvider {
  readonly name = "livekit";
  readonly configured = true;
  constructor(
    private url: string,
    private apiKey: string,
    private apiSecret: string,
  ) {}

  async createRoom({ huddleId }: { huddleId: string }) {
    const svc = new RoomServiceClient(this.url.replace(/^wss?:/, "https:"), this.apiKey, this.apiSecret);
    const room = await svc.createRoom({ name: roomNameFor(huddleId), emptyTimeout: 120, maxParticipants: 16 });
    return { roomName: room.name };
  }

  async issueJoinToken(input: { huddleId: string; creatorId: string; displayName: string; canPublish: boolean }) {
    const ttl = JOIN_TOKEN_TTL_SECONDS;
    const at = new AccessToken(this.apiKey, this.apiSecret, { identity: input.creatorId, name: input.displayName, ttl });
    at.addGrant({ roomJoin: true, room: roomNameFor(input.huddleId), canPublish: input.canPublish, canSubscribe: true, canPublishData: true });
    return { provider: this.name, url: this.url, token: await at.toJwt(), expiresInSeconds: ttl };
  }

  async endRoom({ huddleId }: { huddleId: string }) {
    const svc = new RoomServiceClient(this.url.replace(/^wss?:/, "https:"), this.apiKey, this.apiSecret);
    await svc.deleteRoom(roomNameFor(huddleId)).catch(() => undefined);
  }

  async evictParticipant({ huddleId, creatorId }: { huddleId: string; creatorId: string }) {
    const svc = new RoomServiceClient(this.url.replace(/^wss?:/, "https:"), this.apiKey, this.apiSecret);
    // Not connected (or room already gone) is fine: there is nothing to evict.
    await svc.removeParticipant(roomNameFor(huddleId), creatorId).catch(() => undefined);
  }
}

/** No media provider configured: text chat still works; audio/video honestly unavailable. */
class UnconfiguredMediaProvider implements RealtimeMediaProvider {
  readonly name = "none";
  readonly configured = false;
  async createRoom({ huddleId }: { huddleId: string }) {
    return { roomName: roomNameFor(huddleId) };
  }
  async issueJoinToken(): Promise<JoinToken> {
    throw new Error("media provider not configured");
  }
  async endRoom() {}
  async evictParticipant() {}
}

export function selectMediaProvider(env: Record<string, string | undefined> = process.env): RealtimeMediaProvider {
  if (env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET) {
    return new LiveKitProvider(env.LIVEKIT_URL, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
  }
  return new UnconfiguredMediaProvider();
}
