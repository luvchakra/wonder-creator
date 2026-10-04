"use client";
import { Button, buttonClasses } from "@wonder/ui";
import { Check, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

/**
 * The one bar under a preview: this is what readers would see — publish it as a link (anyone with the link; the Creator
 * Page stays opt-in), or, once published, the live link to copy or open, and "Publish the latest version" when the
 * words moved on. Rights and access rules are unchanged.
 */
export function PreviewBar({ artifactId, back, url, published, changed, empty }: { artifactId: string; back: string; url: string | null; published: boolean; changed: boolean; empty: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  async function publish() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/artifacts/${artifactId}/publication`, { method: "POST", json: published ? {} : { visibility: "unlisted" } });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border-soft bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {error ? (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}
        {!url ? (
          <p className="text-[13.5px] text-ink-muted">
            Choose your handle on your Profile to get a link.{" "}
            <Link href="/me" className="font-medium text-accent-ink underline-offset-2 hover:underline">
              Open Profile
            </Link>
          </p>
        ) : published ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[13px] text-ink-muted">
              <span className="font-medium text-success-ink">Published</span> · {url.replace(/^https?:\/\//, "")}
            </p>
            <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard?.writeText(url).then(() => setCopied(true))}>
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Copied" : "Copy link"}
            </Button>
            <a href={url} target="_blank" rel="noreferrer" className={buttonClasses({ size: "sm", variant: "secondary" })}>
              <ExternalLink className="size-4" aria-hidden /> Open
            </a>
            {changed ? (
              <Button size="sm" loading={busy} onClick={publish}>
                Publish the latest version
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-[13px] text-ink-muted">This is what readers would see. Only people with the link can read it; your Creator Page stays off unless you turn it on.</p>
            <Button loading={busy} disabled={empty} onClick={publish}>
              Publish as link
            </Button>
          </div>
        )}
        <Link href={back} className="self-start text-[13px] font-medium text-ink-muted underline-offset-2 hover:underline">
          Back to writing
        </Link>
      </div>
    </div>
  );
}
