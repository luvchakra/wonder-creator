"use client";
import { REPLY_POLICIES, SCRAPBOOK_KINDS, type ScrapbookPost } from "@wonder/creator-library/scrapbook-options";
import { Button, ChoiceChip, Dialog, DialogContent, EmptyState, Field, Select, Textarea, cn } from "@wonder/ui";
import { Paperclip } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScrapbookPostCard } from "@/components/scrapbook-post";
import { api, errorMessage } from "@/lib/client";

type Option = { id: string; title: string; type: string };
type Feed = { posts: ScrapbookPost[]; nextBefore: string | null };

export function ScrapbookFeed({ tab, initial, attachable }: { tab: "everyone" | "following"; initial: Feed; attachable: { materials: Option[]; pieces: Option[] } }) {
  const router = useRouter();
  const [posts, setPosts] = useState(initial.posts);
  const [nextBefore, setNextBefore] = useState(initial.nextBefore);
  const [loading, setLoading] = useState(false);

  return (
    <div>
      <Composer
        attachable={attachable}
        onPosted={async () => {
          const f = await api<Feed>(`/api/v1/scrapbook?scope=${tab}`);
          setPosts(f.posts);
          setNextBefore(f.nextBefore);
          router.refresh();
        }}
      />
      <nav aria-label="Scrapbook feeds" className="mt-8 flex gap-1">
        {(["everyone", "following"] as const).map((t) => (
          <Link
            key={t}
            href={t === "everyone" ? "/scrapbook" : "/scrapbook?tab=following"}
            aria-current={t === tab ? "page" : undefined}
            className={cn("inline-flex min-h-11 items-center rounded-full px-4 text-sm", t === tab ? "bg-accent font-medium text-white" : "text-ink-muted hover:bg-black/[0.04]")}
          >
            {t === "everyone" ? "Everyone" : "People you follow"}
          </Link>
        ))}
      </nav>
      <p className="mt-2 text-sm text-ink-muted">Newest first. Nothing here is ranked or counted.</p>
      {posts.length ? (
        <ol className="mt-4 space-y-4" aria-label="Posts">
          {posts.map((p) => (
            <li key={p.id}>
              <ScrapbookPostCard post={p} />
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState className="mt-4" title="Nothing here yet" body={tab === "following" ? "When people you follow share something, it shows here." : "Be the first to share a thought or a sketch."} />
      )}
      {nextBefore ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            loading={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const f = await api<Feed>(`/api/v1/scrapbook?scope=${tab}&before=${encodeURIComponent(nextBefore)}`);
                setPosts((p) => [...p, ...f.posts]);
                setNextBefore(f.nextBefore);
              } finally {
                setLoading(false);
              }
            }}
          >
            Show older
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Composer({ attachable, onPosted }: { attachable: { materials: Option[]; pieces: Option[] }; onPosted: () => Promise<void> }) {
  const [kind, setKind] = useState("thought");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [replyPolicy, setReplyPolicy] = useState("anyone");
  const [materialIds, setMaterialIds] = useState<string[]>([]);
  const [artifactIds, setArtifactIds] = useState<string[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attachedTitles = [...attachable.materials.filter((m) => materialIds.includes(m.id)), ...attachable.pieces.filter((p) => artifactIds.includes(p.id))].map((x) => x.title);

  return (
    <form
      aria-label="Share to your Scrapbook"
      className="rounded-2xl border border-border-soft bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api("/api/v1/scrapbook", { method: "POST", json: { kind, body, visibility, replyPolicy, materialIds, artifactIds } });
          setBody("");
          setMaterialIds([]);
          setArtifactIds([]);
          await onPosted();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset>
        <legend className="sr-only">Kind</legend>
        <div className="flex flex-wrap gap-2">
          {SCRAPBOOK_KINDS.map((k) => (
            <ChoiceChip key={k.value} selected={kind === k.value} onToggle={() => setKind(k.value)}>
              {k.label}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>
      <Field label="What's on your mind?" htmlFor="sb-body" className="mt-3" error={error}>
        <Textarea id="sb-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={4} placeholder="A line, a question, a half-formed idea…" />
      </Field>
      {attachedTitles.length ? <p className="mt-2 text-sm text-ink-muted">Attached: {attachedTitles.join(", ")}</p> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Who can see it" htmlFor="sb-visibility">
          <Select id="sb-visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as "public")}>
            <option value="public">People who can see your profile</option>
            <option value="private">Only you</option>
          </Select>
        </Field>
        <Field label="Who can reply" htmlFor="sb-replies">
          <Select id="sb-replies" value={replyPolicy} onChange={(e) => setReplyPolicy(e.target.value)} disabled={visibility === "private"}>
            {REPLY_POLICIES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => setAttachOpen(true)}>
          <Paperclip className="size-4" aria-hidden /> Attach
        </Button>
        <Button type="submit" loading={busy} disabled={!body.trim() && !materialIds.length && !artifactIds.length}>
          Share
        </Button>
      </div>
      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent title="Attach your work" description="Attaching shares it with everyone who can see this post: its title, a short excerpt and its file. Nothing else from your Space.">
          <AttachList title="Material" options={attachable.materials} selected={materialIds} onChange={setMaterialIds} />
          <AttachList title="Creations" options={attachable.pieces} selected={artifactIds} onChange={setArtifactIds} note="People see the title; they can open it only if the Creation is already visible to them." />
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setAttachOpen(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}

function AttachList({ title, options, selected, onChange, note }: { title: string; options: Option[]; selected: string[]; onChange: (ids: string[]) => void; note?: string }) {
  return (
    <fieldset className="mt-3">
      <legend className="text-sm font-medium text-ink">{title}</legend>
      {note ? <p className="text-sm text-ink-muted">{note}</p> : null}
      {options.length ? (
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
          {options.map((o) => (
            <li key={o.id}>
              <label className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-black/[0.03]">
                <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={selected.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...selected, o.id].slice(0, 6) : selected.filter((x) => x !== o.id))} />
                <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{o.title}</span>
                <span className="text-sm text-ink-muted">{o.type.replace(/_/g, " ")}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-ink-muted">Nothing to attach yet.</p>
      )}
    </fieldset>
  );
}
