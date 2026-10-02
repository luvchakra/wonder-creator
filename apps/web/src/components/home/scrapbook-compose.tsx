"use client";
import { Avatar, cn } from "@wonder/ui";
import { PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

/**
 * The first row of the Scrapbook on Home: one thin compose box. A thought goes to the Scrapbook as people who can see
 * your profile would see it (kind, privacy and attachments live on the Scrapbook page). Enter posts; Shift+Enter breaks.
 */
export function ScrapbookCompose({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = body.trim().length > 0 && !busy;

  async function post() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/scrapbook", { method: "POST", json: { kind: "thought", body: body.trim(), visibility: "public", replyPolicy: "anyone", materialIds: [], artifactIds: [] } });
      setBody("");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      aria-label="Write to your Scrapbook"
      className="flex items-center gap-2 px-3 py-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        void post();
      }}
    >
      <Avatar name={name} src={avatarUrl} size={24} />
      <label htmlFor="home-scrap" className="sr-only">
        Share a thought
      </label>
      <textarea
        id="home-scrap"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void post();
          }
        }}
        rows={1}
        maxLength={5000}
        placeholder="Share a thought…"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "home-scrap-error" : undefined}
        className="min-h-9 flex-1 resize-none bg-transparent py-2 font-display text-[15px] italic leading-snug text-ink placeholder:not-italic placeholder:font-sans placeholder:text-[13.5px] placeholder:text-ink-subtle focus:outline-none"
      />
      <button type="submit" disabled={!ready} aria-label="Post to your Scrapbook" className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors", ready ? "text-accent-ink hover:bg-accent-soft" : "text-ink-subtle/60")}>
        <PenLine className="size-[18px]" aria-hidden />
      </button>
      {error ? (
        <p id="home-scrap-error" role="alert" className="sr-only">
          {error}
        </p>
      ) : null}
    </form>
  );
}
