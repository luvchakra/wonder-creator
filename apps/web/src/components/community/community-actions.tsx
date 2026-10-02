"use client";
import { CONVERSATION_INTENTS, INTENT_HINT, INTENT_LABEL, type ConversationIntent } from "@wonder/creator-community/shared";
import { Button, ConfirmDialog, Dialog, DialogContent, Input, KIT, Menu, MenuContent, MenuItem, MenuTrigger, Textarea, cn } from "@wonder/ui";
import { MoreHorizontal, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

/**
 * Community actions (docs/communities.md). Each is one clear step: start a community, join or leave one, start a topic,
 * or — for its owner and moderators — take a topic out. Nothing here is a feed or a counter.
 */

export function StartCommunityButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="inline-flex min-h-11 items-center">
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-soft bg-surface px-3.5 text-[13.5px] font-medium text-ink hover:bg-surface-muted">
          <Plus className="size-4" aria-hidden /> Start a community
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Start a community" description="A lasting place for people who share an interest. Anyone can find it and join." art={KIT.painted.lavenderSprig}>
          {open ? <StartCommunityBody /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StartCommunityBody() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [about, setAbout] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await api<{ id: string }>("/api/v1/communities", { method: "POST", json: { title, about } });
          router.push(`/communities/${r.id}`);
        } catch (err) {
          setError(errorMessage(err));
          setBusy(false);
        }
      }}
    >
      <div className="space-y-1">
        <label htmlFor="community-title" className="text-[13px] font-medium text-ink">
          Name
        </label>
        <Input id="community-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Poetry & Spoken Word" autoFocus />
      </div>
      <div className="space-y-1">
        <label htmlFor="community-about" className="text-[13px] font-medium text-ink">
          What it&rsquo;s about
        </label>
        <Textarea id="community-about" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={2000} className="min-h-20" placeholder="A place for people who write to be heard." />
      </div>
      <p className="text-[12.5px] text-ink-subtle">Communities are always public. You&rsquo;ll be its owner, and it&rsquo;s also a Creative Room of yours, so members can make things together there.</p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" loading={busy} disabled={title.trim().length < 3}>
        Start the community
      </Button>
    </form>
  );
}

/** Join (one tap, open to anyone) or, once in, Leave — leaving asks first and can be undone by joining again. */
export function JoinCommunityButton({ id, joined, owner, compact }: { id: string; joined: boolean; owner?: boolean; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  async function act(path: "join" | "leave") {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/communities/${id}/${path}`, { method: "POST" });
      setConfirm(false);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (owner) return null;
  if (!joined) {
    return (
      <span className="inline-flex flex-col">
        <Button size={compact ? "sm" : "md"} variant={compact ? "soft" : "primary"} loading={busy} onClick={() => void act("join")}>
          {compact ? "Join" : "Join community"}
        </Button>
        {error ? (
          <span role="alert" className="mt-1 text-[12.5px] text-danger">
            {error}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setConfirm(true)} className="inline-flex min-h-11 items-center px-1 text-[13px] text-ink-subtle hover:text-ink hover:underline">
        Leave this community
      </button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Leave this community?"
        body={error ?? "You won't see members-only things here any more. Your topics and posts stay, and you can join again any time."}
        confirmLabel="Leave"
        busy={busy}
        onConfirm={() => void act("leave")}
      />
    </>
  );
}

/** "Start a topic": a sheet (opened from the page or from the Palette with ?new=topic). */
export function StartTopicButton({ communityId, title }: { communityId: string; title: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const fromPalette = sp.get("new") === "topic";
  const [open, setOpen] = useState(fromPalette);
  const [seen, setSeen] = useState(fromPalette);
  // The Palette leaf navigates here with ?new=topic; open the sheet each time it does.
  if (fromPalette !== seen) {
    setSeen(fromPalette);
    if (fromPalette) setOpen(true);
  }
  const close = (o: boolean) => {
    setOpen(o);
    if (!o && fromPalette) router.replace(pathname, { scroll: false });
  };
  return (
    <>
      <Button size="sm" variant="soft" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> Start a topic
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent title="Start a topic" description={`In ${title}. Topics are public: anyone can read them and post.`} art={KIT.iconChip.message}>
          {open ? <TopicBody communityId={communityId} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TopicBody({ communityId }: { communityId: string }) {
  const router = useRouter();
  const [intent, setIntent] = useState<ConversationIntent>("discuss");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await api<{ conversation: { id: string } }>(`/api/v1/communities/${communityId}/topics`, { method: "POST", json: { intent, title, body: body || undefined } });
          router.push(`/community/conversations/${r.conversation.id}`);
        } catch (err) {
          setError(errorMessage(err));
          setBusy(false);
        }
      }}
    >
      <div role="radiogroup" aria-label="What kind" className="flex flex-wrap gap-x-1.5">
        {CONVERSATION_INTENTS.map((i) => (
          <button key={i} type="button" role="radio" aria-checked={intent === i} title={INTENT_HINT[i]} onClick={() => setIntent(i)} className="inline-flex min-h-11 items-center">
            <span className={cn("inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium", intent === i ? "bg-accent-soft text-accent-ink ring-1 ring-accent/30" : "bg-surface-muted text-ink-muted hover:text-ink")}>
              {INTENT_LABEL[i]}
            </span>
          </button>
        ))}
      </div>
      <div className="space-y-1">
        <label htmlFor="topic-title" className="text-[13px] font-medium text-ink">
          Topic
        </label>
        <Input id="topic-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Reading aloud changes the line breaks" autoFocus />
      </div>
      <div className="space-y-1">
        <label htmlFor="topic-body" className="text-[13px] font-medium text-ink">
          First post
        </label>
        <Textarea id="topic-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} className="min-h-24" />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" loading={busy} disabled={title.trim().length < 3}>
        Start the topic
      </Button>
    </form>
  );
}

/** Owner and moderators: take a topic out of the community (the topic stays with its author). */
export function RemoveTopicButton({ communityId, topicId, topicTitle }: { communityId: string; topicId: string; topicTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <button type="button" aria-label={`More for “${topicTitle}”`} className="mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-subtle hover:bg-black/5 hover:text-ink">
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem destructive onSelect={() => setOpen(true)}>
            Remove from the community
          </MenuItem>
        </MenuContent>
      </Menu>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Remove this topic from the community?"
        body={error ?? `“${topicTitle}” leaves the forum. Its author keeps it, with its posts.`}
        confirmLabel="Remove"
        destructive
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          setError(null);
          try {
            await api(`/api/v1/communities/${communityId}/topics/${topicId}`, { method: "DELETE" });
            setOpen(false);
            router.refresh();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
