"use client";
import { Button, Dialog, DialogContent, Field, Input, Textarea, KIT } from "@wonder/ui";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

/** Start a campaign brief (P1-16): brand, title, brief and the usage rights it needs. */
export function NewCampaign() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ brandName: "", title: "", brief: "", usageRights: "", channels: "", dueOn: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> New campaign
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent art={KIT.painted.flowerBranch} title="New campaign" description="A brief creators can say yes to. No payments or contracts here.">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const { campaign } = await api<{ campaign: { id: string } }>("/api/v1/campaigns", {
                  method: "POST",
                  json: { brandName: f.brandName, title: f.title, brief: f.brief, usageRights: f.usageRights, channels: f.channels.split(",").map((c) => c.trim()).filter(Boolean), dueOn: f.dueOn || null },
                });
                router.push(`/campaigns/${campaign.id}`);
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Brand" htmlFor="c-brand">
              <Input id="c-brand" value={f.brandName} onChange={set("brandName")} maxLength={80} required />
            </Field>
            <Field label="Campaign title" htmlFor="c-title">
              <Input id="c-title" value={f.title} onChange={set("title")} maxLength={120} required />
            </Field>
            <Field label="Brief" htmlFor="c-brief">
              <Textarea id="c-brief" value={f.brief} onChange={set("brief")} maxLength={4000} required className="min-h-28" />
            </Field>
            <Field label="Usage rights needed" htmlFor="c-rights" hint="Channels, duration, territory, exclusivity…">
              <Textarea id="c-rights" value={f.usageRights} onChange={set("usageRights")} maxLength={1000} required className="min-h-20" />
            </Field>
            <Field label="Channels (optional)" htmlFor="c-channels" hint="Comma-separated, e.g. Instagram, YouTube">
              <Input id="c-channels" value={f.channels} onChange={set("channels")} />
            </Field>
            <Field label="Due (optional)" htmlFor="c-due">
              <Input id="c-due" type="date" value={f.dueOn} onChange={set("dueOn")} />
            </Field>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" loading={busy} className="w-full">
              Create campaign
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
