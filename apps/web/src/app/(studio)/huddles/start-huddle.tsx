"use client";
import { Button, Dialog, DialogContent, Field, Input, Switch, Textarea, buttonClasses } from "@wonder/ui";
import { Radio, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreatorPicker, type PickedCreator } from "@/components/creator-picker";
import { api, errorMessage } from "@/lib/client";

export type RelatedStart = { kind: "artifact" | "material"; id: string; title: string };

export function StartHuddle({ currentHuddleId, mediaConfigured, creatorName, related }: { currentHuddleId: string | null; mediaConfigured: boolean; creatorName: string; related?: RelatedStart | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!related && !currentHuddleId);
  const [topic, setTopic] = useState(related ? related.title.slice(0, 140) : "");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [savingChat, setSavingChat] = useState(false);
  const [withRelated, setWithRelated] = useState(!!related);
  const [invitees, setInvitees] = useState<PickedCreator[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (currentHuddleId) {
    return (
      <Link href={`/huddles/${currentHuddleId}`} className={buttonClasses({})}>
        <Radio className="size-4" aria-hidden /> Return to your live Huddle
      </Link>
    );
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Radio className="size-4" aria-hidden /> Start a Huddle
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Start a Huddle" description="A temporary space to talk. It ends when the last person leaves — nothing is kept unless someone saves it.">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const r = await api<{ id: string }>("/api/v1/huddles", {
                  method: "POST",
                  json: {
                    topic,
                    description,
                    discoverability: isPublic ? "public" : "invite_only",
                    allowSavingChat: savingChat,
                    relatedArtifactId: withRelated && related?.kind === "artifact" ? related.id : null,
                    relatedMaterialId: withRelated && related?.kind === "material" ? related.id : null,
                    invite: invitees.map((c) => c.id),
                  },
                });
                router.push(`/huddles/${r.id}`);
              } catch (err) {
                setError(errorMessage(err));
                setBusy(false);
              }
            }}
          >
            <Field label="What are you talking about? (optional)" htmlFor="topic" hint="Shown on the public card so others know what it's about.">
              <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="independent filmmaking" maxLength={140} />
            </Field>
            <Field label="Anything else? (optional)" htmlFor="huddle-description" hint="Shown to people in the Huddle.">
              <Textarea id="huddle-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} />
            </Field>
            {related ? (
              <label className="flex min-h-11 items-center justify-between gap-4">
                <span>
                  <span className="block font-medium text-ink">Talk about “{related.title}”</span>
                  <span className="text-sm text-ink-muted">People in the Huddle see its title; they can open it only if they already can.</span>
                </span>
                <Switch checked={withRelated} onCheckedChange={setWithRelated} label={`Talk about ${related.title}`} />
              </label>
            ) : null}
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-medium text-ink">Discoverable</span>
                <span className="text-sm text-ink-muted">{isPublic ? "Anyone can see it's live and ask to join." : "Only creators you invite can see it."}</span>
              </span>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} label="Discoverable" />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-medium text-ink">Let people save chat moments</span>
                <span className="text-sm text-ink-muted">{savingChat ? "Everyone can save messages sent in the chat to their own material, credited to whoever wrote them." : "Everyone can save only their own messages. Nothing is recorded or transcribed."}</span>
              </span>
              <Switch checked={savingChat} onCheckedChange={setSavingChat} label="Let people save chat moments" />
            </label>
            <div>
              <CreatorPicker id="start-invite" label="Invite creators (optional)" exclude={invitees.map((c) => c.id)} actionLabel="Add" onPick={(c) => setInvitees((x) => [...x, c])} />
              {invitees.length ? (
                <ul className="mt-2 flex flex-wrap gap-2" aria-label="Inviting">
                  {invitees.map((c) => (
                    <li key={c.id} className="inline-flex items-center gap-1 rounded-full bg-accent-softer py-1 pl-3 pr-1 text-sm text-ink">
                      {c.display_name}
                      <button type="button" className="inline-flex size-8 items-center justify-center rounded-full hover:bg-black/[0.06]" aria-label={`Don't invite ${c.display_name}`} onClick={() => setInvitees((x) => x.filter((y) => y.id !== c.id))}>
                        <X className="size-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <p className="rounded-xl bg-surface-muted p-3 text-sm text-ink-muted">
              {mediaConfigured ? "Voice and video are available." : "Voice and video aren't connected in this environment yet — text chat works."} Join requests always need approval from someone inside.
            </p>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Go live as {creatorName.split(" ")[0] || "you"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
