"use client";
import { artifactType } from "@wonder/creator-studio/types";
import { BACKGROUNDS, Badge, Button, EmptyState, ErrorState, buttonClasses, cn } from "@wonder/ui";
import { Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MaterialVisual, type MaterialCardData } from "@/components/cards";
import { api, errorMessage } from "@/lib/client";
import { PENDING_TURN_KEY, type PendingTurn } from "@/lib/send";
import { VisualDirections } from "@/components/visual-directions";

interface Direction {
  title: string;
  artifactType: string;
  description: string;
  why: string;
  styleTags: string[];
  materialIds: string[];
}

export function Discover({ materials }: { materials: MaterialCardData[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(materials.slice(0, 4).map((m) => m.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explored, setExplored] = useState<string[]>([]);
  const [result, setResult] = useState<{ intro: string; understanding: { summary: string; themes: string[] } | null; directions: Direction[] } | null>(null);

  if (!materials.length) {
    return (
      <EmptyState
        image={BACKGROUNDS.mistyMountains}
        title="Bring some material first"
        body="Discovery works from what you've brought: notes, photos, voice memos or links. Add a few and come back."
        action={
          <Link href="/send" className={buttonClasses({})}>
            Open CreatorSend
          </Link>
        }
      />
    );
  }

  async function explore() {
    setBusy(true);
    setError(null);
    try {
      setResult(await api("/api/v1/brain/discover", { method: "POST", json: { materialIds: selected, instruction: "I don't know what this should become. What could it be?" } }));
      setExplored(selected.slice(0, 4));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function create(d: Direction) {
    const pending: PendingTurn = { message: `Create ${d.title.toLowerCase()} — ${d.description}`, materialIds: d.materialIds, inputMode: "text" };
    sessionStorage.setItem(PENDING_TURN_KEY, JSON.stringify(pending));
    router.push("/create?pending=1");
  }

  return (
    <div className="space-y-8">
      <section aria-label="Choose material">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink">Your material ({selected.length} selected)</h2>
          <Button onClick={explore} loading={busy} disabled={!selected.length}>
            <Sparkles className="size-4" aria-hidden /> {result ? "Explore again" : "Show me directions"}
          </Button>
        </div>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {materials.map((m) => {
            const on = selected.includes(m.id);
            return (
              <li key={m.id}>
                <button type="button" aria-pressed={on} onClick={() => setSelected((s) => (on ? s.filter((x) => x !== m.id) : [...s, m.id].slice(0, 12)))} className={cn("relative block w-full overflow-hidden rounded-xl border-2 text-left", on ? "border-accent" : "border-transparent")}>
                  <div className="aspect-square">
                    <MaterialVisual m={m} />
                  </div>
                  {on ? (
                    <span className="absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-accent text-white">
                      <Check className="size-4" aria-hidden />
                    </span>
                  ) : null}
                  <span className="block truncate bg-surface px-2 py-1 text-xs text-ink-muted">{m.title || "Untitled"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {error ? <ErrorState body={error} onRetry={explore} /> : null}

      {result ? (
        <section aria-label="Directions" className="space-y-4">
          {result.understanding ? <p className="max-w-3xl text-[15px] text-ink-muted">{result.understanding.summary}</p> : null}
          <p className="font-medium text-ink">{result.intro}</p>
          {/* Ways it could look, from the same Materials (image-generation §29); made only when asked, kept until they change. */}
          {explored.length ? <VisualDirections materialIds={explored} purpose="explore" title="Ways this could look" /> : null}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.directions.map((d) => (
              <li key={d.title} className="flex flex-col overflow-hidden rounded-2xl border border-border-soft bg-surface shadow-[var(--shadow-card)]">
                <div className="grid h-28 grid-cols-3 gap-0.5">
                  {d.materialIds
                    .slice(0, 3)
                    .map((id) => materials.find((m) => m.id === id))
                    .filter(Boolean)
                    .map((m) => (
                      <MaterialVisual key={m!.id} m={m!} />
                    ))}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-xs text-ink-subtle">{artifactType(d.artifactType).label}</p>
                  <h3 className="mt-0.5 font-semibold text-ink">{d.title}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{d.description}</p>
                  <p className="mt-2 text-sm text-ink-subtle">
                    <span className="font-medium text-ink-muted">Why: </span>
                    {d.why}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {d.styleTags.slice(0, 3).map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                  <Button size="sm" className="mt-auto self-start" onClick={() => create(d)}>
                    Create this direction →
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
