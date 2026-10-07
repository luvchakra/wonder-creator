"use client";
import { COMMUNITY_PRIVACY, CONVERSATION_INTENTS, INTENT_HINT, INTENT_LABEL, PRIVACY_LABEL, type CommunityPrivacy, type ConversationIntent } from "@wonder/creator-community/shared";
import { Button, ConfirmDialog, Dialog, DialogContent, Input, KIT, Menu, MenuContent, MenuItem, MenuTrigger, Textarea, cn } from "@wonder/ui";
import { Camera, Globe, Link2, Lock, MoreHorizontal, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import { shrinkImage } from "@/lib/shrink-image";

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
        <DialogContent title="Start a community" description="A lasting place for people who share an interest." art={KIT.painted.lavenderSprig}>
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
  const [privacy, setPrivacy] = useState<CommunityPrivacy>("public");
  const [picture, setPicture] = useState<File | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
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
          const r = await api<{ id: string }>("/api/v1/communities", { method: "POST", json: { title, about, privacy } });
          if (picture) {
            // The community exists either way; a picture that fails can be added from its page.
            const body = new FormData();
            body.set("file", await shrinkImage(picture));
            await fetch(`/api/v1/communities/${r.id}/avatar`, { method: "POST", body }).catch(() => undefined);
          }
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
      <div className="flex items-center gap-3">
        <label htmlFor="community-picture" className="relative grid size-14 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-surface-muted ring-2 ring-white">
          {/* The preview is drawn on a canvas, so nothing from the file ever becomes page markup. */}
          <canvas ref={previewRef} width={112} height={112} aria-hidden className={cn("absolute inset-0 size-full", !picture && "hidden")} />
          {picture ? null : <Camera className="size-5 text-ink-subtle" aria-hidden />}
        </label>
        <div className="min-w-0 text-[13px]">
          <label htmlFor="community-picture" className="font-medium text-ink">
            Profile picture <span className="font-normal text-ink-subtle">(optional)</span>
          </label>
          <p className="text-[12.5px] text-ink-subtle">Without one, the community gets a painted monogram.</p>
        </div>
        <input
          id="community-picture"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setPicture(f);
            const canvas = previewRef.current;
            const ctx = canvas?.getContext("2d");
            if (!f || !canvas || !ctx) return;
            void createImageBitmap(f)
              .then((bmp) => {
                // Cover-crop to the round preview.
                const s = Math.min(bmp.width, bmp.height);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, canvas.width, canvas.height);
                bmp.close();
              })
              .catch(() => setError("We couldn't read that picture. Try a JPEG, PNG or WebP image."));
          }}
        />
      </div>
      <PrivacyChoice value={privacy} onChange={setPrivacy} />
      <p className="text-[12.5px] text-ink-subtle">Only members can start topics and post. You&rsquo;ll be its owner, and it&rsquo;s also a Creative Room of yours, so members can make things together there.</p>
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

export const PRIVACY_ICON = { public: Globe, unlisted: Link2, private: Lock } as const;

/** Public · Unlisted · Private, as three compact rows (one choice, each with its one-line meaning). */
export function PrivacyChoice({ value, onChange }: { value: CommunityPrivacy; onChange: (p: CommunityPrivacy) => void }) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-[13px] font-medium text-ink">Who can find it</legend>
      <div className="divide-y divide-border-soft overflow-hidden rounded-xl border border-border-soft">
        {COMMUNITY_PRIVACY.map((p) => {
          const Icon = PRIVACY_ICON[p];
          return (
            <label key={p} className={cn("flex min-h-12 cursor-pointer items-center gap-2.5 px-3 py-1.5", value === p ? "bg-accent-soft/60" : "hover:bg-surface-muted")}>
              <input type="radio" name="community-privacy" value={p} checked={value === p} onChange={() => onChange(p)} className="size-4 accent-[var(--color-accent)]" />
              <Icon className={cn("size-4 shrink-0", value === p ? "text-accent-ink" : "text-ink-subtle")} aria-hidden />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-ink">{PRIVACY_LABEL[p].label}</span>
                <span className="block text-[12px] leading-snug text-ink-subtle">{PRIVACY_LABEL[p].hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The owner changes who can find the community (from its page). Members and topics stay either way. */
export function CommunityPrivacyDialog({ id, privacy, open, onOpenChange, opening, onDone }: { id: string; privacy: CommunityPrivacy; open: boolean; onOpenChange: (o: boolean) => void; opening?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState(privacy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={opening ? "Open this room as a community" : "Who can find this community"}
        description={opening ? "Members join its crew and start topics. Its budget, rights notes and goals stay private to the crew. Only members can post." : "Members and topics stay whichever you choose. Only members can post."}
        art={KIT.iconChip.message}
      >
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api(`/api/v1/communities/${id}`, { method: "PATCH", json: { privacy: value } });
              onOpenChange(false);
              onDone?.();
              router.refresh();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <PrivacyChoice value={value} onChange={setValue} />
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" loading={busy} disabled={!opening && value === privacy}>
            {opening ? "Open as a community" : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The owner's quiet control on the community page: the current privacy, which opens the choice. */
export function CommunityPrivacyButton({ id, privacy }: { id: string; privacy: CommunityPrivacy }) {
  const [open, setOpen] = useState(false);
  const Icon = PRIVACY_ICON[privacy];
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`Who can find this community: ${PRIVACY_LABEL[privacy].label}. Change`} className="inline-flex min-h-11 items-center">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-soft bg-surface px-3 text-[13px] text-ink-muted hover:bg-surface-muted hover:text-ink">
          <Icon className="size-3.5" aria-hidden /> {PRIVACY_LABEL[privacy].label}
        </span>
      </button>
      {open ? <CommunityPrivacyDialog id={id} privacy={privacy} open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}

/** Join (one tap; a Private community takes only people its hosts invited) or, once in, Leave — leaving asks first and can be undone by joining again. */
export function JoinCommunityButton({ id, joined, owner, compact, invited }: { id: string; joined: boolean; owner?: boolean; compact?: boolean; invited?: boolean }) {
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
          {compact ? "Join" : invited ? "Accept and join" : "Join community"}
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
        <DialogContent title="Start a topic" description={`In ${title}. Whoever can see the community can read it; members post.`} art={KIT.iconChip.message}>
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
          router.push(`/pulse/conversations/${r.conversation.id}`);
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
