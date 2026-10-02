"use client";
import type { Testimonial } from "@wonder/creator-identity";
import { Avatar, Button, ConfirmDialog, Dialog, DialogContent, KIT, KitArt, Switch, Textarea, cn } from "@wonder/ui";
import { ChevronRight, HeartHandshake, PenLine } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { RelativeTime } from "@/components/client-time";
import { api, errorMessage } from "@/lib/client";
import { surface } from "./shared";

/**
 * Testimonials on the Profile (docs/testimonials.md): what others wrote about this creator, newest first, once the
 * creator chose to show it. The owner sees pending ones first with Show / Keep private; a writer sees their own with
 * its state and can rewrite or withdraw it. No counts, no ranking.
 */
export type SharedContext = { type: "project" | "artifact" | "huddle"; id: string; label: string };

export function TestimonialsSection({
  items,
  isMe,
  viewerId,
  creator,
  avatars,
  canWrite,
  shared,
  base,
  limit,
}: {
  items: Testimonial[];
  isMe: boolean;
  viewerId: string;
  creator: { id: string; name: string; handle: string };
  avatars: Record<string, string>;
  canWrite: boolean;
  shared: SharedContext[];
  base: string;
  /** On the Overview: show this many and link to the rest. */
  limit?: number;
}) {
  const router = useRouter();
  const pending = isMe ? items.filter((t) => t.status === "pending") : [];
  const mineWritten = !isMe ? (items.find((t) => t.from.id === viewerId) ?? null) : null;
  const shown = items.filter((t) => t.status === "shown");
  const hidden = isMe ? items.filter((t) => t.status === "hidden") : [];
  const list = limit ? shown.slice(0, limit) : shown;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, action: "show" | "hide", onCreatorPage?: boolean) {
    setBusy(id);
    setError(null);
    try {
      await api(`/api/v1/testimonials/${id}`, { method: "PATCH", json: { action, onCreatorPage } });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const empty = !pending.length && !list.length && !hidden.length && !mineWritten;
  if (empty && !canWrite && !isMe) return null;

  return (
    <section aria-label="Testimonials" className={cn(surface, "relative overflow-hidden px-3 py-2.5")}>
      <KitArt art={KIT.painted.blossomSprig} sizes="5rem" className="pointer-events-none absolute -right-3 -top-3 h-[4.5rem] w-auto opacity-60" />
      <div className="relative flex min-h-9 items-center gap-2.5">
        <span className="grid size-7 place-items-center rounded-lg bg-[#fde8e4] text-[#b4533f]">
          <HeartHandshake className="size-4" aria-hidden />
        </span>
        <h2 className="flex-1 text-[15px] font-semibold text-ink">Testimonials</h2>
        {limit && shown.length > limit ? (
          <Link href={`${base}?tab=community#testimonials`} className="relative inline-flex items-center gap-0.5 text-[12.5px] font-medium text-accent-ink before:absolute before:-inset-3 before:content-[''] hover:underline">
            See all <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
        {canWrite && !mineWritten ? <WriteTestimonialButton creator={creator} shared={shared} compact /> : null}
      </div>

      {error ? (
        <p role="alert" className="mt-1 text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}

      {pending.length ? (
        <ul aria-label="Waiting for you" className="relative mt-1.5 space-y-1.5">
          {pending.map((t) => (
            <li key={t.id} className="rounded-xl bg-accent-softer/70 px-3 py-2">
              <p className="text-[12px] font-medium text-accent-ink">
                {t.from.name} wrote you a testimonial · <RelativeTime iso={t.createdAt} />
              </p>
              <Quote t={t} avatars={avatars} />
              <PendingActions t={t} busy={busy === t.id} onDecide={(a, page) => void decide(t.id, a, page)} />
            </li>
          ))}
        </ul>
      ) : null}

      {mineWritten ? <MineLine t={mineWritten} creator={creator} shared={shared} /> : null}

      {list.length ? (
        <ul className="relative mt-1.5 divide-y divide-border-soft">
          {list.map((t) => (
            <li key={t.id} className="py-2 first:pt-1 last:pb-0.5">
              <Quote t={t} avatars={avatars} />
              {isMe ? (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-9 text-[12px] text-ink-subtle">
                  <Switch checked={t.onCreatorPage} onCheckedChange={(v) => void decide(t.id, "show", v)} label="Also on my Creator Page" />
                  <span>Also on my Creator Page</span>
                  <button type="button" disabled={busy === t.id} onClick={() => void decide(t.id, "hide")} className="inline-flex min-h-8 items-center text-ink-subtle hover:text-ink hover:underline">
                    Keep private
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {isMe && hidden.length ? (
        <details className="relative mt-1.5 text-[12.5px] text-ink-subtle">
          <summary className="min-h-8 cursor-pointer list-none py-1 hover:text-ink">{hidden.length === 1 ? "1 kept private" : `${hidden.length} kept private`}</summary>
          <ul className="mt-1 divide-y divide-border-soft">
            {hidden.map((t) => (
              <li key={t.id} className="py-2">
                <Quote t={t} avatars={avatars} muted />
                <div className="mt-1 pl-9">
                  <button type="button" disabled={busy === t.id} onClick={() => void decide(t.id, "show")} className="inline-flex min-h-8 items-center text-[12.5px] font-medium text-accent-ink hover:underline">
                    Show on my profile
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {empty ? (
        <p className="relative mt-1 text-[13px] text-ink-muted">
          {isMe ? "When someone who knows your work writes about you, it waits here for you to show it." : `Be the first to write about ${creator.name.split(" ")[0]}'s work.`}
        </p>
      ) : null}
    </section>
  );
}

function Quote({ t, avatars, muted }: { t: Testimonial; avatars: Record<string, string>; muted?: boolean }) {
  return (
    <figure className="flex gap-2.5">
      <Avatar name={t.from.name} src={avatars[t.from.id]} size={28} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <blockquote className={cn("whitespace-pre-line font-display text-[15.5px] italic leading-snug", muted ? "text-ink-muted" : "text-ink")}>{t.body}</blockquote>
        <figcaption className="mt-0.5 text-[12px] text-ink-subtle">
          {t.from.handle ? (
            <Link href={`/creators/${t.from.handle}`} className="font-medium text-ink hover:underline">
              {t.from.name}
            </Link>
          ) : (
            <span className="font-medium text-ink">{t.from.name}</span>
          )}
          {t.context?.label ? ` · ${t.context.type === "project" ? "Worked together in" : t.context.type === "artifact" ? "Worked together on" : "Were together in"} ${t.context.label}` : t.workedTogether ? " · Worked together" : ""}
          {" · "}
          <RelativeTime iso={t.createdAt} />
        </figcaption>
      </div>
    </figure>
  );
}

function PendingActions({ t, busy, onDecide }: { t: Testimonial; busy: boolean; onDecide: (a: "show" | "hide", onCreatorPage?: boolean) => void }) {
  const [page, setPage] = useState(false);
  void t;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-9">
      <Button size="sm" loading={busy} onClick={() => onDecide("show", page)}>
        Show on my profile
      </Button>
      <button type="button" disabled={busy} onClick={() => onDecide("hide")} className="inline-flex min-h-11 items-center text-[13px] text-ink-subtle hover:text-ink hover:underline">
        Keep private
      </button>
      <label className="inline-flex min-h-11 items-center gap-1.5 text-[12px] text-ink-subtle">
        <Switch checked={page} onCheckedChange={setPage} label="Also on my Creator Page" /> Also on my Creator Page
      </label>
    </div>
  );
}

/** The writer's own testimonial for this creator, with its state and the way to change or withdraw it. */
function MineLine({ t, creator, shared }: { t: Testimonial; creator: { id: string; name: string; handle: string }; shared: SharedContext[] }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const state = t.status === "pending" ? `Waiting for ${creator.name.split(" ")[0]} to show it` : t.status === "shown" ? "Shown on their profile" : t.status === "hidden" ? "They're keeping it private" : "You withdrew it";
  return (
    <div className="relative mt-1.5 rounded-xl bg-surface-muted px-3 py-2">
      <p className="text-[12px] font-medium text-ink-subtle">Yours · {state}</p>
      {t.status !== "withdrawn" ? <p className="mt-0.5 line-clamp-2 font-display text-[14.5px] italic leading-snug text-ink">{t.body}</p> : null}
      <div className="mt-1 flex flex-wrap items-center gap-x-3">
        <WriteTestimonialButton creator={creator} shared={shared} existing={t.status === "withdrawn" ? null : t.body} compact />
        {t.status !== "withdrawn" ? (
          <button type="button" onClick={() => setConfirm(true)} className="inline-flex min-h-11 items-center text-[12.5px] text-ink-subtle hover:text-ink hover:underline">
            Withdraw
          </button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Withdraw your testimonial?"
        body="It leaves their profile at once. You can write a new one later."
        confirmLabel="Withdraw"
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api(`/api/v1/testimonials?to=${creator.id}`, { method: "DELETE" });
            setConfirm(false);
            router.refresh();
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

/** "Write a testimonial": a sheet, opened from the section, the More menu, or the Palette (?write=testimonial). */
export function WriteTestimonialButton({ creator, shared, existing, compact }: { creator: { id: string; name: string; handle: string }; shared: SharedContext[]; existing?: string | null; compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const fromPalette = sp.get("write") === "testimonial";
  const [open, setOpen] = useState(fromPalette);
  const [seen, setSeen] = useState(fromPalette);
  if (fromPalette !== seen) {
    setSeen(fromPalette);
    if (fromPalette) setOpen(true);
  }
  const close = (o: boolean) => {
    setOpen(o);
    if (!o && fromPalette) router.replace(pathname, { scroll: false });
  };
  const first = creator.name.split(" ")[0];
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("relative inline-flex items-center gap-1 text-accent-ink before:absolute before:-inset-3 before:content-[''] hover:underline", compact ? "text-[12.5px] font-medium" : "min-h-11 text-[13.5px] font-medium")}>
        <PenLine className="size-3.5" aria-hidden /> {existing ? "Rewrite" : "Write a testimonial"}
      </button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent title={existing ? `Rewrite your testimonial for ${first}` : `Write a testimonial for ${first}`} description={`${first} decides whether it shows on their profile. Say what it was like to work with them, or what their work does.`} art={KIT.painted.blossomSprig}>
          {open ? <WriteBody creator={creator} shared={shared} existing={existing ?? ""} onDone={() => close(false)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function WriteBody({ creator, shared, existing, onDone }: { creator: { id: string; name: string }; shared: SharedContext[]; existing: string; onDone: () => void }) {
  const router = useRouter();
  const [body, setBody] = useState(existing);
  const [context, setContext] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const picked = shared.find((s) => s.id === context) ?? null;
          await api("/api/v1/testimonials", { method: "POST", json: { to: creator.id, body, context: picked ? { type: picked.type, id: picked.id } : null } });
          onDone();
          router.refresh();
        } catch (err) {
          setError(errorMessage(err));
          setBusy(false);
        }
      }}
    >
      <div className="space-y-1">
        <label htmlFor="testimonial-body" className="text-[13px] font-medium text-ink">
          Your words
        </label>
        <Textarea id="testimonial-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={600} className="min-h-28 font-display text-[16px] italic" placeholder="Working with Priya, the quiet shot always turned out to be the one…" autoFocus />
        <p className="text-right text-[11.5px] text-ink-subtle tabular-nums">{body.trim().length}/600</p>
      </div>
      {shared.length ? (
        <div className="space-y-1">
          <label htmlFor="testimonial-context" className="text-[13px] font-medium text-ink">
            About something you shared <span className="font-normal text-ink-subtle">(optional)</span>
          </label>
          <select id="testimonial-context" value={context} onChange={(e) => setContext(e.target.value)} className="h-11 w-full rounded-xl border border-border-soft bg-surface px-3 text-[14px]">
            <option value="">Not about one thing in particular</option>
            {shared.map((s) => (
              <option key={s.id} value={s.id}>
                {s.type === "project" ? "Creative Room" : s.type === "artifact" ? "Creation" : "Huddle"} · {s.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <p className="text-[12.5px] text-ink-subtle">Written in your name. {creator.name.split(" ")[0]} can show it, keep it private, or you can withdraw it later.</p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" loading={busy} disabled={body.trim().length < 10}>
        {existing ? "Send the new version" : "Send it to them"}
      </Button>
    </form>
  );
}
