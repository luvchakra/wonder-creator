"use client";
import type { HuddleSummary } from "@wonder/creator-huddle";
import { Avatar, Button, EmptyState, Field, Textarea, buttonClasses } from "@wonder/ui";
import { Radio, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocalTime } from "@/components/client-time";
import { api, errorMessage } from "@/lib/client";
import { BackLink } from "@/components/back-link";

function duration(from: string, to: string | null): string {
  if (!to) return "still going";
  const mins = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

export function SummaryView({ summary: s }: { summary: HuddleSummary }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = !s.endedAt && !s.leftAt;
  const savedIds = s.saved.map((x) => x.materialId).filter((x): x is string => !!x);

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink home="/huddles" homeLabel="Huddles" />
      <h1 className="mt-2 font-display text-[28px] leading-tight text-ink">{s.topic ? `Talking about ${s.topic}` : "Your Huddle"}</h1>
      <p className="mt-1 text-[15px] text-ink-muted">
        <LocalTime iso={s.joinedAt} /> · {duration(s.joinedAt, s.leftAt ?? s.endedAt)} · {s.role === "host" ? "you started it" : "you joined"}
      </p>
      {live ? (
        <Link href={`/huddles/${s.huddleId}`} className={buttonClasses({ className: "mt-4" })}>
          <Radio className="size-4" aria-hidden /> Back to the Huddle
        </Link>
      ) : (
        <p className="mt-4 rounded-xl bg-surface-muted p-3 text-sm text-ink-muted">{s.endedAt ? "This Huddle has ended." : "You left this Huddle."} Its chat isn&apos;t kept; only what you saved is.</p>
      )}

      <section aria-labelledby="met-h" className="mt-8">
        <h2 id="met-h" className="text-lg font-semibold text-ink">
          People you met
        </h2>
        {s.met.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {s.met.map((p) => (
              <li key={p.id}>
                {p.handle ? (
                  <Link href={`/creators/${p.handle}`} className="flex min-h-11 items-center gap-3 rounded-xl border border-border-soft bg-surface px-3 py-2 hover:bg-black/[0.02]">
                    <Avatar name={p.name} size={32} />
                    <span className="text-[15px] text-ink">{p.name}</span>
                  </Link>
                ) : (
                  <span className="flex min-h-11 items-center gap-3 rounded-xl border border-border-soft bg-surface px-3 py-2">
                    <Avatar name={p.name} size={32} />
                    <span className="text-[15px] text-ink">{p.name}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[15px] text-ink-muted">{s.endedAt ? "Nobody else joined this time." : "Shown once the Huddle ends."}</p>
        )}
      </section>

      <section aria-labelledby="saved-h" className="mt-8">
        <h2 id="saved-h" className="text-lg font-semibold text-ink">
          What you saved
        </h2>
        {s.saved.length ? (
          <ul className="mt-3 divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface">
            {s.saved.map((x) => (
              <li key={x.id}>
                {x.materialId ? (
                  <Link href={`/materials/${x.materialId}`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 hover:bg-black/[0.02]">
                    <span className="truncate text-[15px] text-ink">{x.title || "Untitled"}</span>
                    <span className="text-sm text-ink-muted">{x.kind === "idea" ? "Idea" : "Note"}</span>
                  </Link>
                ) : (
                  <span className="block px-4 py-3 text-[15px] text-ink-muted">Something you saved was removed.</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState className="mt-3" title="Nothing saved" body="Add a note below about what came up, while it's fresh." />
        )}
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api(`/api/v1/huddles/${s.huddleId}/preserve`, { method: "POST", json: { kind: "idea", text: note } });
              setNote("");
              router.refresh();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Add a note from this Huddle" htmlFor="summary-note" hint="Your own words, saved as an idea in your Creative Space." error={error}>
            <Textarea id="summary-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={20000} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" loading={busy} disabled={!note.trim()}>
              Save note
            </Button>
          </div>
        </form>
      </section>

      <section aria-labelledby="next-h" className="mt-8">
        <h2 id="next-h" className="text-lg font-semibold text-ink">
          What next
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {savedIds.length ? (
            <Link href={`/create?materials=${savedIds.join(",")}`} className={buttonClasses({})}>
              <Sparkles className="size-4" aria-hidden /> Create from what you saved
            </Link>
          ) : null}
          <Link href="/huddles" className={buttonClasses({ variant: "secondary" })}>
            <Radio className="size-4" aria-hidden /> Start another Huddle
          </Link>
        </div>
      </section>
    </div>
  );
}
