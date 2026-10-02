"use client";
import { CONVERSATION_INTENTS, CONVERSATION_VISIBILITIES, INTENT_HINT, INTENT_LABEL, VISIBILITY_HINT, VISIBILITY_LABEL, type ConversationIntent, type ConversationVisibility } from "@wonder/creator-community/shared";
import { Button, Dialog, DialogContent, Input, KIT, Textarea, cn } from "@wonder/ui";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

/** "Start a conversation" (§20): a sheet, not a permanent composer. The intent is chosen first, then the words. */
export function NewConversationButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="inline-flex min-h-11 items-center">
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-soft bg-surface px-3.5 text-[13.5px] font-medium text-ink hover:bg-surface-muted">
          <Plus className="size-4" aria-hidden /> Start a conversation
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Start a conversation" description="Discuss an idea in the open — or ask, share, or look for something." art={KIT.iconChip.message}>
          {open ? <Body /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Body() {
  const router = useRouter();
  const [intent, setIntent] = useState<ConversationIntent>("discuss");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<ConversationVisibility>("community");
  const [handles, setHandles] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ conversation: { id: string } }>("/api/v1/open-conversations", {
        method: "POST",
        json: {
          intent,
          title,
          body: body || undefined,
          visibility,
          inviteHandles: visibility === "limited" ? handles.split(/[\s,]+/).map((h) => h.replace(/^@/, "").trim()).filter(Boolean) : undefined,
        },
      });
      router.push(`/pulse/conversations/${r.conversation.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <fieldset>
        <legend className="mb-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">What kind</legend>
        <div role="radiogroup" aria-label="What kind" className="flex flex-wrap gap-x-1.5">
          {CONVERSATION_INTENTS.map((i) => (
            <button key={i} type="button" role="radio" aria-checked={intent === i} title={INTENT_HINT[i]} onClick={() => setIntent(i)} className="inline-flex min-h-11 items-center">
              <span className={cn("inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium", intent === i ? "bg-accent-soft text-accent-ink ring-1 ring-accent/30" : "bg-surface-muted text-ink-muted hover:text-ink")}>
                {INTENT_LABEL[i]}
              </span>
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-ink-subtle">{intent === "critique" ? "People will know you asked for constructive feedback." : INTENT_HINT[intent]}</p>
      </fieldset>
      <div className="space-y-1">
        <label htmlFor="conv-title" className="text-[13px] font-medium text-ink">
          Title
        </label>
        <Input id="conv-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="How much text belongs on a carousel?" autoFocus />
      </div>
      <div className="space-y-1">
        <label htmlFor="conv-body" className="text-[13px] font-medium text-ink">
          More, if you like
        </label>
        <Textarea id="conv-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} className="min-h-24" />
      </div>
      <fieldset>
        <legend className="mb-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">Who can see it</legend>
        <div role="radiogroup" aria-label="Who can see it" className="divide-y divide-border-soft rounded-2xl border border-border-soft">
          {CONVERSATION_VISIBILITIES.map((v) => (
            <button key={v} type="button" role="radio" aria-checked={visibility === v} onClick={() => setVisibility(v)} className="flex min-h-12 w-full items-center gap-3 px-3 text-left">
              <span className={cn("inline-flex size-4 shrink-0 rounded-full border", visibility === v ? "border-4 border-accent" : "border-border-strong")} />
              <span>
                <span className="block text-[14px] text-ink">{VISIBILITY_LABEL[v]}</span>
                <span className="block text-[12.5px] text-ink-subtle">{VISIBILITY_HINT[v]}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      {visibility === "limited" ? (
        <div className="space-y-1">
          <label htmlFor="conv-people" className="text-[13px] font-medium text-ink">
            Add people by @handle
          </label>
          <Input id="conv-people" value={handles} onChange={(e) => setHandles(e.target.value)} placeholder="@maya, @arjun" />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" loading={busy} disabled={title.trim().length < 3}>
        Start the conversation
      </Button>
    </form>
  );
}
