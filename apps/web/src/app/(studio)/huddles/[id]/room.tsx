"use client";
import { formatElapsed, HEARTBEAT_MS, participantLine, viewState } from "@wonder/creator-huddle/lifecycle";
import {
  Avatar,
  AvatarStack,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  Field,
  IconButton,
  LiveBadge,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Select,
  Textarea,
  buttonClasses,
  cn,
} from "@wonder/ui";
import { Bookmark, Flag, MessageCircle, Mic, MicOff, MoreHorizontal, PhoneOff, Send, Users, Video, VideoOff, X } from "lucide-react";
import type { Room as LkRoom, Track } from "livekit-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNow } from "@/components/client-time";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import { createClient } from "@/lib/supabase/client";

interface CreatorLite {
  id: string;
  display_name: string;
  handle: string | null;
}
interface RoomState {
  huddle: { id: string; status: string; topic: string | null; started_at: string } | null;
  me: { role: string; status: string } | null;
  myPendingRequestId: string | null;
  participants: Array<{ creator_id: string; role: string; status: string; audio_on: boolean; video_on: boolean; discipline: string | null; creators: CreatorLite | null }>;
  requests: Array<{ id: string; requester_creator_id: string; message: string | null; created_at: string; discipline: string | null; creators: CreatorLite | null }>;
  messages: Array<{ id: string; creator_id: string; body: string; created_at: string }>;
  media: { configured: boolean };
}

export function HuddleRoom({
  huddleId,
  me,
  initial,
  card,
  avatars,
}: {
  huddleId: string;
  me: { id: string; name: string };
  initial: RoomState;
  card: { topic: string | null; participantCount: number; participantNames: string[]; startedAt: string; viewerState: string } | null;
  avatars: Record<string, string>;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [publicCard, setPublicCard] = useState(card);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestMsg, setRequestMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [audio, setAudio] = useState(false);
  const [video, setVideo] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const now = useNow();
  const [preserveText, setPreserveText] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [mediaNote, setMediaNote] = useState<string | null>(null);
  const [remoteTracks, setRemoteTracks] = useState<Record<string, Track>>({});
  const roomRef = useRef<LkRoom | null>(null);

  const status = viewState({
    status: (state.huddle?.status as "live" | "dissolving" | "dissolved" | undefined) ?? (publicCard ? "live" : null),
    myParticipantStatus: (state.me?.status as "joining" | "joined" | undefined) ?? null,
    myPendingRequest: !!state.myPendingRequestId,
    leaving,
  });

  const refresh = useCallback(async () => {
    try {
      const s = await api<RoomState>(`/api/v1/huddles/${huddleId}`);
      setState(s);
      if (!s.me) {
        const cards = await api<{ huddles: Array<{ huddleId: string; topic: string | null; participantCount: number; participantNames: string[]; startedAt: string; viewerState: string }> }>("/api/v1/huddles");
        setPublicCard(cards.huddles.find((h) => h.huddleId === huddleId) ?? null);
      }
    } catch {
      /* transient; the next poll retries (UI tolerates stale presence) */
    }
  }, [huddleId]);

  // Presence: realtime change feed (RLS-scoped) + polling fallback.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`huddle:${huddleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "huddle_participants", filter: `huddle_id=eq.${huddleId}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "huddle_join_requests", filter: `huddle_id=eq.${huddleId}` }, () => refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "huddle_messages", filter: `huddle_id=eq.${huddleId}` }, () => refresh())
      .subscribe();
    const poll = setInterval(refresh, state.me?.status === "joined" ? 4000 : 6000);
    return () => {
      void supabase.removeChannel(ch);
      clearInterval(poll);
    };
  }, [huddleId, refresh, state.me?.status]);

  // Heartbeat while joined; detects dissolution and removal.
  useEffect(() => {
    if (state.me?.status !== "joined") return;
    const beat = async () => {
      try {
        const r = await api<{ status: string }>(`/api/v1/huddles/${huddleId}/heartbeat`, { method: "POST", json: { audio, video } });
        if (r.status !== "live") void refresh();
      } catch {
        /* offline: presence will go stale server-side; reconnect resumes */
      }
    };
    void beat();
    const t = setInterval(beat, HEARTBEAT_MS);
    const onVisible = () => document.visibilityState === "visible" && beat();
    window.addEventListener("online", beat);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", beat);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [huddleId, state.me?.status, audio, video, refresh]);

  // Media plane (SFU) — only when a provider is configured and I'm joined.
  useEffect(() => {
    if (state.me?.status !== "joined" || !state.media.configured) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await api<{ url: string; token: string }>(`/api/v1/huddles/${huddleId}/media-token`, { method: "POST" });
        const { Room, RoomEvent } = await import("livekit-client");
        const room = new Room({ adaptiveStream: true, dynacast: true });
        room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (track.kind === "video") setRemoteTracks((t) => ({ ...t, [participant.identity]: track }));
          if (track.kind === "audio") {
            const el = track.attach();
            el.dataset.lk = participant.identity;
            document.body.appendChild(el);
          }
        });
        room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
          track.detach().forEach((el) => el.remove());
          if (track.kind === "video") setRemoteTracks((t) => Object.fromEntries(Object.entries(t).filter(([k]) => k !== participant.identity)));
        });
        room.on(RoomEvent.Reconnecting, () => setMediaNote("Reconnecting audio and video…"));
        room.on(RoomEvent.Reconnected, () => setMediaNote(null));
        room.on(RoomEvent.Disconnected, () => setMediaNote("Audio and video disconnected."));
        await room.connect(token.url, token.token);
        if (cancelled) return void room.disconnect();
        roomRef.current = room;
      } catch (e) {
        setMediaNote(errorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
      void roomRef.current?.disconnect();
      roomRef.current = null;
      document.querySelectorAll("audio[data-lk]").forEach((el) => el.remove());
    };
  }, [huddleId, state.me?.status, state.media.configured]);

  async function toggleAudio() {
    if (!state.media.configured) return;
    const next = !audio;
    try {
      await roomRef.current?.localParticipant.setMicrophoneEnabled(next);
      setAudio(next);
    } catch {
      setMediaNote("We couldn't access your microphone.");
    }
  }
  async function toggleVideo() {
    if (!state.media.configured) return;
    const next = !video;
    try {
      await roomRef.current?.localParticipant.setCameraEnabled(next);
      setVideo(next);
    } catch {
      setMediaNote("We couldn't access your camera.");
    }
  }

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function leave() {
    setLeaving(true);
    try {
      await roomRef.current?.disconnect();
      await api(`/api/v1/huddles/${huddleId}/leave`, { method: "POST" });
      router.push("/huddles");
      router.refresh();
    } catch (e) {
      setLeaving(false);
      setError(errorMessage(e));
    }
  }

  const nameOf = (id: string) => state.participants.find((p) => p.creator_id === id)?.creators?.display_name ?? (id === me.id ? me.name : "Creator");

  // ---------------------------------------------------------------- not inside
  if (status === "dissolved" || status === "dissolving") {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-border-soft bg-surface p-8 text-center">
        <h1 className="font-display text-3xl text-ink">{state.huddle ? "This Huddle has ended" : "This Huddle has ended or isn't available to you"}</h1>
        <p className="mt-2 text-ink-muted">Huddles are temporary. When everyone leaves, the conversation dissolves — anything someone saved lives on as their material.</p>
        <Link href="/huddles" className={buttonClasses({ className: "mt-6" })}>
          See who&apos;s live
        </Link>
      </div>
    );
  }

  if (status !== "joined" && status !== "leaving") {
    const names = publicCard?.participantNames ?? [];
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-border-soft bg-surface p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <LiveBadge />
          <span className="inline-flex items-center gap-1 text-sm text-ink-subtle">
            <Users className="size-4" aria-hidden /> {publicCard?.participantCount ?? 0} creators
          </span>
        </div>
        <div className="mt-4">
          <AvatarStack people={names.map((n) => ({ name: n }))} size={40} />
        </div>
        <h1 className="mt-3 font-display text-3xl text-ink">{participantLine(names, publicCard?.participantCount ?? 0) || "A live Huddle"}</h1>
        <p className="mt-1 text-ink-muted">{publicCard?.topic ? `Talking about ${publicCard.topic}` : "An open conversation"}</p>
        {publicCard && now ? <p className="mt-1 text-sm text-ink-subtle">Live for {formatElapsed(publicCard.startedAt, now)}</p> : null}

        {status === "approved" ? (
          <div className="mt-6 rounded-2xl bg-success-soft p-4">
            <p className="font-medium text-ink">You&apos;ve been let in.</p>
            <Button className="mt-3" loading={busy === "enter"} onClick={() => act("enter", () => api(`/api/v1/huddles/${huddleId}/enter`, { method: "POST" }))}>
              Enter Huddle
            </Button>
          </div>
        ) : status === "join_request_pending" ? (
          <div className="mt-6 rounded-2xl bg-accent-softer p-4" role="status">
            <p className="font-medium text-ink">Request sent — waiting for someone inside to accept.</p>
            <Button variant="ghost" size="sm" className="mt-2" loading={busy === "cancel"} onClick={() => act("cancel", () => api(`/api/v1/huddles/${huddleId}/join`, { method: "DELETE", json: { requestId: state.myPendingRequestId } }))}>
              Cancel request
            </Button>
          </div>
        ) : publicCard ? (
          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void act("request", () => api(`/api/v1/huddles/${huddleId}/join`, { method: "POST", json: { message: requestMsg || undefined } }));
            }}
          >
            <Field label="Say hello (optional)" htmlFor="req-msg">
              <Textarea id="req-msg" value={requestMsg} onChange={(e) => setRequestMsg(e.target.value.slice(0, 280))} placeholder="I'm working on a documentary and would love to listen in." />
            </Field>
            <Button type="submit" loading={busy === "request"}>
              Request to Join
            </Button>
            <p className="text-xs text-ink-subtle">Someone already in the Huddle approves each request. Only public details are shown until you&apos;re in.</p>
          </form>
        ) : (
          <p className="mt-6 text-ink-muted">This Huddle isn&apos;t available to you.</p>
        )}
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  // ---------------------------------------------------------------- inside
  const isHost = state.me?.role === "host";
  const joined = state.participants.filter((p) => p.status === "joined");
  return (
    <div className="-mx-4 sm:mx-0">
      <div className="overflow-hidden bg-stage text-white sm:rounded-3xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
          <LiveBadge />
          <span className="font-mono text-sm tabular-nums text-white/80" aria-label="Elapsed time">
            {state.huddle && now ? formatElapsed(state.huddle.started_at, now) : ""}
          </span>
          <h1 className="min-w-0 flex-1 truncate text-[15px] font-medium">{state.huddle?.topic ? `Talking about ${state.huddle.topic}` : "Open conversation"}</h1>
          <span className="inline-flex items-center gap-1 text-sm text-white/80">
            <Users className="size-4" aria-hidden /> {joined.length}
          </span>
        </header>
        <div className={cn("grid gap-0 lg:grid-cols-[1fr_320px]", !chatOpen && "lg:grid-cols-1")}>
          <section aria-label="Participants" className="p-3 sm:p-4">
            {!state.media.configured ? (
              <p className="mb-3 rounded-xl bg-white/10 px-3 py-2 text-sm text-white/85">Voice and video aren&apos;t connected in this environment yet. Text chat is live.</p>
            ) : mediaNote ? (
              <p className="mb-3 rounded-xl bg-white/10 px-3 py-2 text-sm text-white/85" role="status">
                {mediaNote}
              </p>
            ) : null}
            <ul className={cn("grid gap-3", joined.length <= 1 ? "grid-cols-1" : joined.length <= 4 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3")}>
              {joined.map((p) => {
                const name = p.creators?.display_name ?? "Creator";
                const track = remoteTracks[p.creator_id];
                return (
                  <li key={p.creator_id} className="relative aspect-video overflow-hidden rounded-2xl bg-white/5">
                    {track ? <VideoTile track={track} /> : <div className="flex size-full items-center justify-center"><Avatar name={name} src={avatars[p.creator_id]} size={72} /></div>}
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6">
                      <span>
                        <span className="block text-sm font-medium">
                          {name}
                          {p.creator_id === me.id ? " (you)" : ""}
                        </span>
                        <span className="block text-xs text-white/75">{p.role === "host" ? "Host" : p.discipline ?? "Creator"}</span>
                      </span>
                      <span className="flex gap-1" aria-label={`${p.audio_on ? "Mic on" : "Mic off"}, ${p.video_on ? "camera on" : "camera off"}`}>
                        {p.audio_on ? <Mic className="size-4" aria-hidden /> : <MicOff className="size-4 text-white/60" aria-hidden />}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            {state.requests.length ? (
              <section aria-label="Join requests" className="mt-4 rounded-2xl bg-white/10 p-3">
                <h2 className="mb-2 text-sm font-semibold">Join requests ({state.requests.length})</h2>
                <ul className="space-y-2">
                  {state.requests.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white/5 p-2">
                      <Avatar name={r.creators?.display_name ?? "Creator"} src={avatars[r.requester_creator_id]} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{r.creators?.display_name ?? "Creator"}</p>
                        <p className="truncate text-xs text-white/75">{[r.discipline, r.message].filter(Boolean).join(" · ") || "Would like to join"}</p>
                      </div>
                      <Button size="sm" className="bg-mint text-navy hover:bg-mint/90" loading={busy === `a${r.id}`} onClick={() => act(`a${r.id}`, () => api(`/api/v1/huddles/requests/${r.id}`, { method: "POST", json: { approve: true } }))}>
                        Accept
                      </Button>
                      <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" loading={busy === `d${r.id}`} onClick={() => act(`d${r.id}`, () => api(`/api/v1/huddles/requests/${r.id}`, { method: "POST", json: { approve: false } }))}>
                        Decline
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </section>

          {chatOpen ? (
            <Chat
              huddleId={huddleId}
              me={me.id}
              messages={state.messages}
              nameOf={nameOf}
              onSent={refresh}
              onPreserve={(text) => setPreserveText(text)}
              onClose={() => setChatOpen(false)}
            />
          ) : null}
        </div>

        <footer className="flex items-center justify-center gap-2 border-t border-white/10 px-3 py-3 sm:gap-3">
          <ControlButton label={audio ? "Mute" : "Unmute"} active={audio} disabled={!state.media.configured} onClick={toggleAudio}>
            {audio ? <Mic className="size-5" aria-hidden /> : <MicOff className="size-5" aria-hidden />}
          </ControlButton>
          <ControlButton label={video ? "Stop video" : "Start video"} active={video} disabled={!state.media.configured} onClick={toggleVideo}>
            {video ? <Video className="size-5" aria-hidden /> : <VideoOff className="size-5" aria-hidden />}
          </ControlButton>
          <ControlButton label={chatOpen ? "Hide chat" : "Chat"} active={chatOpen} onClick={() => setChatOpen((c) => !c)}>
            <MessageCircle className="size-5" aria-hidden />
          </ControlButton>
          <ControlButton label="Save an idea" onClick={() => setPreserveText("")}>
            <Bookmark className="size-5" aria-hidden />
          </ControlButton>
          <Menu>
            <MenuTrigger className="flex min-h-12 min-w-12 flex-col items-center justify-center rounded-2xl text-xs text-white/85 hover:bg-white/10" aria-label="More">
              <MoreHorizontal className="size-5" aria-hidden />
              <span className="hidden sm:block">More</span>
            </MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={() => setReportOpen(true)}>
                <Flag className="size-4" aria-hidden /> Report a problem
              </MenuItem>
              {isHost ? (
                <MenuItem destructive onSelect={() => setConfirmEnd(true)}>
                  <X className="size-4" aria-hidden /> End Huddle for everyone
                </MenuItem>
              ) : null}
            </MenuContent>
          </Menu>
          <Button variant="danger" className="ml-2" loading={leaving} onClick={leave}>
            <PhoneOff className="size-4" aria-hidden /> Leave
          </Button>
        </footer>
      </div>
      {error ? (
        <p role="alert" className="mt-3 px-4 text-sm text-danger sm:px-0">
          {error}
        </p>
      ) : null}
      <p className="mt-3 px-4 text-sm text-ink-muted sm:px-0">
        This Huddle is temporary. When the last person leaves, the chat disappears. Save anything worth keeping — it becomes your Creative Material.
      </p>

      <PreserveDialog key={preserveText === null ? "closed" : `open:${preserveText}`} huddleId={huddleId} text={preserveText} onClose={() => setPreserveText(null)} />
      <ReportDialog huddleId={huddleId} open={reportOpen} onOpenChange={setReportOpen} participants={joined.filter((p) => p.creator_id !== me.id).map((p) => ({ id: p.creator_id, name: p.creators?.display_name ?? "Creator" }))} />
      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        destructive
        title="End this Huddle for everyone?"
        body="Everyone will be disconnected and the chat will disappear. Saved material stays with whoever saved it."
        confirmLabel="End Huddle"
        onConfirm={() =>
          act("end", async () => {
            await api(`/api/v1/huddles/${huddleId}/end`, { method: "POST" });
            router.push("/huddles");
          })
        }
      />
    </div>
  );
}

function ControlButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={disabled ? "Not available in this environment" : label}
      className={cn("flex min-h-12 min-w-12 flex-col items-center justify-center rounded-2xl px-2 text-xs text-white/85 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent", active && "bg-white/15")}
    >
      {children}
      <span className="hidden sm:block">{label}</span>
    </button>
  );
}

function VideoTile({ track }: { track: Track }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  return <video ref={ref} className="size-full object-cover" autoPlay playsInline muted />;
}

function Chat({
  huddleId,
  me,
  messages,
  nameOf,
  onSent,
  onPreserve,
  onClose,
}: {
  huddleId: string;
  me: string;
  messages: RoomState["messages"];
  nameOf: (id: string) => string;
  onSent: () => Promise<void>;
  onPreserve: (t: string) => void;
  onClose: () => void;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [messages.length]);
  return (
    <section aria-label="Chat" className="flex max-h-[28rem] flex-col border-t border-white/10 bg-white/[0.03] lg:max-h-none lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between px-4 py-2">
        <h2 className="text-sm font-semibold">Chat</h2>
        <IconButton label="Hide chat" variant="stage" onClick={onClose} className="size-9">
          <X className="size-4" aria-hidden />
        </IconButton>
      </div>
      <ol className="flex-1 space-y-2 overflow-y-auto px-4 pb-2" aria-live="polite">
        {messages.length ? (
          messages.map((m) => (
            <li key={m.id} className="group text-sm">
              <span className="font-medium text-white">{m.creator_id === me ? "You" : nameOf(m.creator_id)}</span>{" "}
              <span className="whitespace-pre-wrap break-words text-white/85">{m.body}</span>
              <button type="button" onClick={() => onPreserve(m.body)} className="ml-1 text-xs text-lavender underline-offset-2 hover:underline">
                Save as idea
              </button>
            </li>
          ))
        ) : (
          <li className="text-sm text-white/60">No messages yet. Say hello.</li>
        )}
        <div ref={endRef} />
      </ol>
      <form
        className="flex gap-2 border-t border-white/10 p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim()) return;
          setSending(true);
          setError(null);
          try {
            await api(`/api/v1/huddles/${huddleId}/messages`, { method: "POST", json: { body } });
            setBody("");
            await onSent();
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setSending(false);
          }
        }}
      >
        <label htmlFor="huddle-msg" className="sr-only">
          Message
        </label>
        <input id="huddle-msg" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Message everyone…" className="h-11 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-lavender" />
        <IconButton label="Send message" type="submit" variant="stage" disabled={sending || !body.trim()}>
          <Send className="size-4" aria-hidden />
        </IconButton>
      </form>
      {error ? <p className="px-3 pb-2 text-xs text-pink">{error}</p> : null}
    </section>
  );
}

function PreserveDialog({ huddleId, text, onClose }: { huddleId: string; text: string | null; onClose: () => void }) {
  const [value, setValue] = useState(text ?? "");
  const [kind, setKind] = useState<"idea" | "material">("idea");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={text !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Save from this Huddle" description="It becomes your Creative Material and stays after the Huddle ends. The Huddle itself isn't recorded.">
        {saved ? (
          <div className="space-y-3">
            <p className="text-ink">Saved to your Creative Space.</p>
            <div className="flex gap-2">
              <Link href={`/space/materials/${saved}`} className={buttonClasses({ size: "sm", variant: "secondary" })}>
                View it
              </Link>
              <Button size="sm" variant="ghost" onClick={onClose}>
                Back to Huddle
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const r = await api<{ material: { id: string } }>(`/api/v1/huddles/${huddleId}/preserve`, { method: "POST", json: { kind, text: value } });
                setSaved(r.material.id);
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="What do you want to keep?" htmlFor="preserve-text" error={error}>
              <Textarea id="preserve-text" value={value} onChange={(e) => setValue(e.target.value)} placeholder="The idea about the lighthouse scene…" />
            </Field>
            <Field label="Save as" htmlFor="preserve-kind">
              <Select id="preserve-kind" value={kind} onChange={(e) => setKind(e.target.value as "idea")}>
                <option value="idea">Idea</option>
                <option value="material">Note (Creative Material)</option>
              </Select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={!value.trim()}>
                Save
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReportDialog({ huddleId, open, onOpenChange, participants }: { huddleId: string; open: boolean; onOpenChange: (o: boolean) => void; participants: Array<{ id: string; name: string }> }) {
  const [who, setWho] = useState("");
  const [reason, setReason] = useState("harassment");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Report a problem" description="Reports are kept for safety review, even after the Huddle ends. You can also leave at any time.">
        {done ? (
          <p className="text-ink">Thank you. We&apos;ll review this. You can leave the Huddle any time.</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api(`/api/v1/huddles/${huddleId}/report`, { method: "POST", json: { reportedCreatorId: who || null, reason, details } });
                setDone(true);
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
          >
            <Field label="Who is this about? (optional)" htmlFor="rep-who">
              <Select id="rep-who" value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="">The Huddle in general</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reason" htmlFor="rep-reason">
              <Select id="rep-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                {["harassment", "hate", "spam", "sexual", "violence", "impersonation", "other"].map((r) => (
                  <option key={r} value={r}>
                    {r[0].toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Details (optional)" htmlFor="rep-details" error={error}>
              <Textarea id="rep-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Send report</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

