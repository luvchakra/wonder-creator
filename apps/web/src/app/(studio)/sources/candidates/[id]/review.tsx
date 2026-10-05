"use client";
import { KIT, KitArt } from "@wonder/ui";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { ItemPicker } from "@/components/sources/item-picker";
import { api } from "@/lib/client";
import type { CandidateCard, CandidateItem } from "@/lib/sources";
import { BackLink } from "@/components/back-link";

export function ReviewCandidate({
  c,
}: {
  c: CandidateCard & { items: CandidateItem[] };
}) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-2xl pb-4">
      <BackLink home="/sources" homeLabel="From your world" />
      <header className="relative isolate overflow-hidden rounded-2xl border border-border-soft bg-[image:var(--gradient-card)] px-4 py-4 shadow-[var(--shadow-card)]">
        <KitArt
          art={KIT.wash.washLavender}
          sizes="(min-width: 640px) 42rem, 100vw"
          priority
          className="absolute inset-0 -z-10 size-full object-cover opacity-70"
        />
        <KitArt
          art={KIT.painted.blossomSprig}
          sizes="7rem"
          priority
          className="pointer-events-none absolute -bottom-3 -right-2 -z-10 h-auto w-24 opacity-90"
        />
        <h1 className="pr-16 font-display text-[28px] leading-tight text-ink">
          {c.title}
        </h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">{c.counts}</p>
        {c.quote ? (
          <p className="mt-2 pr-14 font-display text-[16px] italic leading-snug text-ink">
            “{c.quote}”
          </p>
        ) : c.explanation ? (
          <p className="mt-1.5 pr-14 text-[13.5px] text-ink-muted">
            {c.explanation}
          </p>
        ) : null}
      </header>
      {c.suggestion ? (
        <p className="mt-2 flex gap-2 rounded-2xl bg-accent-softer/70 px-3 py-2 text-[13.5px] leading-snug text-ink">
          <Sparkles
            className="mt-0.5 size-4 shrink-0 text-accent"
            aria-hidden
          />
          <span>
            <span className="sr-only">CreativeMind suggests: </span>
            {c.suggestion}
          </span>
        </p>
      ) : null}
      <p className="mt-2 text-[13px] text-ink-muted">
        Choose what to bring in. The rest stays where it is.
      </p>

      <ItemPicker
        items={c.items}
        importUrl={`/api/v1/personal-sources/candidates/${c.id}/import`}
        onDismiss={async () => {
          await api(`/api/v1/personal-sources/candidates/${c.id}/dismiss`, {
            method: "POST",
          });
          router.replace("/sources");
          router.refresh();
        }}
      />
    </div>
  );
}
