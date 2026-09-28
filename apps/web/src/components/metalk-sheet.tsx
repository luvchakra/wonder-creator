"use client";
import { Dialog, DialogContent, KIT } from "@wonder/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Composer, type ComposerPayload } from "@/components/composer";
import { errorMessage } from "@/lib/client";
import { PENDING_TURN_KEY, sendToCreator, type PendingTurn } from "@/lib/send";

/**
 * meTalk (UI redesign §2.3, §43): a transient sheet — type, speak, or bring something — not a chat screen. Sending
 * brings any material in, then continues in the conversation that makes the Creation.
 */
export function MeTalkSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(p: ComposerPayload) {
    setBusy(true);
    setError(null);
    try {
      const ids: string[] = [];
      const rejected: PendingTurn["rejected"] = [];
      if (p.files.length || p.urls.length) {
        const r = await sendToCreator({ files: p.files, urls: p.urls });
        ids.push(...r.accepted.map((a) => a.materialId).filter((x): x is string => !!x));
        rejected.push(...r.rejected);
      }
      if (p.photos.length) {
        const r = await sendToCreator({ files: p.photos, kind: "camera" });
        ids.push(...r.accepted.map((a) => a.materialId).filter((x): x is string => !!x));
        rejected.push(...r.rejected);
      }
      if (p.voiceNotes.length) {
        const r = await sendToCreator({ files: p.voiceNotes, kind: "voice" });
        ids.push(...r.accepted.map((a) => a.materialId).filter((x): x is string => !!x));
        rejected.push(...r.rejected);
      }
      const pending: PendingTurn = { message: p.message, materialIds: ids, inputMode: p.inputMode, rejected };
      sessionStorage.setItem(PENDING_TURN_KEY, JSON.stringify(pending));
      // Back to the Canvas: the sheet closes as the conversation takes over.
      onOpenChange(false);
      setBusy(false);
      router.push("/create?pending=1");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent art={KIT.mark.sparklePurple} title="meTalk" description="Tell Wonder Creator what you'd like to make or change — type, speak, or bring something in.">
        <Composer onSubmit={submit} busy={busy} placeholder="What are you thinking about today?" />
        {error ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
