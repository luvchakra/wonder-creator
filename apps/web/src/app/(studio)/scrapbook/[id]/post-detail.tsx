"use client";
import { REPLY_POLICIES, type ScrapbookPost } from "@wonder/creator-library/scrapbook-options";
import { Avatar, Button, ConfirmDialog, Dialog, DialogContent, Field, Menu, MenuContent, MenuItem, MenuTrigger, Select, Textarea, buttonClasses } from "@wonder/ui";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RelativeTime } from "@/components/client-time";
import { ScrapbookPostCard } from "@/components/scrapbook-post";
import { StudioNoteLine, bringToStudio, type StudioNote } from "@/components/studio/bring-to-studio";
import { api, errorMessage } from "@/lib/client";

type Reply = { id: string; body: string; createdAt: string; author: { id: string; name: string; handle: string | null }; mine: boolean; canRemove: boolean };
type Data = { post: ScrapbookPost; canReply: boolean; replies: Reply[] };

export function PostDetail({ initial }: { initial: Data }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reporting, setReporting] = useState<{ replyId?: string } | null>(null);
  const [blocking, setBlocking] = useState<{ id: string; name: string } | null>(null);
  const [studio, setStudio] = useState<StudioNote | null>(null);
  const { post } = data;
  const inspire = () => act("studio", async () => setStudio(await bringToStudio("scrapbook_entry", post.id)));

  async function reload() {
    setData(await api<Data>(`/api/v1/scrapbook/${post.id}`));
  }
  async function act(key: string, fn: () => Promise<unknown>) {
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

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/scrapbook" className="inline-flex min-h-11 items-center text-sm text-accent-ink hover:underline">
        ← Scrapbook
      </Link>
      <div className="mt-2">
        <ScrapbookPostCard post={post} linkToDetail={false} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {post.mine ? (
          <>
            <Field label="Who can see it" htmlFor="sb-vis" className="min-w-48 flex-1">
              <Select id="sb-vis" value={post.visibility} onChange={(e) => act("vis", async () => (await api(`/api/v1/scrapbook/${post.id}`, { method: "PATCH", json: { visibility: e.target.value } }), await reload()))}>
                <option value="public">People who can see your profile</option>
                <option value="private">Only you</option>
              </Select>
            </Field>
            <Field label="Who can reply" htmlFor="sb-rep" className="min-w-48 flex-1">
              <Select id="sb-rep" value={post.replyPolicy} onChange={(e) => act("rep", async () => (await api(`/api/v1/scrapbook/${post.id}`, { method: "PATCH", json: { replyPolicy: e.target.value } }), await reload()))}>
                {REPLY_POLICIES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="ghost" className="self-end text-danger" onClick={() => setConfirmDelete(true)}>
              Delete post
            </Button>
            {post.body ? (
              <Button variant="ghost" className="self-end" onClick={() => void inspire()}>
                Bring to Studio
              </Button>
            ) : null}
          </>
        ) : (
          <Menu>
            <MenuTrigger className={buttonClasses({ variant: "ghost", className: "px-3" })} aria-label="More actions for this post">
              <MoreHorizontal className="size-5" aria-hidden />
            </MenuTrigger>
            <MenuContent align="start">
              {post.body ? <MenuItem onSelect={() => void inspire()}>Use as inspiration</MenuItem> : null}
              <MenuItem onSelect={() => setReporting({})}>Report this post</MenuItem>
              <MenuItem destructive onSelect={() => setBlocking({ id: post.author.id, name: post.author.name })}>
                Block {post.author.name}
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
      </div>
      <div className="mt-2">
        <StudioNoteLine note={studio} />
      </div>
      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-[15px] text-danger">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="replies-h" className="mt-8">
        <h2 id="replies-h" className="text-lg font-semibold text-ink">
          Replies
        </h2>
        {data.replies.length ? (
          <ol className="mt-3 space-y-3">
            {data.replies.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border-soft bg-surface p-3">
                <div className="flex items-start gap-3">
                  <Avatar name={r.author.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-muted">
                      {r.author.handle ? (
                        <Link href={`/creators/${r.author.handle}`} className="font-medium text-ink hover:underline">
                          {r.mine ? "You" : r.author.name}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink">{r.mine ? "You" : r.author.name}</span>
                      )}{" "}
                      · <RelativeTime iso={r.createdAt} />
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[15px] text-ink">{r.body}</p>
                  </div>
                  <Menu>
                    <MenuTrigger className={buttonClasses({ variant: "ghost", size: "sm", className: "px-2" })} aria-label={`More actions for the reply by ${r.author.name}`}>
                      <MoreHorizontal className="size-4" aria-hidden />
                    </MenuTrigger>
                    <MenuContent>
                      {r.canRemove ? (
                        <MenuItem destructive onSelect={() => act(`del${r.id}`, async () => (await api(`/api/v1/scrapbook/replies/${r.id}`, { method: "DELETE" }), await reload()))}>
                          {r.mine ? "Delete my reply" : "Remove reply"}
                        </MenuItem>
                      ) : null}
                      {!r.mine ? <MenuItem onSelect={() => setReporting({ replyId: r.id })}>Report reply</MenuItem> : null}
                      {!r.mine ? (
                        <MenuItem destructive onSelect={() => setBlocking({ id: r.author.id, name: r.author.name })}>
                          Block {r.author.name}
                        </MenuItem>
                      ) : null}
                    </MenuContent>
                  </Menu>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-[15px] text-ink-muted">No replies yet.</p>
        )}
        {data.canReply ? (
          <form
            className="mt-4 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void act("reply", async () => {
                await api(`/api/v1/scrapbook/${post.id}/replies`, { method: "POST", json: { body } });
                setBody("");
                await reload();
              });
            }}
          >
            <Field label="Your reply" htmlFor="sb-reply">
              <Textarea id="sb-reply" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={3} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={busy === "reply"} disabled={!body.trim()}>
                Reply
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-4 rounded-xl bg-surface-muted p-3 text-sm text-ink-muted">{post.replyPolicy === "none" ? "Replies are off for this post." : "Replies are limited to people the author follows."}</p>
        )}
      </section>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title="Delete this post?"
        body="It and its replies are removed for everyone. Attached material stays in your Space."
        confirmLabel="Delete"
        busy={busy === "delete"}
        onConfirm={() =>
          act("delete", async () => {
            await api(`/api/v1/scrapbook/${post.id}`, { method: "DELETE" });
            router.push("/scrapbook");
          })
        }
      />
      <ReportDialog postId={post.id} target={reporting} onClose={() => setReporting(null)} />
      <ConfirmDialog
        open={!!blocking}
        onOpenChange={(o) => !o && setBlocking(null)}
        destructive
        title={`Block ${blocking?.name ?? ""}?`}
        body="You won't see each other's posts or replies, and they can't invite you or share with you."
        confirmLabel="Block"
        busy={busy === "block"}
        onConfirm={() =>
          act("block", async () => {
            await api(`/api/v1/creators/${blocking!.id}/block`, { method: "POST" });
            setBlocking(null);
            if (blocking!.id === post.author.id) router.push("/scrapbook");
            else await reload();
          })
        }
      />
    </div>
  );
}

function ReportDialog({ postId, target, onClose }: { postId: string; target: { replyId?: string } | null; onClose: () => void }) {
  const [reason, setReason] = useState("harassment");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={!!target} onOpenChange={(o) => (!o && (onClose(), setDone(false)))}>
      <DialogContent title={target?.replyId ? "Report this reply" : "Report this post"} description="Reports are reviewed for safety. The author isn't told who reported it.">
        {done ? (
          <p className="text-ink">Thank you. We&apos;ll review it.</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api(`/api/v1/scrapbook/${postId}/report`, { method: "POST", json: { reason, details, replyId: target?.replyId } });
                setDone(true);
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
          >
            <Field label="Reason" htmlFor="sb-report-reason">
              <Select id="sb-report-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                {["harassment", "hate", "spam", "sexual", "violence", "impersonation", "other"].map((r) => (
                  <option key={r} value={r}>
                    {r[0].toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Details (optional)" htmlFor="sb-report-details" error={error}>
              <Textarea id="sb-report-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
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
