"use client";
import { Button, Menu, MenuContent, MenuItem, MenuTrigger, SectionHeader, Select, Textarea, cn } from "@wonder/ui";
import { MoreHorizontal, Paperclip } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RelativeTime } from "@/components/client-time";
import { api, errorMessage } from "@/lib/client";

export interface ChatMessage {
  id: string;
  body: string;
  at: string;
  author: { id: string | null; name: string };
  itemId: string | null;
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
}: {
  crewId: string;
  projectId: string;
  viewerId: string;
  canModerate: boolean;
  initial: { messages: ChatMessage[]; olderBefore: string | null };
  shared: Array<{ itemId: string; title: string }>;
}) {
  const [messages, setMessages] = useState(initial.messages);
  const [olderBefore, setOlderBefore] = useState(initial.olderBefore);
  const [body, setBody] = useState("");
  const [itemId, setItemId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const titles = new Map(shared.map((s) => [s.itemId, s.title]));

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ messages: ChatMessage[] }>(`/api/v1/crews/${crewId}/messages`);
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

  return (
    <section aria-label="Crew chat" className="space-y-4">
      <SectionHeader title="Crew chat" />
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
                <p className="whitespace-pre-line break-words">{m.body}</p>
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
      <form
        className="sticky bottom-[calc(var(--bottom-nav-height)+0.5rem)] space-y-2 rounded-2xl border border-border-soft bg-surface p-3 shadow-[var(--shadow-card)] md:bottom-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api(`/api/v1/crews/${crewId}/messages`, { method: "POST", json: { body, itemId: itemId || null } });
            setBody("");
            setItemId("");
            await refresh();
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="crew-message" className="sr-only">
          Message the crew
        </label>
        <Textarea id="crew-message" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} placeholder="Message the crew" className="min-h-16" />
        <div className="flex flex-wrap items-center gap-2">
          {shared.length ? (
            <>
              <label htmlFor="crew-message-item" className="sr-only">
                Point to shared work
              </label>
              <Select id="crew-message-item" value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-auto min-w-0 flex-1 sm:max-w-xs">
                <option value="">No attachment</option>
                {shared.map((s) => (
                  <option key={s.itemId} value={s.itemId}>
                    {s.title}
                  </option>
                ))}
              </Select>
            </>
          ) : null}
          <Button type="submit" loading={busy} disabled={!body.trim()} className="ml-auto">
            Send
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
