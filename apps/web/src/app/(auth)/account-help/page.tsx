import type { Metadata } from "next";
import Link from "next/link";
import { publicHelpTopics } from "@/lib/help/public";

export const metadata: Metadata = {
  title: "Account help",
  description: "Creating an account, signing in, two-step verification and getting back in if you're locked out.",
};

/**
 * Account help: the part of Help that stays public (docs/help.md › What stays public) — creating an account, signing in
 * and getting back in. Rendered on the server with plain disclosure, so no help search or other topics reach a signed-out
 * browser. The rest of Help is at /help, after signing in.
 */
export default function AccountHelpPage() {
  const topics = publicHelpTopics();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-ink">Account help</h1>
        <p className="mt-1.5 text-ink-muted">Creating an account, signing in, and getting back in.</p>
      </div>
      <ul className="space-y-2">
        {topics.map((t) => (
          <li key={t.slug}>
            <details id={t.slug} className="group rounded-2xl border border-border-soft bg-surface/90 px-4 open:pb-3">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 py-2 text-[15px] font-medium text-ink">
                {t.title}
                <span aria-hidden className="text-ink-subtle transition-transform group-open:rotate-180 motion-reduce:transition-none">⌄</span>
              </summary>
              <p className="text-[14px] text-ink-muted">{t.summary}</p>
              {t.steps?.length ? (
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[14px] text-ink">
                  {t.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              ) : null}
              {t.notes?.length ? (
                <ul className="mt-2 space-y-1 text-[13px] text-ink-muted">
                  {t.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              ) : null}
              {t.links?.length ? (
                <p className="mt-2 flex flex-wrap gap-x-4 text-[14px]">
                  {t.links.map((l) => (
                    <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center font-medium text-accent-ink hover:underline">
                      {l.label}
                    </Link>
                  ))}
                </p>
              ) : null}
            </details>
          </li>
        ))}
      </ul>
      <p className="text-[14px] text-ink-muted">
        Still stuck?{" "}
        <Link href="/contact" className="inline-flex min-h-11 items-center font-medium text-accent-ink hover:underline">
          Send us a message
        </Link>{" "}
        ·{" "}
        <Link href="/sign-in" className="inline-flex min-h-11 items-center font-medium text-accent-ink hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
