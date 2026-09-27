"use client";
import { Button, Dialog, DialogContent, Field, Input } from "@wonder/ui";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

export type ConnectedDestination = { id: string; name: string; url: string; secret: string };

/** Connect a webhook destination; the signing secret is shown once, right after connecting. */
export function ConnectWebhookDialog({ open, onOpenChange, onConnected }: { open: boolean; onOpenChange: (o: boolean) => void; onConnected: (d: ConnectedDestination) => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<ConnectedDestination | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setMade(null);
          setName("");
          setUrl("");
          setError(null);
        }
      }}
    >
      <DialogContent title="Connect a webhook" description="We'll send each approved publication to this address as signed JSON. It counts as published when it answers with a 2xx status.">
        {made ? (
          <div className="space-y-3">
            <p className="text-[15px] text-ink">Connected. Use this secret to check the x-wonder-signature header (HMAC-SHA256 of “timestamp.body”).</p>
            <Field label="Signing secret" htmlFor="hook-secret">
              <Input id="hook-secret" readOnly value={made.secret} onFocus={(e) => e.currentTarget.select()} />
            </Field>
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const { destination } = await api<{ destination: { id: string; name: string; url: string; signing_secret: string } }>("/api/v1/publishing/destinations", { method: "POST", json: { name, url } });
                const d = { id: destination.id, name: destination.name, url: destination.url, secret: destination.signing_secret };
                setMade(d);
                onConnected(d);
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Name" htmlFor="hook-name" hint="e.g. My website">
              <Input id="hook-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Webhook address" htmlFor="hook-url" error={error}>
              <Input id="hook-url" type="url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} required />
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Connect
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

