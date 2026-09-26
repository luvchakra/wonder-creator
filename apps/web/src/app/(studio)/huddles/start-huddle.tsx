"use client";
import { Button, Dialog, DialogContent, Field, Input, Switch, buttonClasses } from "@wonder/ui";
import { Radio } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

export function StartHuddle({ currentHuddleId, mediaConfigured, creatorName }: { currentHuddleId: string | null; mediaConfigured: boolean; creatorName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [isPublic, setIsPublic] = useState(true);
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
                const r = await api<{ id: string }>("/api/v1/huddles", { method: "POST", json: { topic, discoverability: isPublic ? "public" : "invite_only" } });
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
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-medium text-ink">Discoverable</span>
                <span className="text-sm text-ink-muted">{isPublic ? "Anyone can see it's live and ask to join." : "Only creators you invite can see it."}</span>
              </span>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} label="Discoverable" />
            </label>
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
