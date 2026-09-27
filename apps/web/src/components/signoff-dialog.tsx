"use client";
import { Button, Dialog, DialogContent, Field, Input } from "@wonder/ui";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

/** Approve or object to publishing a piece's current version (project rights policy: sign-off before publishing). */
export function SignoffDialog({
  piece,
  decision,
  onOpenChange,
  onSaved,
}: {
  piece: { artifactId: string; title: string };
  decision: "approve" | "object";
  onOpenChange: (o: boolean) => void;
  onSaved: (t: string) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        title={decision === "approve" ? "Approve publishing?" : "Object to publishing?"}
        description={
          decision === "approve"
            ? `You're approving the current version of “${piece.title}” for publishing. If it changes, you'll be asked again.`
            : `Publishing “${piece.title}” stays blocked until you approve. Say what needs to change.`
        }
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(`/api/v1/artifacts/${piece.artifactId}/signoff`, {
                method: "POST",
                json: { decision, note: note.trim() || null },
              });
              onSaved(decision === "approve" ? "You approved publishing this version." : "Your objection was recorded.");
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          <Field label={decision === "approve" ? "Note (optional)" : "What needs to change"} htmlFor="signoff-note" error={error}>
            <Input id="signoff-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} required={decision === "object"} />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={decision === "approve" ? "primary" : "danger"} loading={busy} disabled={decision === "object" && !note.trim()}>
              {decision === "approve" ? "Approve" : "Object"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
