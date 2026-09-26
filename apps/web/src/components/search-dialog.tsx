"use client";
import { Dialog, DialogContent, Input, LiveBadge, Spinner } from "@wonder/ui";
import { FileText, MessageCircle, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client";

interface Results {
  materials: Array<{ id: string; title: string | null; type: string }>;
  artifacts: Array<{ id: string; title: string; artifact_type: string }>;
  creators: Array<{ id: string; display_name: string; handle: string }>;
  conversations: Array<{ id: string; conversationId: string; title: string; snippet: string }>;
  huddles: Array<{ huddleId: string; topic: string | null; participantNames: string[] }>;
}

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setRes(null);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setRes(await api<Results>(`/api/v1/search?q=${encodeURIComponent(q)}`));
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const close = () => onOpenChange(false);
  const empty = res && !res.materials.length && !res.artifacts.length && !res.creators.length && !res.conversations.length && !res.huddles.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Search" description="Materials, creations, creators, conversations and live Huddles." wide>
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search anything…" aria-label="Search" />
        <div className="mt-4 min-h-24 space-y-5" aria-live="polite">
          {loading ? <Spinner label="Searching" /> : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {empty ? <p className="text-sm text-ink-muted">Nothing found for “{q}”. Try another word.</p> : null}
          {res ? (
            <>
              <Group title="Your creations" items={res.artifacts.map((a) => ({ href: `/artifacts/${a.id}`, label: a.title, icon: <Sparkles className="size-4" /> }))} onPick={close} />
              <Group title="Your material" items={res.materials.map((m) => ({ href: `/space/materials/${m.id}`, label: m.title || "Untitled", icon: <FileText className="size-4" /> }))} onPick={close} />
              <Group title="Conversations" items={res.conversations.map((c) => ({ href: `/create?c=${c.conversationId}`, label: c.title, sub: c.snippet, icon: <MessageCircle className="size-4" /> }))} onPick={close} />
              <Group title="Creators" items={res.creators.map((c) => ({ href: `/creators/${c.handle}`, label: c.display_name, sub: `@${c.handle}`, icon: <UserRound className="size-4" /> }))} onPick={close} />
              <Group title="Live now" items={res.huddles.map((h) => ({ href: `/huddles/${h.huddleId}`, label: h.topic || h.participantNames.join(" · "), icon: <LiveBadge /> }))} onPick={close} />
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Group({ title, items, onPick }: { title: string; items: Array<{ href: string; label: string; sub?: string; icon: React.ReactNode }>; onPick: () => void }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{title}</h3>
      <ul>
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} onClick={onPick} className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-muted">
              <span className="text-ink-subtle">{i.icon}</span>
              <span className="min-w-0">
                <span className="block text-[15px] text-ink">{i.label}</span>
                {i.sub ? <span className="block truncate text-sm text-ink-subtle">{i.sub}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
