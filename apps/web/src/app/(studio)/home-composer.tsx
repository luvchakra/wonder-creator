"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Composer, type ComposerPayload } from "@/components/composer";
import { errorMessage } from "@/lib/client";
import { PENDING_TURN_KEY, sendToCreator, type PendingTurn } from "@/lib/send";

/** Home composer: bring things in (CreatorSend), then continue in CreatorTalk. */
export function HomeComposer() {
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
      router.push("/create?pending=1");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="sr-only">Start something</h2>
      <Composer onSubmit={submit} busy={busy} placeholder="What are you thinking about today?" />
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
