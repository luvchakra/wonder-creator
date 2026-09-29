"use client";
import { Check, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

/** Daily counts only (§38): no visitor data, no cookie. Fire-and-forget. */
export function recordPublicEvent(workId: string, kind: "view" | "complete" | "share") {
  void fetch("/api/v1/public/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workId, kind }), keepalive: true }).catch(() => undefined);
}

/** One view per page load, not for the creator's own preview. */
export function ViewBeacon({ workId, preview }: { workId: string; preview: boolean }) {
  useEffect(() => {
    if (!preview) recordPublicEvent(workId, "view");
  }, [workId, preview]);
  return null;
}

/** Share the stable link: the OS share sheet where there is one, else copy. */
export function ShareButton({ workId, title, url, tone = "light" }: { workId: string; title: string; url: string; tone?: "light" | "dark" }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    recordPublicEvent(workId, "share");
    const nav = typeof navigator !== "undefined" ? navigator : null;
    if (nav?.share) {
      try {
        await nav.share({ title, url });
        return;
      } catch {
        /* cancelled: fall back to copying */
      }
    }
    try {
      await nav?.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* nothing else to do */
    }
  }
  return (
    <button type="button" onClick={share} className="inline-flex min-h-11 items-center gap-1.5 px-2 text-[13.5px] font-medium">
      <span className={tone === "dark" ? "inline-flex items-center gap-1.5 text-white/85 hover:text-white" : "inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"}>
        {copied ? <Check className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
        {copied ? "Link copied" : "Share"}
      </span>
    </button>
  );
}
