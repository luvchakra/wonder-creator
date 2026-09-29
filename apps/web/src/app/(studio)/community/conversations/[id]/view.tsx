"use client";
import type { ConversationDetail } from "@wonder/creator-community";
import { CONVERSATION_VISIBILITIES, INTENT_LABEL, VISIBILITY_LABEL, catchUpLine, type ConversationVisibility } from "@wonder/creator-community/shared";
import type { DejaVu } from "@wonder/creator-moments/shared";
import { Avatar, Button, Dialog, DialogContent, KIT, Menu, MenuContent, MenuItem, MenuTrigger, Textarea } from "@wonder/ui";
import { ArrowLeft, AudioLines, Ban, Bookmark, Flag, Lock, MoreHorizontal, Paperclip, Pencil, PenTool, Sparkles, Trash2, Unlock, Users, VolumeX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RelativeTime } from "@/components/client-time";
import { DejaVuChips } from "@/components/dejavu/dejavu-chips";
import { StudioNoteLine, bringToStudio, type StudioNote } from "@/components/studio/bring-to-studio";
import { api, errorMessage } from "@/lib/client";

type Props = {
  detail: ConversationDetail;
  viewerId: string;
  attachments: Record<string, { title: string; href: string }>;
  dejavus: { momentId: string | null; dejavus: DejaVu[] };
};

/**
 * The conversation (Phase 03): title, who and what kind, the words, catch-up since the viewer's last read, replies and
 * one reply box. Conversions (Huddle, Creative Room), DejaVu, reporting, muting and blocking sit under More; the owner's
 * controls (edit, close, visibility, remove a reply) only appear for the owner.
 */
export function ConversationView({ detail, viewerId, attachments, dejavus }: Props) {
  const router = useRouter();
  const c = detail.conversation;
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [studio, setStudio] = useState<StudioNote | null>(null);
  const [sheet, setSheet] = useState<null | "edit" | "report" | "block">(null);
  const [reportTarget, setReportTarget] = useState<{ type: "open_conversation" | "open_conversation_reply"; id: string; creatorId: string } | null>(null);

  // Caught up: the catch-up line shows what was new, then the read mark moves forward.
  useEffect(() => {
    void api(`/api/v1/open-conversations/${c.id}/read`, { method: "POST" }).catch(() => undefined);
  }, [c.id]);

  async function act(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  const send = () =>
    act("reply", async () => {
      await api(`/api/v1/open-conversations/${c.id}/replies`, { method: "POST", json: { body: reply } });
      setReply("");
      router.refresh();
    });
  const author = detail.author;
  const catchUp = detail.catchUp ? catchUpLine(detail.catchUp) : null;

  return (
    <article className="mx-auto max-w-2xl space-y-3">
      <Link href="/community?filter=conversations" className="inline-flex min-h-11 items-center gap-1.5 text-[13.5px] text-accent-ink hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Community
      </Link>

      {c.removedAt ? (
        <p role="status" className="rounded-2xl bg-danger-soft px-3 py-2 text-[13px] text-danger">
          Removed by a moderator. Only you{detail.isModerator ? " (as a moderator)" : ""} can see it.
        </p>
      ) : null}

      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[12.5px] text-ink-muted">
            <Avatar name={author.name} size={22} />
            <span className="min-w-0 truncate">
              {author.handle ? (
                <Link href={`/creators/${author.handle}`} className="font-medium text-ink hover:underline">
                  {author.name}
                </Link>
              ) : (
                <span className="font-medium text-ink">{author.name}</span>
              )}{" "}
              · {INTENT_LABEL[c.intent]} · <RelativeTime iso={c.createdAt} />
              {c.visibility === "limited" ? " · Limited" : ""}
            </span>
          </p>
          <h1 className="mt-1 break-words font-display text-[22px] leading-tight text-ink">{c.title}</h1>
        </div>
        <Menu>
          <MenuTrigger asChild>
            <button type="button" aria-label="More for this conversation" className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-black/5">
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
          </MenuTrigger>
          <MenuContent>
            {!c.removedAt ? (
              <MenuItem onSelect={() => void act("studio", async () => setStudio(await bringToStudio("conversation", c.id)))}>
                <PenTool className="size-4" aria-hidden /> Bring to Studio
              </MenuItem>
            ) : null}
            {!c.removedAt ? (
              <MenuItem
                onSelect={() =>
                  void act("huddle", async () => {
                    const r = await api<{ huddleId: string }>(`/api/v1/open-conversations/${c.id}/start-huddle`, { method: "POST", json: {} });
                    router.push(`/huddles/${r.huddleId}`);
                  })
                }
              >
                <AudioLines className="size-4" aria-hidden /> Start Huddle about this
              </MenuItem>
            ) : null}
            {!c.removedAt ? (
              <MenuItem
                onSelect={() =>
                  void act("room", async () => {
                    const r = await api<{ projectId: string }>(`/api/v1/open-conversations/${c.id}/start-creative-room`, { method: "POST" });
                    router.push(`/projects/${r.projectId}`);
                  })
                }
              >
                <Users className="size-4" aria-hidden /> Start Creative Room
              </MenuItem>
            ) : null}
            {detail.isOwner ? (
              <>
                <MenuItem onSelect={() => setSheet("edit")}>
                  <Pencil className="size-4" aria-hidden /> Edit
                </MenuItem>
                <MenuItem
                  onSelect={() =>
                    void act("close", async () => {
                      await api(`/api/v1/open-conversations/${c.id}/close`, { method: "POST", json: { closed: !c.closedAt } });
                      router.refresh();
                    })
                  }
                >
                  {c.closedAt ? <Unlock className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />} {c.closedAt ? "Reopen" : "Close to new replies"}
                </MenuItem>
              </>
            ) : (
              <>
                <MenuItem
                  onSelect={() => {
                    setReportTarget({ type: "open_conversation", id: c.id, creatorId: c.creatorId });
                    setSheet("report");
                  }}
                >
                  <Flag className="size-4" aria-hidden /> Report
                </MenuItem>
                <MenuItem
                  onSelect={() =>
                    void act("mute", async () => {
                      await api(`/api/v1/creators/${c.creatorId}/mute`, { method: "POST", json: { on: true } });
                      setNotice(`${author.name} is muted. You won't see them in Community.`);
                    })
                  }
                >
                  <VolumeX className="size-4" aria-hidden /> Mute {author.name.split(" ")[0]}
                </MenuItem>
                <MenuItem onSelect={() => setSheet("block")}>
                  <Ban className="size-4" aria-hidden /> Block {author.name.split(" ")[0]}
                </MenuItem>
              </>
            )}
            {detail.isModerator && !detail.isOwner ? (
              <MenuItem
                onSelect={() =>
                  void act("moderate", async () => {
                    await api(`/api/v1/open-conversations/${c.id}/moderate`, { method: "POST", json: { remove: !c.removedAt } });
                    router.refresh();
                  })
                }
              >
                <Trash2 className="size-4" aria-hidden /> {c.removedAt ? "Restore (moderator)" : "Remove (moderator)"}
              </MenuItem>
            ) : null}
          </MenuContent>
        </Menu>
      </header>

      {c.intent === "critique" ? (
        <p className="rounded-2xl bg-accent-softer px-3 py-2 text-[13px] text-ink">
          <span className="font-medium">Critique requested.</span> {author.name.split(" ")[0]} asked for constructive feedback.
        </p>
      ) : null}
      <StudioNoteLine note={studio} />
      {c.body ? <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{c.body}</p> : null}
      {/* Ask Community (Phase 04 §13): the one part of the work being asked about — never the rest of it. */}
      {c.sourceFragment ? (
        <figure aria-label="What this is about" className="rounded-2xl border border-border-soft bg-surface/90 px-3 py-2">
          <figcaption className="text-[12px] font-medium text-ink-subtle">{c.sourceFragment.label}</figcaption>
          <blockquote className="mt-0.5 whitespace-pre-line font-display text-[16px] leading-snug text-ink">{c.sourceFragment.text}</blockquote>
        </figure>
      ) : null}
      {c.sourceEntityId ? (
        attachments[c.sourceEntityId] ? (
          <Link href={attachments[c.sourceEntityId]!.href} className="inline-flex min-h-11 items-center gap-1.5 text-[13.5px] font-medium text-accent-ink hover:underline">
            <Paperclip className="size-4" aria-hidden /> About: {attachments[c.sourceEntityId]!.title}
          </Link>
        ) : (
          <p className="flex items-center gap-1.5 text-[13px] text-ink-subtle">
            <Lock className="size-4" aria-hidden /> {c.sourceFragment ? `From a Creation ${author.name.split(" ")[0]} keeps private — only this part is shared.` : `About something ${author.name.split(" ")[0]} keeps private.`}
          </p>
        )
      ) : null}

      <DejaVuChips entityType="conversation" entityId={c.id} initial={dejavus} />

      {detail.links.length || detail.preservedFromHuddles ? (
        <section aria-label="What grew from this" className="space-y-1 rounded-2xl border border-border-soft bg-surface/90 px-3 py-2">
          {detail.links.map((l) =>
            l.kind === "huddle" ? (
              <Link key={l.id} href={`/huddles/${l.id}`} className="flex min-h-11 items-center gap-2 text-[13.5px] text-ink hover:underline">
                <AudioLines className="size-4 text-live" aria-hidden /> {l.live ? "Live Huddle about this — Join" : `Huddle: ${l.title ?? "ended"}`}
              </Link>
            ) : (
              <Link key={l.id} href={`/projects/${l.id}`} className="flex min-h-11 items-center gap-2 text-[13.5px] text-ink hover:underline">
                <Users className="size-4 text-accent" aria-hidden /> Creative Room: {l.title ?? "open it"}
              </Link>
            ),
          )}
          {detail.preservedFromHuddles ? (
            <p className="flex items-center gap-2 text-[13px] text-ink-muted">
              <Sparkles className="size-4 text-accent" aria-hidden /> From the Huddle · {detail.preservedFromHuddles} {detail.preservedFromHuddles === 1 ? "Moment" : "Moments"} you preserved
            </p>
          ) : null}
        </section>
      ) : null}

      {catchUp ? (
        <p role="status" className="rounded-2xl bg-surface-muted px-3 py-2 text-[13px] text-ink">
          <span className="font-medium">Since you last read this</span> · {catchUp}
          {detail.catchUp?.byKnown ? ` · ${detail.catchUp.byKnown} from people you've worked with` : ""}
        </p>
      ) : null}

      <section aria-label="Replies" className="space-y-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
          {c.replyCount} {c.replyCount === 1 ? "reply" : "replies"}
        </h2>
        <ul className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface/90">
          {detail.replies.map((r) => (
            <li key={r.id} className="flex items-start gap-2.5 px-3 py-2.5">
              <Avatar name={r.author.name} size={28} />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] text-ink-muted">
                  <span className="font-medium text-ink">{r.author.name}</span> · <RelativeTime iso={r.createdAt} />
                </p>
                {r.deleted || r.removed ? (
                  <p className="text-[13.5px] italic text-ink-subtle">{r.removed ? "Removed." : "You deleted this reply."}</p>
                ) : (
                  <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink">{r.body}</p>
                )}
                {r.attachmentEntityId && !r.deleted && !r.removed ? (
                  attachments[r.attachmentEntityId] ? (
                    <Link href={attachments[r.attachmentEntityId]!.href} className="inline-flex min-h-9 items-center gap-1 text-[13px] text-accent-ink hover:underline">
                      <Paperclip className="size-3.5" aria-hidden /> {attachments[r.attachmentEntityId]!.title}
                    </Link>
                  ) : (
                    <p className="text-[12.5px] text-ink-subtle">Shared privately.</p>
                  )
                ) : null}
              </div>
              {!r.deleted && !r.removed ? (
                <Menu>
                  <MenuTrigger asChild>
                    <button type="button" aria-label={`More for ${r.author.name}'s reply`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-subtle hover:bg-black/5">
                      <MoreHorizontal className="size-4" aria-hidden />
                    </button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem onSelect={() => void act("studio", async () => setStudio(await bringToStudio("conversation_reply", r.id)))}>
                      <PenTool className="size-4" aria-hidden /> Use in Studio
                    </MenuItem>
                    {r.creatorId !== viewerId ? (
                      <MenuItem
                        onSelect={() =>
                          void act("save", async () => {
                            await api(`/api/v1/open-conversations/${c.id}/replies/${r.id}/save`, { method: "POST" });
                            setStudio({ text: "Saved to your Materials, with who said it.", href: "/space", link: "Your Space" });
                          })
                        }
                      >
                        <Bookmark className="size-4" aria-hidden /> Save thought
                      </MenuItem>
                    ) : null}
                    {r.creatorId === viewerId ? (
                      <MenuItem
                        onSelect={() =>
                          void act("delete-reply", async () => {
                            await api(`/api/v1/open-conversations/replies/${r.id}`, { method: "DELETE" });
                            router.refresh();
                          })
                        }
                      >
                        <Trash2 className="size-4" aria-hidden /> Delete my reply
                      </MenuItem>
                    ) : (
                      <>
                        {detail.isOwner || detail.isModerator ? (
                          <MenuItem
                            onSelect={() =>
                              void act("remove-reply", async () => {
                                await api(`/api/v1/open-conversations/replies/${r.id}/remove`, { method: "POST", json: {} });
                                router.refresh();
                              })
                            }
                          >
                            <Trash2 className="size-4" aria-hidden /> Remove reply
                          </MenuItem>
                        ) : null}
                        <MenuItem
                          onSelect={() => {
                            setReportTarget({ type: "open_conversation_reply", id: r.id, creatorId: r.creatorId });
                            setSheet("report");
                          }}
                        >
                          <Flag className="size-4" aria-hidden /> Report
                        </MenuItem>
                      </>
                    )}
                  </MenuContent>
                </Menu>
              ) : null}
            </li>
          ))}
          {!detail.replies.length ? <li className="px-3 py-3 text-[13.5px] text-ink-muted">No replies yet.</li> : null}
        </ul>
      </section>

      {notice ? (
        <p role="status" className="text-[13px] text-ink-muted">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {c.closedAt ? (
        <p className="flex items-center gap-1.5 text-[13.5px] text-ink-muted">
          <Lock className="size-4" aria-hidden /> Closed to new replies.
        </p>
      ) : c.removedAt ? null : (
        <form
          id="reply"
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label htmlFor="reply-body" className="sr-only">
            Your reply
          </label>
          <Textarea id="reply-body" value={reply} onChange={(e) => setReply(e.target.value)} maxLength={4000} placeholder={c.intent === "critique" ? "Constructive feedback…" : "Share your thoughts…"} className="min-h-20" />
          <div className="flex justify-end">
            <Button type="submit" loading={busy === "reply"} disabled={!reply.trim()}>
              Reply
            </Button>
          </div>
        </form>
      )}

      <EditSheet open={sheet === "edit"} onOpenChange={(o) => !o && setSheet(null)} detail={detail} onSaved={() => (setSheet(null), router.refresh())} />
      <ReportSheet open={sheet === "report"} onOpenChange={(o) => !o && setSheet(null)} target={reportTarget} onDone={() => (setSheet(null), setNotice("Thanks — it's been reported for review."))} />
      <Dialog open={sheet === "block"} onOpenChange={(o) => !o && setSheet(null)}>
        <DialogContent title={`Block ${author.name}?`} description="You won't see each other's conversations, replies or profiles, and they can't message you. They aren't told." art={KIT.iconChip.message}>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSheet(null)}>
              Cancel
            </Button>
            <Button
              loading={busy === "block"}
              onClick={() =>
                void act("block", async () => {
                  await api(`/api/v1/creators/${c.creatorId}/block`, { method: "POST", json: { on: true } });
                  router.push("/community");
                })
              }
            >
              Block
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function EditSheet({ open, onOpenChange, detail, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; detail: ConversationDetail; onSaved: () => void }) {
  const c = detail.conversation;
  const [title, setTitle] = useState(c.title);
  const [body, setBody] = useState(c.body ?? "");
  const [visibility, setVisibility] = useState<ConversationVisibility>(c.visibility);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit conversation" art={KIT.iconChip.pencil}>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api(`/api/v1/open-conversations/${c.id}`, { method: "PATCH", json: { title, body, visibility } });
              onSaved();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block space-y-1 text-[13px] font-medium text-ink">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} className="h-11 w-full rounded-xl border border-border-soft bg-surface px-3 text-[14px] font-normal" />
          </label>
          <label className="block space-y-1 text-[13px] font-medium text-ink">
            <span>More</span>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} className="min-h-24" />
          </label>
          <label className="block space-y-1 text-[13px] font-medium text-ink">
            <span>Who can see it</span>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as ConversationVisibility)} className="h-11 w-full rounded-xl border border-border-soft bg-surface px-3 text-[14px] font-normal">
              {CONVERSATION_VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {VISIBILITY_LABEL[v]}
                </option>
              ))}
            </select>
          </label>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" loading={busy} disabled={title.trim().length < 3}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const REASONS = [
  ["spam", "Spam"],
  ["harassment", "Harassment"],
  ["hate", "Hate"],
  ["sexual", "Sexual content"],
  ["violence", "Violence"],
  ["impersonation", "Impersonation"],
  ["other", "Something else"],
] as const;

function ReportSheet({
  open,
  onOpenChange,
  target,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: { type: "open_conversation" | "open_conversation_reply"; id: string; creatorId: string } | null;
  onDone: () => void;
}) {
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Report" description="Reports go to the moderators. The person isn't told who reported." art={KIT.iconChip.message}>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!target) return;
            setBusy(true);
            setError(null);
            try {
              await api("/api/v1/reports", { method: "POST", json: { contextType: target.type, contextId: target.id, reportedCreatorId: target.creatorId, reason, details: details || undefined } });
              onDone();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div role="radiogroup" aria-label="Why" className="flex flex-wrap gap-x-1.5">
            {REASONS.map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={reason === k} onClick={() => setReason(k)} className="inline-flex min-h-11 items-center">
                <span className={`inline-flex h-8 items-center rounded-full px-3 text-[13px] ${reason === k ? "bg-accent-soft text-accent-ink ring-1 ring-accent/30" : "bg-surface-muted text-ink-muted"}`}>{label}</span>
              </button>
            ))}
          </div>
          <label className="block space-y-1 text-[13px] font-medium text-ink">
            <span>Anything else (optional)</span>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} className="min-h-20" />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" loading={busy}>
            Send report
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
