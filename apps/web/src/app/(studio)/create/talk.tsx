"use client";
import { RelativeTime } from "@/components/client-time";
import { artifactType } from "@wonder/creator-studio/types";
import { Badge, Button, ErrorState, buttonClasses, cn } from "@wonder/ui";
import { ArrowUpRight, Check, CircleAlert, Lightbulb, MessageSquarePlus, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MaterialVisual, type MaterialCardData } from "@/components/cards";
import { Composer, type ComposerPayload } from "@/components/composer";
import { api, errorMessage } from "@/lib/client";
import { PENDING_TURN_KEY, sendToCreator, type PendingTurn } from "@/lib/send";
import { IntentCard, type IntentPayload } from "./intent-card";

export interface TalkMessage {
  id: string;
  role: "creator" | "brain";
  kind: string;
  content: string;
  payload: Record<string, unknown>;
  createdAt: string;
  materialIds: string[];
}

interface Direction {
  title: string;
  artifactType: string;
  description: string;
  why: string;
  styleTags: string[];
  materialIds: string[];
}

export function Talk({
  conversations,
  conversation,
  initialMessages,
  materials: initialMaterials,
  preselectedMaterialIds,
  focusArtifact,
  focusCollection,
  prompt,
  creatorName,
  offline,
}: {
  conversations: Array<{ id: string; title: string; updatedAt: string }>;
  conversation: { id: string; title: string } | null;
  initialMessages: TalkMessage[];
  materials: Record<string, MaterialCardData>;
  preselectedMaterialIds: string[];
  focusArtifact: { id: string; title: string; artifact_type: string } | null;
  focusCollection: { id: string; name: string } | null;
  prompt?: string;
  creatorName: string;
  offline: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [messages, setMessages] = useState(initialMessages);
  const [materials, setMaterials] = useState(initialMaterials);
  const [conversationId, setConversationId] = useState(conversation?.id ?? null);
  const [progress, setProgress] = useState<string[]>([]);
  // The run behind the current turn: its progress page survives navigation, and it can be stopped.
  const [activeRun, setActiveRun] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [retried, setRetried] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [attached, setAttached] = useState<string[]>(preselectedMaterialIds);
  const [artifactCtx, setArtifactCtx] = useState(focusArtifact);
  // Only a new conversation can start from a collection; once started, the link lives on the conversation.
  const [collectionCtx, setCollectionCtx] = useState(focusCollection);
  const bottomRef = useRef<HTMLDivElement>(null);
  const ran = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, progress.length]);

  const runTurn = useCallback(
    async (body: Record<string, unknown>, optimistic?: { content: string; materialIds: string[] }, endpoint = "/api/v1/conversations/turn") => {
      setBusy(true);
      setError(null);
      setProgress([]);
      setActiveRun(null);
      setStopping(false);
      if (optimistic) {
        setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: "creator", kind: "text", content: optimistic.content, payload: {}, createdAt: new Date().toISOString(), materialIds: optimistic.materialIds }]);
      }
      try {
        const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId, ...body }) });
        if (!res.ok || !res.body) {
          const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new Error(j?.error?.message ?? "CreatorBrain didn't respond. Please try again.");
        }
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
            const ev = JSON.parse(line) as { type: string; label?: string; message?: string; runId?: string; conversationId?: string; messages?: Array<{ id: string; role: "creator" | "brain"; kind: string; content: string; payload: Record<string, unknown>; created_at: string }> };
            if (ev.type === "progress" && ev.label) setProgress((p) => (p.at(-1) === ev.label ? p : [...p, ev.label!]));
            if (ev.type === "run" && ev.runId) setActiveRun(ev.runId);
            if (ev.type === "error") throw new Error(ev.message);
            if (ev.type === "done" && !ev.conversationId && ev.messages?.length === 0) router.refresh();
            if (ev.type === "done" && ev.conversationId) {
              setConversationId(ev.conversationId);
              setMessages((m) => [
                ...m.filter((x) => !x.id.startsWith("tmp-")),
                ...(ev.messages ?? []).map((x) => ({ id: x.id, role: x.role, kind: x.kind, content: x.content, payload: x.payload, createdAt: x.created_at, materialIds: x.role === "creator" ? optimistic?.materialIds ?? [] : [] })),
              ]);
              if (!params.get("c") || params.get("c") !== ev.conversationId) router.replace(`/create?c=${ev.conversationId}`, { scroll: false });
            }
          }
        }
      } catch (e) {
        setMessages((m) => m.filter((x) => !x.id.startsWith("tmp-")));
        setError(errorMessage(e));
      } finally {
        setBusy(false);
        setProgress([]);
        setActiveRun(null);
      }
    },
    [conversationId, params, router],
  );

  // Continue a turn started from the Home composer.
  useEffect(() => {
    if (ran.current || params.get("pending") !== "1") return;
    ran.current = true;
    const raw = sessionStorage.getItem(PENDING_TURN_KEY);
    sessionStorage.removeItem(PENDING_TURN_KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as PendingTurn;
    void Promise.resolve().then(() => {
      if (p.rejected?.length) setNotices(p.rejected.map((r) => `${r.name}: ${r.message}`));
    });
    if (!p.message && !p.materialIds.length) return;
    void refreshMaterials(p.materialIds).then(() => runTurn({ message: p.message, materialIds: p.materialIds, inputMode: p.inputMode }, { content: p.message || `Shared ${p.materialIds.length} piece${p.materialIds.length === 1 ? "" : "s"} of material`, materialIds: p.materialIds }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshMaterials(ids: string[]) {
    if (!ids.length) return;
    try {
      const res = await api<{ items: Array<MaterialCardData & { id: string }> }>(`/api/v1/materials?filter=all`);
      setMaterials((m) => ({ ...m, ...Object.fromEntries(res.items.filter((i) => ids.includes(i.id)).map((i) => [i.id, i])) }));
    } catch {
      /* previews are optional */
    }
  }

  async function submit(p: ComposerPayload) {
    setError(null);
    const ids = [...attached];
    const rejected: string[] = [];
    try {
      for (const [files, kind] of [
        [p.files, undefined],
        [p.photos, "camera"],
        [p.voiceNotes, "voice"],
      ] as const) {
        if (!files.length) continue;
        const r = await sendToCreator({ files: [...files], kind });
        ids.push(...r.accepted.map((a) => a.materialId).filter((x): x is string => !!x));
        rejected.push(...r.rejected.map((x) => `${x.name}: ${x.message}`));
      }
      if (p.urls.length) {
        const r = await sendToCreator({ urls: p.urls });
        ids.push(...r.accepted.map((a) => a.materialId).filter((x): x is string => !!x));
        rejected.push(...r.rejected.map((x) => `${x.name}: ${x.message}`));
      }
    } catch (e) {
      setError(errorMessage(e));
      return;
    }
    setNotices(rejected);
    await refreshMaterials(ids);
    setAttached([]);
    await runTurn(
      { message: p.message, materialIds: ids, inputMode: p.inputMode, artifactId: artifactCtx?.id ?? null, collectionId: conversationId ? null : (collectionCtx?.id ?? null) },
      { content: p.message || `Shared ${ids.length} piece${ids.length === 1 ? "" : "s"} of material`, materialIds: ids },
    );
  }

  const empty = messages.length === 0;

  return (
    <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[250px_1fr]">
      <aside className="hidden lg:block" aria-label="Conversations">
        <Link href="/create" className={buttonClasses({ className: "w-full justify-start" })}>
          <MessageSquarePlus className="size-4" aria-hidden /> New conversation
        </Link>
        <Link href="/send" className="mt-2 flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-ink-muted hover:bg-black/[0.04]">
          CreatorSend inbox
        </Link>
        <Link href="/create/discover" className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-ink-muted hover:bg-black/[0.04]">
          Creative Discovery
        </Link>
        <h2 className="mb-1 mt-5 px-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Recent</h2>
        <ul className="space-y-0.5">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/create?c=${c.id}`}
                aria-current={c.id === conversationId ? "page" : undefined}
                className={cn("block rounded-xl px-3 py-2 text-sm leading-snug", c.id === conversationId ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-muted hover:bg-black/[0.04]")}
              >
                {c.title}
                <span className="block text-xs font-normal text-ink-subtle"><RelativeTime iso={c.updatedAt} /></span>
              </Link>
            </li>
          ))}
          {!conversations.length ? <li className="px-3 text-sm text-ink-subtle">Your conversations will appear here.</li> : null}
        </ul>
      </aside>

      <section className="flex min-h-[70dvh] min-w-0 flex-col" aria-label="CreatorTalk">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl text-ink sm:text-3xl">{conversation?.title ?? (empty ? "CreatorTalk" : "New conversation")}</h1>
          <div className="flex gap-2 lg:hidden">
            <Link href="/create" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              New
            </Link>
            <Link href="/send" className={buttonClasses({ variant: "ghost", size: "sm" })}>
              Inbox
            </Link>
          </div>
        </div>
        {offline ? (
          <p className="mb-4 rounded-2xl border border-[#f6dfb6] bg-warning-soft px-4 py-2.5 text-sm text-warning-ink">
            CreatorBrain is in offline development mode: drafts are deterministic placeholders, not real AI writing. Connect Claude to create for real.
          </p>
        ) : null}

        <ol className="flex-1 space-y-5" aria-live="polite">
          {empty ? (
            <li className="rounded-3xl border border-border-soft bg-surface p-6 sm:p-8">
              <p className="font-display text-2xl text-ink">What would you like to create today, {creatorName.split(" ")[0] || "creator"}?</p>
              <p className="mt-2 text-ink-muted">Bring what you have — a note, photos, a voice memo, a few links — and tell me what you&apos;re trying to express. If you don&apos;t know yet, I&apos;ll suggest directions.</p>
              <ul className="mt-4 grid gap-2 text-sm text-ink-muted sm:grid-cols-2">
                {["“Turn these notes into a poem.”", "“Use these photographs and create a visual treatment.”", "“I don't know what this should become.”", "“Take the poem we made yesterday and make lyrics.”"].map((x) => (
                  <li key={x} className="flex items-start gap-2 rounded-xl bg-surface-muted px-3 py-2">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent-ink" aria-hidden /> {x}
                  </li>
                ))}
              </ul>
            </li>
          ) : null}
          {messages.map((m) => (
            <MessageView
              key={m.id}
              m={m}
              materials={materials}
              busy={busy}
              onChooseDirection={(index) => runTurn({ direction: { messageId: m.id, index } }, { content: `Let's make: ${(m.payload.directions as Direction[])[index].title}`, materialIds: [] })}
              onAnswer={(artifactId, pendingMessage) => runTurn({ message: pendingMessage, artifactId }, { content: pendingMessage, materialIds: [] })}
              canRetry={typeof m.payload?.runId === "string" && !retried.includes(m.payload.runId as string) && m.payload.code !== "validation" && m.payload.code !== "forbidden"}
              onRetry={(runId) => {
                setRetried((r) => [...r, runId]);
                void runTurn({}, undefined, `/api/v1/brain/runs/${runId}/retry`);
              }}
              answered={messages.some((x) => x.payload?.clarifies === m.id)}
              onClarify={(brief, acknowledged) => runTurn({ clarified: { messageId: m.id, brief, acknowledged } }, { content: `Let's make it: ${artifactType(brief.format).label}`, materialIds: [] })}
              onProposal={async (id, decision) => {
                try {
                  const r = await api<{ kind?: string; artifact?: { id: string }; artifactId?: string }>(`/api/v1/brain/proposals/${id}`, { method: "POST", json: { decision } });
                  setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, payload: { ...x.payload, resolved: decision, result: r } } : x)));
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            />
          ))}
          {busy ? (
            <li className="flex gap-3" role="status">
              <BrainDot />
              <div className="rounded-2xl bg-surface px-4 py-3 text-sm text-ink-muted shadow-[var(--shadow-card)]">
                <p className="font-medium text-ink">CreatorBrain is working…</p>
                <ul className="mt-1 space-y-0.5">
                  {(progress.length ? progress : ["Reading what you shared"]).map((p, i, arr) => (
                    <li key={p} className="flex items-center gap-2">
                      {i < arr.length - 1 ? <Check className="size-3.5 text-success-ink" aria-hidden /> : <span className="size-3.5 rounded-full border-2 border-accent/30 border-t-accent motion-safe:animate-spin" aria-hidden />}
                      {p}
                    </li>
                  ))}
                </ul>
                {activeRun ? (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link href={`/create/runs/${activeRun}`} className="inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">
                      Progress details
                    </Link>
                    <button
                      type="button"
                      disabled={stopping}
                      className="inline-flex min-h-11 items-center text-sm text-ink-muted hover:text-ink disabled:opacity-60"
                      onClick={async () => {
                        setStopping(true);
                        try {
                          await api(`/api/v1/brain/runs/${activeRun}/cancel`, { method: "POST" });
                        } catch (e) {
                          setStopping(false);
                          setError(errorMessage(e));
                        }
                      }}
                    >
                      {stopping ? "Stopping after this step…" : "Stop"}
                    </button>
                    <span className="text-xs text-ink-subtle">You can leave this page — it keeps going.</span>
                  </div>
                ) : null}
              </div>
            </li>
          ) : null}
        </ol>
        <div ref={bottomRef} />

        {error ? <ErrorState className="mt-4" title="That didn't go through" body={`${error} Nothing you shared was lost.`} /> : null}
        {notices.length ? (
          <ul className="mt-3 space-y-1 rounded-2xl bg-warning-soft px-4 py-2 text-sm text-warning-ink">
            {notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}

        <div className="sticky bottom-[calc(var(--bottom-nav-height)+0.5rem)] mt-5 md:bottom-4">
          {artifactCtx || attached.length || (collectionCtx && !conversationId) ? (
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              {artifactCtx ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft py-1 pl-3 pr-1 text-accent-ink">
                  Working on: {artifactCtx.title}
                  <button type="button" onClick={() => setArtifactCtx(null)} aria-label="Stop working on this piece" className="inline-flex size-7 items-center justify-center rounded-full hover:bg-white/70">
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              ) : null}
              {collectionCtx && !conversationId ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft py-1 pl-3 pr-1 text-accent-ink">
                  From collection: {collectionCtx.name}
                  <button type="button" onClick={() => setCollectionCtx(null)} aria-label="Don't start from this collection" className="inline-flex size-7 items-center justify-center rounded-full hover:bg-white/70">
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              ) : null}
              {attached.map((id) => (
                <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-accent-softer py-1 pl-3 pr-1 text-ink-muted">
                  {materials[id]?.title ?? "Material"}
                  <button type="button" onClick={() => setAttached((a) => a.filter((x) => x !== id))} aria-label="Remove attachment" className="inline-flex size-7 items-center justify-center rounded-full hover:bg-white">
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <Composer onSubmit={submit} busy={busy} compact placeholder="Tell me what you'd like to explore…" prompt={prompt} />
        </div>
      </section>
    </div>
  );
}

function BrainDot() {
  return <span aria-hidden className="mt-1 size-8 shrink-0 rounded-full" style={{ background: "var(--brand-gradient)" }} />;
}

function MessageView({
  m,
  materials,
  busy,
  onChooseDirection,
  onAnswer,
  onProposal,
  answered,
  onClarify,
  canRetry,
  onRetry,
}: {
  m: TalkMessage;
  materials: Record<string, MaterialCardData>;
  busy: boolean;
  onChooseDirection: (i: number) => void;
  onAnswer: (artifactId: string, pending: string) => void;
  answered: boolean;
  canRetry: boolean;
  onRetry: (runId: string) => void;
  onClarify: Parameters<typeof IntentCard>[0]["onConfirm"];
  onProposal: (id: string, d: "approve" | "reject") => Promise<void>;
}) {
  if (m.role === "creator") {
    return (
      <li className="flex justify-end">
        <div className="max-w-[min(34rem,90%)]">
          {m.content ? <div className="rounded-2xl rounded-br-md bg-accent-soft px-4 py-3 text-[15px] leading-relaxed text-ink">{m.content}</div> : null}
          {m.materialIds.length ? (
            <ul className="mt-2 flex flex-wrap justify-end gap-2" aria-label="Attached material">
              {m.materialIds.slice(0, 6).map((id) =>
                materials[id] ? (
                  <li key={id} className="size-16 overflow-hidden rounded-xl border border-border-soft sm:size-20">
                    <Link href={`/space/materials/${id}`} aria-label={materials[id].title ?? "Material"}>
                      <MaterialVisual m={materials[id]} />
                    </Link>
                  </li>
                ) : null,
              )}
              {m.materialIds.length > 6 ? <li className="flex size-16 items-center justify-center rounded-xl bg-surface text-sm text-ink-muted sm:size-20">+{m.materialIds.length - 6}</li> : null}
            </ul>
          ) : null}
        </div>
      </li>
    );
  }

  const p = m.payload;
  return (
    <li className="flex gap-3">
      <BrainDot />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink-subtle">CreatorBrain</p>
        {m.kind === "error" ? (
          <p className="mt-1 flex items-start gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-[15px] text-ink">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden /> {m.content}
          </p>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{m.content}</p>
        )}

        {m.kind === "understanding" && Array.isArray(p.themes) ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(p.themes as string[]).map((t) => (
              <Badge key={t} tone="accent">
                {t}
              </Badge>
            ))}
          </div>
        ) : null}

        {m.kind === "directions" && Array.isArray(p.directions) ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(p.directions as Direction[]).map((d, i) => (
              <li key={i} className="flex flex-col rounded-2xl border border-border-soft bg-surface p-4 shadow-[var(--shadow-card)]">
                <p className="text-xs text-ink-subtle">
                  {i + 1}. {artifactType(d.artifactType).label}
                </p>
                <p className="mt-1 font-medium text-ink">{d.title}</p>
                <p className="mt-1 text-sm text-ink-muted">{d.description}</p>
                <p className="mt-2 text-sm text-ink-subtle">
                  <span className="font-medium text-ink-muted">Why it fits: </span>
                  {d.why}
                </p>
                {d.styleTags.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {d.styleTags.slice(0, 3).map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                ) : null}
                <Button size="sm" className="mt-3 self-start" disabled={busy} onClick={() => onChooseDirection(i)}>
                  Create this
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {m.kind === "artifact" && typeof p.artifactId === "string" ? (
          <div className="mt-3 rounded-2xl border border-border-soft bg-surface p-4 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-ink-subtle">{typeof p.artifactType === "string" ? artifactType(p.artifactType).label : "Your piece"}</p>
                <p className="font-display text-xl text-ink">{(p.title as string) ?? "Updated piece"}</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/artifacts/${p.artifactId}/studio`} className={buttonClasses({ size: "sm" })}>
                  Open in Studio
                </Link>
                <Link href={`/artifacts/${p.artifactId}`} className={buttonClasses({ size: "sm", variant: "secondary" })}>
                  View <ArrowUpRight className="size-4" aria-hidden />
                </Link>
              </div>
            </div>
            {Array.isArray(p.checks) && (p.checks as Array<{ key: string; label: string; status: string; note: string }>).length ? (
              <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
                {(p.checks as Array<{ key: string; label: string; status: string; note: string }>).map((c) => (
                  <li key={c.key} className="flex items-start gap-2">
                    {c.status === "good" ? <Check className="mt-0.5 size-4 shrink-0 text-success-ink" aria-label="Good" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-label="Worth a look" />}
                    <span>
                      <span className="font-medium text-ink">{c.label}</span> <span className="text-ink-muted">— {c.note}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {p.offline ? <p className="mt-3 text-xs text-warning-ink">Drafted by the offline development model (placeholder).</p> : null}
            {typeof p.runId === "string" ? (
              <Link href={`/create/runs/${p.runId}`} className="mt-2 inline-flex min-h-11 items-center text-sm text-accent-ink hover:underline">
                How it was made
              </Link>
            ) : null}
          </div>
        ) : null}

        {m.kind === "proposal" ? <ProposalCard p={p} onDecide={onProposal} /> : null}

        {m.kind === "error" && typeof p.runId === "string" ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {canRetry ? (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => onRetry(p.runId as string)}>
                Try again
              </Button>
            ) : null}
            <Link href={`/create/runs/${p.runId}`} className={buttonClasses({ size: "sm", variant: "ghost" })}>
              What happened
            </Link>
          </div>
        ) : null}
        {m.kind === "question" && p.intent ? (
          <IntentCard id={m.id} intent={p.intent as IntentPayload} materialIds={(p.materialIds as string[]) ?? []} materials={materials} busy={busy} answered={answered} onConfirm={onClarify} />
        ) : null}
        {Array.isArray(p.assumptions) && (p.assumptions as string[]).length ? (
          <p className="mt-2 text-xs text-ink-subtle">I assumed: {(p.assumptions as string[]).join(" ")}</p>
        ) : null}
        {m.kind === "question" && Array.isArray(p.options) ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {(p.options as Array<{ id: string; title: string; type: string }>).map((o) => (
              <Button key={o.id} size="sm" variant="secondary" disabled={busy} onClick={() => onAnswer(o.id, String(p.pendingMessage ?? ""))}>
                {o.title} <span className="text-ink-subtle">· {artifactType(o.type).label}</span>
              </Button>
            ))}
          </div>
        ) : null}
        {m.kind === "text" && p.memory ? (
          <Link href="/memory" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent-ink hover:underline">
            <Sparkles className="size-4" aria-hidden /> Review Creative Memory
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function ProposalCard({ p, onDecide }: { p: Record<string, unknown>; onDecide: (id: string, d: "approve" | "reject") => Promise<void> }) {
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const resolved = p.resolved as string | undefined;
  const result = p.result as { artifact?: { id: string }; artifactId?: string; versionNumber?: number } | undefined;
  return (
    <div className="mt-3 rounded-2xl border border-[#cfd0ff] bg-surface p-4">
      <dl className="grid gap-3 text-[15px] sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">What I understood</dt>
          <dd className="mt-1 text-ink">{String(p.understood ?? "")}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">What I plan to do</dt>
          <dd className="mt-1 text-ink">{String(p.plan ?? "")}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Impact</dt>
          <dd className="mt-1 text-ink">{String(p.impact ?? "")}</dd>
        </div>
      </dl>
      {typeof p.preview === "string" ? (
        <details className="mt-3 rounded-xl bg-surface-muted p-3">
          <summary className="cursor-pointer text-sm font-medium text-ink">Preview the revision</summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-muted">{p.preview}</pre>
        </details>
      ) : null}
      {resolved ? (
        <p className="mt-3 text-sm text-ink-muted" role="status">
          {resolved === "approve" ? (
            <>
              Done.{" "}
              {result?.artifact?.id || result?.artifactId ? (
                <Link className="font-medium text-accent-ink hover:underline" href={`/artifacts/${result.artifact?.id ?? result.artifactId}`}>
                  Open it
                </Link>
              ) : null}
            </>
          ) : (
            "Cancelled — nothing changed."
          )}
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            loading={pending === "approve"}
            disabled={!!pending}
            onClick={async () => {
              setPending("approve");
              await onDecide(String(p.proposalId), "approve");
              setPending(null);
            }}
          >
            Confirm
          </Button>
          {typeof p.artifactId === "string" ? (
            <Link href={`/artifacts/${p.artifactId}/studio`} className={buttonClasses({ size: "sm", variant: "secondary" })}>
              Change
            </Link>
          ) : (
            <Link href={`/approvals/${p.proposalId}`} className={buttonClasses({ size: "sm", variant: "secondary" })}>
              Details
            </Link>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={!!pending}
            onClick={async () => {
              setPending("reject");
              await onDecide(String(p.proposalId), "reject");
              setPending(null);
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
