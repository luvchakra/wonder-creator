"use client";
import type { RunProgress } from "@wonder/creator-brain";
import { Button, ErrorState, buttonClasses, cn } from "@wonder/ui";
import { ArrowUpRight, Check, CircleAlert, CircleDashed, CircleSlash, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client";

const POLL_MS = 1500;

const STATUS_TEXT: Record<RunProgress["run"]["status"], string> = {
  running: "Working",
  succeeded: "Done",
  failed: "Didn't finish",
  cancelled: "Stopped",
  interrupted: "Interrupted",
};

/** Plain-language reasons for failure codes; never internal details. */
const FAILURE_TEXT: Record<string, string> = {
  provider_unavailable: "The AI service isn't available right now. Your material and request are saved, so you can try again once it's back.",
  provider_failed: "The AI service didn't return a usable result this time. Trying again usually works.",
  rate_limited: "Too many requests at once. Wait a moment, then try again.",
  forbidden: "Your autonomy settings don't allow CreativeMind to do this on its own.",
  cancelled: "You stopped this run before it saved anything.",
  interrupted: "This run stopped unexpectedly (the server was interrupted). Nothing was saved from it.",
  validation: "Something about the request wasn't valid.",
  internal: "Something went wrong on our side. Nothing you shared was lost.",
};

export function RunView({ initial, providerLive }: { initial: RunProgress; providerLive: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [busy, setBusy] = useState<"cancel" | "retry" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = p.run.status === "running";

  // Poll the persisted stages while the run is going; the run itself doesn't depend on this page.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      try {
        setP(await api<RunProgress>(`/api/v1/brain/runs/${p.run.id}`));
      } catch {
        /* keep the last known state; the next poll will try again */
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [running, p.run.id]);

  const current = p.stages.find((s) => s.state === "current");
  const failureText = p.run.failureCode ? (FAILURE_TEXT[p.run.failureCode] ?? FAILURE_TEXT.internal) : null;
  const backToTalk = p.run.conversationId ? `/create?c=${p.run.conversationId}` : "/create";

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={backToTalk} className="text-sm text-accent-ink hover:underline">
        ← Back to the conversation
      </Link>
      <header className="mt-3">
        <p className="text-sm text-ink-subtle" role="status">
          {STATUS_TEXT[p.run.status]}
          {p.run.cancelRequested && running ? " · stopping after this step" : ""}
        </p>
        <h1 className="font-display text-3xl text-ink">{running ? (current?.label ?? "Getting started") : p.run.status === "succeeded" ? "Your draft is ready" : "This run didn't finish"}</h1>
        {running ? <p className="mt-1 text-ink-muted">You can leave this page — CreativeMind keeps working, and the result appears in your conversation.</p> : null}
      </header>

      {!providerLive && (running || p.run.failureCode === "provider_unavailable") ? (
        <p className="mt-4 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning-ink">AI isn&apos;t connected, so drafts come from the offline development model (placeholders, not real AI writing).</p>
      ) : null}

      <ol className="mt-6 space-y-1" aria-label="Stages">
        {p.stages.map((s) => (
          <li
            key={s.step}
            aria-current={s.state === "current" ? "step" : undefined}
            className={cn("flex items-start gap-3 rounded-2xl px-4 py-3", s.state === "current" ? "bg-surface shadow-[var(--shadow-card)]" : "")}
          >
            <StageIcon state={s.state} />
            <div className="min-w-0">
              <p className={cn("text-[15px]", s.state === "current" ? "font-medium text-ink" : s.state === "pending" ? "text-ink-subtle" : "text-ink-muted")}>{s.label}</p>
              <p className="text-xs text-ink-subtle">
                {s.state === "done" ? "Done" : s.state === "current" ? "In progress" : s.state === "skipped" ? (s.note ?? "Not needed this time") : s.state === "failed" ? "Stopped here" : "Waiting"}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {failureText && !running ? (
        <div className="mt-6">
          <ErrorState title={p.run.status === "cancelled" ? "Stopped" : "What happened"} body={failureText} />
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-6 flex flex-wrap gap-2">
        {p.artifact ? (
          <>
            <Link href={`/artifacts/${p.artifact.id}/studio`} className={buttonClasses({})}>
              Open “{p.artifact.title}” in the Creative Studio
            </Link>
            <Link href={`/artifacts/${p.artifact.id}`} className={buttonClasses({ variant: "secondary" })}>
              View <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </>
        ) : null}
        {p.run.canCancel ? (
          <Button
            variant="secondary"
            loading={busy === "cancel"}
            onClick={async () => {
              setBusy("cancel");
              setError(null);
              try {
                await api(`/api/v1/brain/runs/${p.run.id}/cancel`, { method: "POST" });
                setP(await api<RunProgress>(`/api/v1/brain/runs/${p.run.id}`));
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(null);
              }
            }}
          >
            <CircleSlash className="size-4" aria-hidden /> Stop
          </Button>
        ) : null}
        {p.run.canRetry ? (
          <Button
            loading={busy === "retry"}
            onClick={async () => {
              setBusy("retry");
              setError(null);
              try {
                // The retry streams like a turn; wait for the new run id, then follow it.
                const res = await fetch(`/api/v1/brain/runs/${p.run.id}/retry`, { method: "POST" });
                if (!res.ok || !res.body) throw new Error(((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ?? "That didn't start. Please try again.");
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buf = "";
                for (;;) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buf += decoder.decode(value, { stream: true });
                  const lines = buf.split("\n");
                  buf = lines.pop() ?? "";
                  for (const line of lines) {
                    if (!line.trim()) continue;
                    const ev = JSON.parse(line) as { type: string; runId?: string; message?: string };
                    if (ev.type === "run" && ev.runId) {
                      void reader.cancel();
                      router.push(`/create/runs/${ev.runId}`);
                      return;
                    }
                    if (ev.type === "error") throw new Error(ev.message);
                  }
                }
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(null);
              }
            }}
          >
            Try again
          </Button>
        ) : null}
        {p.run.retriedBy ? (
          <Link href={`/create/runs/${p.run.retriedBy}`} className={buttonClasses({ variant: "secondary" })}>
            See the retry
          </Link>
        ) : null}
        {!running ? (
          <Link href={backToTalk} className={buttonClasses({ variant: "ghost" })}>
            <MessageCircle className="size-4" aria-hidden /> Back to the conversation
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function StageIcon({ state }: { state: RunProgress["stages"][number]["state"] }) {
  if (state === "done") return <Check className="mt-0.5 size-5 shrink-0 text-success-ink" aria-label="Done" />;
  if (state === "current") return <span className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-accent/30 border-t-accent motion-safe:animate-spin" aria-label="In progress" />;
  if (state === "failed") return <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-label="Stopped here" />;
  if (state === "skipped") return <CircleSlash className="mt-0.5 size-5 shrink-0 text-ink-subtle" aria-label="Skipped" />;
  return <CircleDashed className="mt-0.5 size-5 shrink-0 text-ink-subtle" aria-label="Waiting" />;
}
