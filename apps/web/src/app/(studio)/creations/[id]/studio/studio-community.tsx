"use client";
import type { WorkingSetView } from "@wonder/creator-studio/working-set";
import { Button, Dialog, DialogContent, Input, KIT, Menu, MenuContent, MenuItem, MenuTrigger, Textarea, cn } from "@wonder/ui";
import { ArrowLeft, Check, ChevronRight, MessagesSquare, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RelativeTime } from "@/components/client-time";
import { api, errorMessage } from "@/lib/client";
import type { MomentView } from "@/lib/moments";

/**
 * Phase 04 — the Studio's doors to DejaVu and Community (docs/studio-integration.md). Sheets over the Studio, never
 * a page away: Bring in → DejaVu (choose Moments, they arrive Available), the replies to what the creator asked about
 * this Creation, and Ask Community about one part of it (only that part is shared).
 */

/* ---------------------------------------------------------------- DejaVu intake (§4) */

const DV_FILTERS = [
  { key: "all", label: "All" },
  { key: "photos", label: "Photos" },
  { key: "voice", label: "Voice" },
  { key: "notes", label: "Notes" },
  { key: "creations", label: "Creations" },
  { key: "conversations", label: "Conversations" },
] as const;
type DvFilter = (typeof DV_FILTERS)[number]["key"];
const BRINGABLE = new Set(["material", "creation", "conversation", "scrapbook_entry"]);
function dvKind(m: MomentView): Exclude<DvFilter, "all"> {
  if (m.entityType === "creation" || m.entityType === "creation_fragment" || m.entityType === "published_work") return "creations";
  if (m.entityType === "conversation" || m.entityType === "conversation_reply") return "conversations";
  if (m.subtype === "image" || m.subtype === "sketch" || m.previewKind === "image") return "photos";
  if (m.entityType === "voice_note" || m.subtype === "voice" || m.subtype === "audio") return "voice";
  return "notes";
}
const MOMENT_LABEL: Record<string, string> = { photos: "Photo", voice: "Voice note", notes: "Note", creations: "Creation", conversations: "Conversation" };

export function DejaVuIntake({
  sessionId,
  dejavuId: initialDejavu,
  onAdded,
}: {
  sessionId: string;
  /** Start inside this DejaVu (the one being explored); otherwise the list of DejaVus comes first. */
  dejavuId?: string | null;
  onAdded: (next: WorkingSetView, added: number) => void;
}) {
  const [list, setList] = useState<Array<{ id: string; name: string; count: number }> | null>(null);
  const [dv, setDv] = useState<{ id: string; name: string } | null>(initialDejavu ? { id: initialDejavu, name: "" } : null);
  const [moments, setMoments] = useState<MomentView[] | null>(null);
  const [filter, setFilter] = useState<DvFilter>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api<{ dejavus: Array<{ id: string; name: string; count: number }> }>("/api/v1/dejavus?counts=1")
      .then((r) => live && setList(r.dejavus))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, []);
  const dvId = dv?.id ?? null;
  useEffect(() => {
    if (!dvId) return;
    let live = true;
    api<{ items: MomentView[] }>(`/api/v1/dejavus/${dvId}/moments?limit=60`)
      .then((r) => live && setMoments(r.items))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [dvId]);

  async function add() {
    if (!dv || !picked.size) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ added: number; workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${sessionId}/sources/from-dejavu`, { method: "POST", json: { dejavuId: dv.id, momentIds: [...picked] } });
      setPicked(new Set());
      onAdded(r.workingSet, r.added);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!dv) {
    return (
      <div className="space-y-2">
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        {!list ? <p className="text-sm text-ink-muted">Looking…</p> : null}
        {list && !list.length ? <p className="text-sm text-ink-muted">No DejaVus yet. Connect Moments with a DejaVu and they’ll be here.</p> : null}
        {list?.length ? (
          <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft" aria-label="DejaVus">
            {list.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => setDv({ id: d.id, name: d.name })} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-black/[0.02]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium text-ink">{d.name}</span>
                    <span className="block text-[12.5px] text-ink-subtle">
                      {d.count} {d.count === 1 ? "Moment" : "Moments"}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-ink-subtle" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  const name = dv.name || list?.find((d) => d.id === dv.id)?.name || "DejaVu";
  const all = moments ?? [];
  const counts = Object.fromEntries(DV_FILTERS.map((f) => [f.key, f.key === "all" ? all.length : all.filter((m) => dvKind(m) === f.key).length])) as Record<DvFilter, number>;
  const shown = filter === "all" ? all : all.filter((m) => dvKind(m) === filter);
  return (
    <div className="space-y-2.5 pb-14">
      <div className="flex items-center gap-1">
        {!initialDejavu ? (
          <button type="button" onClick={() => setDv(null)} aria-label="All DejaVus" className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-black/5">
            <ArrowLeft className="size-5" aria-hidden />
          </button>
        ) : null}
        <p className="min-w-0 flex-1">
          <span className="block truncate font-display text-[17px] text-ink">{name}</span>
          <span className="block text-[12.5px] text-ink-subtle">{moments ? `${all.length} ${all.length === 1 ? "Moment" : "Moments"} · choose what to bring in` : "Loading…"}</span>
        </p>
      </div>
      <div role="radiogroup" aria-label="Kind of Moment" className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
        {DV_FILTERS.filter((f) => f.key === "all" || counts[f.key] > 0).map((f) => (
          <button key={f.key} type="button" role="radio" aria-checked={filter === f.key} onClick={() => setFilter(f.key)} className="inline-flex min-h-11 shrink-0 items-center">
            <span className={cn("inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px]", filter === f.key ? "bg-accent-soft font-medium text-accent-ink" : "bg-surface-muted text-ink-muted")}>
              {f.label} <span className="text-[11px] opacity-70">({counts[f.key]})</span>
            </span>
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {moments && !shown.length ? <p className="text-sm text-ink-muted">Nothing of this kind here.</p> : null}
      {shown.length ? (
        <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft" aria-label="Moments">
          {shown.map((m) => {
            const can = BRINGABLE.has(m.entityType);
            const on = picked.has(m.id);
            const title = m.title?.trim() || m.excerpt?.split("\n")[0]?.trim().slice(0, 80) || `Untitled ${MOMENT_LABEL[dvKind(m)]!.toLowerCase()}`;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={!can}
                  onClick={() =>
                    setPicked((s) => {
                      const n = new Set(s);
                      if (n.has(m.id)) n.delete(m.id);
                      else n.add(m.id);
                      return n;
                    })
                  }
                  className="flex min-h-12 w-full items-center gap-2.5 px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                >
                  <span aria-hidden className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-md border", on ? "border-accent bg-accent text-white" : "border-border bg-surface")}>
                    {on ? <Check className="size-3.5" /> : null}
                  </span>
                  {m.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.thumbUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-[11px] text-ink-subtle">
                      {MOMENT_LABEL[dvKind(m)]!.slice(0, 1)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{title}</span>
                    <span className="block truncate text-[12px] text-ink-subtle">
                      {MOMENT_LABEL[dvKind(m)]} · <RelativeTime iso={m.occurredAt} />
                      {can ? "" : " · can’t be brought in yet"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {picked.size ? (
        <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border-soft bg-surface px-5 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:absolute sm:rounded-b-3xl">
          <span className="text-sm text-ink">{picked.size} selected</span>
          <Button loading={busy} onClick={add}>
            Add to Studio
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function DejaVuIntakeSheet({
  open,
  onOpenChange,
  sessionId,
  dejavuId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sessionId: string | null;
  dejavuId: string | null;
  onAdded: (next: WorkingSetView, added: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Bring in from a DejaVu" description="Choose the Moments you want. They wait on the Working Table until you use them." art={KIT.painted.leafSprigSage} wide>
        {open && sessionId ? <DejaVuIntake sessionId={sessionId} dejavuId={dejavuId} onAdded={onAdded} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Community responses (§14) */

export interface ResponsesSummary {
  total: number;
  fresh: number;
  conversations: number;
}
interface Response {
  id: string;
  conversationId: string;
  conversationTitle: string;
  about: string | null;
  body: string;
  author: { id: string; name: string; handle: string | null };
  createdAt: string;
  isNew: boolean;
  inSet: boolean;
}

/** "7 community responses · 2 new" — how the Studio mentions replies (null: nothing asked, or nothing yet). */
export function responsesLine(s: ResponsesSummary | null): string | null {
  if (!s?.total) return null;
  return `${s.total} ${s.total === 1 ? "response" : "responses"} from Pulse${s.fresh ? ` · ${s.fresh} new` : ""}`;
}

export function useCommunityResponses(sessionId: string | null, refreshKey: number) {
  const [data, setData] = useState<(ResponsesSummary & { responses: Response[] }) | null>(null);
  useEffect(() => {
    if (!sessionId) return;
    let live = true;
    api<ResponsesSummary & { responses: Response[] }>(`/api/v1/studio-sessions/${sessionId}/community-responses`)
      .then((r) => live && setData(r))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [sessionId, refreshKey]);
  return [data, setData] as const;
}

export function CommunityResponsesSheet({
  open,
  onOpenChange,
  sessionId,
  data,
  onChanged,
  onSet,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sessionId: string | null;
  data: (ResponsesSummary & { responses: Response[] }) | null;
  onChanged: () => void;
  onSet: (next: WorkingSetView) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function act(r: Response, what: "use" | "save" | "dismiss") {
    if (!sessionId) return;
    setBusy(`${r.id}:${what}`);
    setError(null);
    setNote(null);
    try {
      if (what === "use") {
        const x = await api<{ workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${sessionId}/community-responses/${r.id}/use`, { method: "POST" });
        onSet(x.workingSet);
        setNote(`${r.author.name}’s reply is on the Working Table as feedback.`);
      } else if (what === "save") {
        await api(`/api/v1/open-conversations/${r.conversationId}/replies/${r.id}/save`, { method: "POST" });
        setNote("Saved to your Materials, with who said it.");
      } else {
        await api(`/api/v1/studio-sessions/${sessionId}/community-responses/${r.id}`, { method: "DELETE" });
      }
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  // Grouped by what they suggest (Phase 05 §10) — asked for once the sheet is open, never waited on, never applied.
  const [groups, setGroups] = useState<Array<{ label: string; replyIds: string[] }>>([]);
  const [only, setOnly] = useState<string[] | null>(null);
  const triageKey = open && sessionId && (data?.responses.length ?? 0) >= 3 ? `${sessionId}:${data!.responses.map((r) => r.id).join(",")}` : null;
  useEffect(() => {
    if (!triageKey) return;
    let live = true;
    api<{ groups: Array<{ label: string; replyIds: string[] }> }>(`/api/v1/studio-sessions/${triageKey.split(":")[0]}/community-responses/triage`)
      .then((r) => live && setGroups(r.groups))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [triageKey]);
  async function takeGroup(ids: string[]) {
    if (!sessionId) return;
    setBusy("group");
    setError(null);
    try {
      let next: WorkingSetView | null = null;
      for (const rid of ids) next = (await api<{ workingSet: WorkingSetView }>(`/api/v1/studio-sessions/${sessionId}/community-responses/${rid}/use`, { method: "POST" })).workingSet;
      if (next) onSet(next);
      void api("/api/v1/telemetry", { method: "POST", json: { event: "community_triage_used" } }).catch(() => undefined);
      setNote(`${ids.length} ${ids.length === 1 ? "reply is" : "replies are"} on the Working Table as feedback.`);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  const all = data?.responses ?? [];
  const list = only ? all.filter((r) => only.includes(r.id)) : all;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Responses from Pulse" description={responsesLine(data) ?? "Replies to what you asked about this Creation."} art={KIT.painted.leafSprigSage} wide>
        <div className="space-y-2">
          {note ? (
            <p role="status" className="text-[13px] text-accent-ink">
              {note}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          {groups.length && !only ? (
            <ul aria-label="What the replies suggest" className="divide-y divide-border-soft rounded-2xl bg-surface-muted/60">
              {groups.map((g) => (
                <li key={g.label} className="flex flex-wrap items-center gap-x-2 px-3 py-1">
                  <span className="min-w-0 flex-1 text-[13.5px] text-ink">
                    <span className="font-semibold">{g.replyIds.length}</span> {g.label}
                  </span>
                  <button type="button" onClick={() => setOnly(g.replyIds)} className="inline-flex min-h-11 items-center text-[12.5px] font-medium text-accent-ink hover:underline">
                    View replies
                  </button>
                  <button type="button" disabled={!!busy} onClick={() => void takeGroup(g.replyIds)} className="inline-flex min-h-11 items-center text-[12.5px] font-medium text-ink hover:underline disabled:opacity-60">
                    Use idea in Studio
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {only ? (
            <button type="button" onClick={() => setOnly(null)} className="inline-flex min-h-11 items-center text-[13px] font-medium text-accent-ink hover:underline">
              ← All replies
            </button>
          ) : null}
          {!list.length ? <p className="text-sm text-ink-muted">No replies yet. They’ll show here as they come in.</p> : null}
          <ul className="space-y-2" aria-label="Responses">
            {list.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border-soft bg-surface px-3 py-2">
                <p className="flex items-center gap-1.5 text-[12.5px] text-ink-subtle">
                  {r.isNew ? <span className="rounded-full bg-accent-softer px-1.5 py-px text-[11px] font-semibold text-accent-ink">New</span> : null}
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-ink">{r.author.name}</span> · {r.about ? `About ${r.about}` : r.conversationTitle} · <RelativeTime iso={r.createdAt} />
                  </span>
                </p>
                <p className="mt-0.5 line-clamp-4 whitespace-pre-line text-[14px] leading-snug text-ink">“{r.body}”</p>
                <div className="mt-0.5 flex items-center gap-1">
                  <button type="button" disabled={r.inSet || !!busy} onClick={() => act(r, "use")} className="inline-flex min-h-11 items-center disabled:opacity-60">
                    <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[13px] font-medium text-white">{r.inSet ? "On the table" : busy === `${r.id}:use` ? "Adding…" : "Use in Studio"}</span>
                  </button>
                  <Menu>
                    <MenuTrigger asChild>
                      <button type="button" aria-label={`More for ${r.author.name}’s reply`} className="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-black/5">
                        <MoreHorizontal className="size-4" aria-hidden />
                      </button>
                    </MenuTrigger>
                    <MenuContent align="start">
                      <MenuItem onSelect={() => void act(r, "save")}>Save thought</MenuItem>
                      <MenuItem onSelect={() => router.push(`/pulse/conversations/${r.conversationId}#reply`)}>Reply</MenuItem>
                      <MenuItem onSelect={() => void act(r, "dismiss")}>Dismiss</MenuItem>
                    </MenuContent>
                  </Menu>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Ask Community (§13) */

export interface AskFragment {
  label: string;
  text: string;
  slideId?: string | null;
}

export function AskCommunitySheet({ open, onOpenChange, artifactId, fragment, onAsked }: { open: boolean; onOpenChange: (o: boolean) => void; artifactId: string; fragment: AskFragment | null; onAsked: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Ask Pulse" description="Only the part you chose is shared. The rest of your Creation stays private." art={KIT.painted.coralLeaves}>
        {open && fragment ? <AskBody artifactId={artifactId} fragment={fragment} onAsked={onAsked} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AskBody({ artifactId, fragment, onAsked }: { artifactId: string; fragment: AskFragment; onAsked: () => void }) {
  const [question, setQuestion] = useState("");
  const [visibility, setVisibility] = useState<"community" | "limited">("community");
  const [handles, setHandles] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const excerpt = fragment.text.slice(0, 1200);
  async function ask() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ conversation: { id: string } }>(`/api/v1/artifacts/${artifactId}/ask-community`, {
        method: "POST",
        json: {
          question,
          visibility,
          inviteHandles: visibility === "limited" ? handles.split(/[\s,]+/).map((h) => h.replace(/^@/, "")).filter(Boolean) : undefined,
          fragment: { label: fragment.label, text: excerpt, slideId: fragment.slideId ?? null },
        },
      });
      setAsked(r.conversation.id);
      onAsked();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (asked)
    return (
      <div className="space-y-2" role="status">
        <p className="flex items-center gap-2 text-[14px] text-ink">
          <MessagesSquare className="size-4 text-accent" aria-hidden /> Asked. Replies come back to your Working Table.
        </p>
        <Link href={`/pulse/conversations/${asked}`} className="inline-flex min-h-11 items-center text-[13.5px] font-medium text-accent-ink hover:underline">
          See the conversation
        </Link>
      </div>
    );
  return (
    <div className="space-y-3">
      <figure className="rounded-xl bg-surface-muted/70 px-3 py-2">
        <figcaption className="text-[12px] font-medium text-ink-subtle">Selected: {fragment.label}</figcaption>
        <blockquote className="mt-0.5 line-clamp-5 whitespace-pre-line font-display text-[15px] leading-snug text-ink">{excerpt}</blockquote>
      </figure>
      <div className="space-y-1">
        <label htmlFor="ask-question" className="text-sm font-medium text-ink">
          Question
        </label>
        <Textarea id="ask-question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Does this line feel too literal?" rows={2} maxLength={1000} />
      </div>
      <div role="radiogroup" aria-label="Who can see it" className="flex gap-1.5">
        {(
          [
            ["community", "Signed-in creators"],
            ["limited", "Only people I add"],
          ] as const
        ).map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={visibility === v} onClick={() => setVisibility(v)} className="inline-flex min-h-11 items-center">
            <span className={cn("inline-flex h-8 items-center rounded-full px-3 text-[13px]", visibility === v ? "bg-accent-soft font-medium text-accent-ink ring-1 ring-accent/30" : "bg-surface-muted text-ink-muted")}>{l}</span>
          </button>
        ))}
      </div>
      {visibility === "limited" ? (
        <div className="space-y-1">
          <label htmlFor="ask-people" className="text-sm font-medium text-ink">
            People
          </label>
          <Input id="ask-people" value={handles} onChange={(e) => setHandles(e.target.value)} placeholder="@handle, @handle" />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button className="w-full" loading={busy} disabled={question.trim().length < 3} onClick={ask}>
        Ask
      </Button>
    </div>
  );
}
