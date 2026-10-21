"use client";
import { Button } from "@wonder/ui";
import { Check, Share2 } from "lucide-react";
import { useState } from "react";

/** Share: the phone's share sheet where there is one, else the link copied. */
export function ShareJob({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title, url });
      } catch {
        /* closed */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard refused: nothing else to do */
    }
  }
  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => void share()}>
        {copied ? <Check className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />} {copied ? "Link copied" : "Share"}
      </Button>
      <span role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </>
  );
}
