"use client";
import { Button } from "@wonder/ui";
import Link from "next/link";

export default function StudioError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-3xl border border-border-soft bg-surface p-8 text-center">
      <h1 className="font-display text-3xl text-ink">Something didn&apos;t load</h1>
      <p className="mt-2 text-ink-muted">Nothing you shared was lost. Try again, or head back home.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className="inline-flex h-11 items-center rounded-full px-5 text-ink-muted hover:bg-black/5">
          Home
        </Link>
      </div>
    </div>
  );
}
