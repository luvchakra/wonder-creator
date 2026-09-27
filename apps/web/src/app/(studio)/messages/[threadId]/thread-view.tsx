"use client";
import type { DirectMessage } from "@wonder/creator-projects";
import { Button, Menu, MenuContent, MenuItem, MenuTrigger, cn } from "@wonder/ui";
import { ArrowLeft, MoreHorizontal, Tag } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RelativeTime } from "@/components/client-time";
import { MessageComposer, type ComposerOption } from "@/components/message-composer";
import { api, errorMessage } from "@/lib/client";

const POLL_MS = 10_000;

interface Thread {
  id: string;
  other: { id: string; name: string; handle: string | null };
  messages: DirectMessage[];
  olderBefore: string | null;
}

export function ThreadView({ thread, about }: { thread: Thread; about: ComposerOption[] }) {
  const [messages, setMessages] = useState(thread.messages);
  const [olderBefore, setOlderBefore] = useState(thread.olderBefore);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api<Thread>(`/api/v1/messages/${thread.id}`);
      setMessages((prev) => {
        const firstLatest = r.messages[0]?.at;
        const ids = new Set(r.messages.map((m) => m.id));
        return [...(firstLatest ? prev.filter((m) => m.at < firstLatest && !ids.has(m.id)) : []), ...r.messages];
      });
      void api(`/api/v1/messages/${thread.id}/read`, { method: "POST" }).catch(() => undefined);
    } catch {
      // The next poll catches up.
    }
  }, [thread.id]);

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
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/messages" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Messages
      </Link>
      <header>
        <h1 className="font-display text-3xl text-ink">
          {thread.other.handle ? (
            <Link href={`/creators/${thread.other.handle}`} className="hover:underline">
              {thread.other.name}
            </Link>
          ) : (
            thread.other.name
          )}
        </h1>
      </header>

      <section aria-label="Conversation" className="space-y-4">
        {olderBefore ? (
          <Button
            variant="ghost"
            onClick={async () => {
              const r = await api<Thread>(`/api/v1/messages/${thread.id}?before=${encodeURIComponent(olderBefore)}`);
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
              <li key={m.id} className={cn("flex gap-2", m.mine && "justify-end")}>
                <div className={cn("max-w-[85%] rounded-2xl px-4 py-2 text-[15px]", m.mine ? "bg-accent-soft text-ink" : "border border-border-soft bg-surface text-ink")}>
                  <p className="text-sm text-ink-subtle">
                    {m.author} · <RelativeTime iso={m.at} />
                  </p>
                  {m.project || m.artifact ? (
                    <Link
                      href={m.project ? `/projects/${m.project.id}` : `/artifacts/${m.artifact!.id}`}
                      className="mb-1 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-cream px-3 text-sm text-ink hover:underline"
                    >
                      <Tag className="size-3.5" aria-hidden /> {m.project ? `Creative Room: ${m.project.title}` : `Creation: ${m.artifact!.title}`}
                    </Link>
                  ) : null}
                  <p className="whitespace-pre-line break-words">{m.body}</p>
                  {m.draftedByAi ? <p className="text-xs text-ink-subtle">Drafted with CreativeMind</p> : null}
                </div>
                {m.mine ? (
                  <Menu>
                    <MenuTrigger aria-label="Message options" className="inline-flex size-11 shrink-0 items-center justify-center self-center rounded-full text-ink-subtle hover:bg-black/[0.05]">
                      <MoreHorizontal className="size-4" aria-hidden />
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem
                        destructive
                        onSelect={async () => {
                          try {
                            await api(`/api/v1/direct-messages/${m.id}`, { method: "DELETE" });
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
          <p className="rounded-2xl border border-dashed border-border bg-surface/70 px-5 py-6 text-center text-[15px] text-ink-muted">No messages yet.</p>
        )}
        <div ref={bottom} />
        <MessageComposer
          id="direct-message"
          label={`Message ${thread.other.name}`}
          placeholder={`Message ${thread.other.name}`}
          draftTarget={{ threadId: thread.id }}
          about={about}
          className="sticky bottom-[calc(var(--palette-clearance)+0.5rem)] rounded-2xl border border-border-soft bg-surface p-3 shadow-[var(--shadow-card)]"
          onSend={async ({ body, about: a, draftedByAi }) => {
            const [kind, id] = a ? a.split(":") : [null, null];
            await api(`/api/v1/messages/${thread.id}`, { method: "POST", json: { body, projectId: kind === "project" ? id : null, artifactId: kind === "artifact" ? id : null, draftedByAi } });
            await refresh();
          }}
        />
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
