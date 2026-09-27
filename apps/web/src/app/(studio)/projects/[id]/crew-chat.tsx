"use client";
import { Button, Menu, MenuContent, MenuItem, MenuTrigger, SectionHeader, cn } from "@wonder/ui";
import { MoreHorizontal, Paperclip, Tag, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RelativeTime } from "@/components/client-time";
import { MessageComposer } from "@/components/message-composer";
import { api, errorMessage } from "@/lib/client";

export interface ChatMessage {
  id: string;
  body: string;
  at: string;
  author: { id: string | null; name: string };
  itemId: string | null;
  context: { kind: string; id: string; label: string; href: string | null } | null;
  huddleId: string | null;
  draftedByAi: boolean;
  mine: boolean;
}

const POLL_MS = 10_000;

/** The crew's durable conversation. New messages arrive by polling while the page is visible. */
export function CrewChat({
  crewId,
  projectId,
  viewerId,
  canModerate,
  initial,
  shared,
  contexts = [],
}: {
  crewId: string;
  projectId: string;
  viewerId: string;
  canModerate: boolean;
  initial: { messages: ChatMessage[]; olderBefore: string | null };
  shared: Array<{ itemId: string; title: string }>;
  /** Pieces, open tasks, change proposals and ownership claims the crew can talk about. */
  contexts?: Array<{ kind: "artifact" | "task" | "proposal" | "claim"; id: string; label: string }>;
}) {
  const [messages, setMessages] = useState(initial.messages);
  const [olderBefore, setOlderBefore] = useState(initial.olderBefore);
  const [startingHuddle, setStartingHuddle] = useState(false);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const titles = new Map(shared.map((s) => [s.itemId, s.title]));

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ messages: ChatMessage[] }>(`/api/v1/crews/${crewId}/messages`);
      void api(`/api/v1/crews/${crewId}/messages/read`, { method: "POST" }).catch(() => undefined);
      setMessages((prev) => {
        // Keep older pages already loaded; replace the latest window.
        const latestIds = new Set(r.messages.map((m) => m.id));
        const firstLatest = r.messages[0]?.at;
        const older = firstLatest ? prev.filter((m) => m.at < firstLatest && !latestIds.has(m.id)) : [];
        return [...older, ...r.messages];
      });
    } catch {
      // A missed poll is fine; the next one catches up.
    }
  }, [crewId]);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    void api(`/api/v1/crews/${crewId}/messages/read`, { method: "POST" }).catch(() => undefined);
  }, [crewId]);

  return (
    <section aria-label="Crew chat" className="space-y-4">
      <SectionHeader
        title="Crew chat"
        action={
          <Button
            variant="secondary"
            loading={startingHuddle}
            onClick={async () => {
              setStartingHuddle(true);
              setError(null);
              try {
                const r = await api<{ huddleId: string }>(`/api/v1/crews/${crewId}/huddle`, { method: "POST" });
                router.push(`/huddles/${r.huddleId}`);
              } catch (e) {
                setError(errorMessage(e));
                setStartingHuddle(false);
              }
            }}
          >
            <Video className="size-4" aria-hidden /> Start a Huddle
          </Button>
        }
      />
      {olderBefore ? (
        <Button
          variant="ghost"
          onClick={async () => {
            const r = await api<{ messages: ChatMessage[]; olderBefore: string | null }>(`/api/v1/crews/${crewId}/messages?before=${encodeURIComponent(olderBefore)}`);
            setMessages((prev) => [...r.messages, ...prev]);
            setOlderBefore(r.olderBefore);
          }}
        >
          Show earlier messages
        </Button>
      ) : null}
      {messages.length ? (
        <ol aria-label="Messages" className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className={cn("flex gap-2", m.author.id === viewerId && "justify-end")}>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-2 text-[15px]", m.author.id === viewerId ? "bg-accent-soft text-ink" : "border border-border-soft bg-surface text-ink")}>
                <p className="text-sm text-ink-subtle">
                  {m.author.id === viewerId ? "You" : m.author.name} · <RelativeTime iso={m.at} />
                </p>
                {m.context ? (
                  m.context.href ? (
                    <Link href={m.context.href} className="mb-1 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-cream px-3 text-sm text-ink hover:underline">
                      <Tag className="size-3.5" aria-hidden /> {m.context.label}
                    </Link>
                  ) : (
                    <p className="mb-1 text-sm text-ink-subtle">{m.context.label}</p>
                  )
                ) : null}
                <p className="whitespace-pre-line break-words">{m.body}</p>
                {m.huddleId ? (
                  <Link href={`/huddles/${m.huddleId}`} className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent-ink hover:underline">
                    <Video className="size-4" aria-hidden /> Open the Huddle
                  </Link>
                ) : null}
                {m.draftedByAi ? <p className="text-xs text-ink-subtle">Drafted with CreatorBrain</p> : null}
                {m.itemId && titles.has(m.itemId) ? (
                  <Link href={`/projects/${projectId}/shared/${m.itemId}`} className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent-ink hover:underline">
                    <Paperclip className="size-4" aria-hidden /> {titles.get(m.itemId)}
                  </Link>
                ) : null}
              </div>
              {m.author.id === viewerId || canModerate ? (
                <Menu>
                  <MenuTrigger aria-label="Message options" className="inline-flex size-11 shrink-0 items-center justify-center self-center rounded-full text-ink-subtle hover:bg-black/[0.05]">
                    <MoreHorizontal className="size-4" aria-hidden />
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem
                      destructive
                      onSelect={async () => {
                        try {
                          await api(`/api/v1/crews/${crewId}/messages/${m.id}`, { method: "DELETE" });
                          setMessages((prev) => prev.filter((x) => x.id !== m.id));
                        } catch (e) {
                          setError(errorMessage(e));
                        }
                      }}
                    >
                      Remove message
                    </MenuItem>
                  </MenuContent>
                </Menu>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-surface/70 px-5 py-6 text-center text-[15px] text-ink-muted">No messages yet. Say hello to the crew.</p>
      )}
      <div ref={bottom} />
      <MessageComposer
        id="crew-message"
        label="Message the crew"
        placeholder="Message the crew"
        draftTarget={{ crewId }}
        aboutLabel="Point to"
        about={[...shared.map((x) => ({ value: `item:${x.itemId}`, label: `Shared: ${x.title}` })), ...contexts.map((c) => ({ value: `${c.kind}:${c.id}`, label: c.label }))]}
        className="sticky bottom-[calc(var(--bottom-nav-height)+0.5rem)] rounded-2xl border border-border-soft bg-surface p-3 shadow-[var(--shadow-card)] md:bottom-4"
        onSend={async ({ body, about, draftedByAi }) => {
          const [kind, id] = about ? about.split(":") : [null, null];
          await api(`/api/v1/crews/${crewId}/messages`, {
            method: "POST",
            json: { body, itemId: kind === "item" ? id : null, contextKind: kind && kind !== "item" ? kind : null, contextId: kind && kind !== "item" ? id : null, draftedByAi },
          });
          await refresh();
        }}
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
