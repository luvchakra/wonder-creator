"use client";
import { cn } from "@wonder/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

/** A compact Follow / Following toggle for people lists (a 32px pill inside a 44px target). */
export function FollowButton({ creatorId, name, initial }: { creatorId: string; name: string; initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end">
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? `Unfollow ${name}` : `Follow ${name}`}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await api(`/api/v1/creators/${creatorId}/follow`, { method: "POST", json: { on: !on } });
            setOn(!on);
            router.refresh();
          } catch (e) {
            setErr(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
        className={cn(
          "relative inline-flex h-8 items-center rounded-full px-3 text-[12.5px] font-medium before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] disabled:opacity-60",
          on ? "border border-border-soft bg-surface text-ink-muted" : "bg-accent text-white",
        )}
      >
        {on ? "Following" : "Follow"}
      </button>
      {err ? (
        <span role="alert" className="text-[11.5px] text-danger">
          {err}
        </span>
      ) : null}
    </span>
  );
}
