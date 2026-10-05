"use client";
import type { completionReview } from "@wonder/creator-projects";
import { PROJECT_STATUS_LABEL, TASK_STATUS_LABEL, type ProjectStatus } from "@wonder/creator-projects/options";
import { Badge, Button, ConfirmDialog, Field, Input, Select, Textarea, cn } from "@wonder/ui";
import { CircleAlert, CircleCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocalTime } from "@/components/client-time";
import { api, errorMessage } from "@/lib/client";
import { BackLink } from "@/components/back-link";

type Review = Awaited<ReturnType<typeof completionReview>>;

const OPEN_LABEL: Record<string, string> = {
  tasks: "open tasks",
  proposals: "change proposals",
  claims: "ownership claims",
  licence_requests: "licence requests",
  approvals: "CreativeMind approvals",
};

function Step({ n, title, ok, okText, children }: { n: number; title: string; ok: boolean; okText: string; children?: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-2xl border border-border-soft bg-surface px-4 py-4 sm:px-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm text-accent-ink">{n}</span>
        {title}
        {ok ? <CircleCheck className="ml-auto size-5 text-success-ink" aria-hidden /> : <CircleAlert className="ml-auto size-5 text-warning-ink" aria-hidden />}
        <span className="sr-only">{ok ? "Nothing to resolve" : "Needs attention"}</span>
      </h2>
      {ok ? <p className="mt-2 text-[15px] text-ink-muted">{okText}</p> : <div className="mt-3 space-y-2">{children}</div>}
    </section>
  );
}

export function CompleteView({
  viewerId,
  review,
  approvals,
  licenceRequests,
}: {
  viewerId: string;
  review: Review;
  approvals: Array<{ id: string; actionLabel: string }>;
  licenceRequests: Array<{ id: string; artifactId: string; title: string }>;
}) {
  const router = useRouter();
  const { project, crew, open } = review;
  const isOwner = project.ownerId === viewerId;
  const closed = project.status === "completed" || project.status === "archived";
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"completed" | "archived">(project.status === "completed" ? "archived" : "completed");
  const [dissolve, setDissolve] = useState(!!crew && crew.status !== "completed");
  const [acknowledge, setAcknowledge] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [followUp, setFollowUp] = useState<Record<string, string>>({});
  const openTotal = Object.values(open).reduce((a, b) => a + b, 0);
  const people = review.people;

  async function act(fn: () => Promise<unknown>, done: string) {
    setError(null);
    try {
      await fn();
      setMsg(done);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink home={`/rooms/${project.id}`} homeLabel={project.title} />
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">{closed ? "Creative Room closed" : "Complete this Creative Room"}</h1>
        <p className="text-[15px] text-ink-muted">
          {closed
            ? `This Creative Room is ${PROJECT_STATUS_LABEL[project.status as ProjectStatus].toLowerCase()}. Everything in it is kept.`
            : "Walk through what's still open before closing. Nothing is deleted: Creations, material, contributions, rights, approvals and history all stay, and everyone in the crew keeps access to them."}
        </p>
        {!closed && openTotal ? (
          <p className="text-[15px] text-ink">
            Still open:{" "}
            {Object.entries(open)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${v} ${OPEN_LABEL[k]}`)
              .join(", ")}
            .
          </p>
        ) : null}
      </header>

      <div aria-live="polite" className="sr-only">
        {msg}
      </div>
      {msg ? <p className="rounded-2xl bg-accent-softer px-4 py-3 text-[15px] text-ink">{msg}</p> : null}
      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fdecec] px-4 py-3 text-[15px] text-danger">
          {error}
        </p>
      ) : null}

      {!closed ? (
        <>
          <Step n={1} title="Unresolved tasks" ok={!review.tasks.length} okText="Every task is done.">
            <ul className="divide-y divide-border-soft">
              {review.tasks.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 text-[15px] text-ink">
                    {t.title}
                    <span className="block text-sm text-ink-muted">
                      {TASK_STATUS_LABEL[t.status]}
                      {t.assignees.length ? ` · ${t.assignees.map((a) => a.name).join(", ")}` : " · Unassigned"}
                    </span>
                  </span>
                  {isOwner ? (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          act(
                            () =>
                              api(`/api/v1/tasks/${t.id}`, {
                                method: "PATCH",
                                json: { status: "done" },
                              }),
                            `“${t.title}” marked done.`,
                          )
                        }
                      >
                        Mark done
                      </Button>
                      {people.length ? (
                        <>
                          <label htmlFor={`follow-${t.id}`} className="sr-only">
                            Follow-up owner for {t.title}
                          </label>
                          <Select
                            id={`follow-${t.id}`}
                            value={followUp[t.id] ?? ""}
                            className="w-auto"
                            onChange={(e) => {
                              const who = people.find((p) => p.id === e.target.value);
                              setFollowUp((f) => ({
                                ...f,
                                [t.id]: e.target.value,
                              }));
                              if (who)
                                void act(
                                  () =>
                                    api(`/api/v1/tasks/${t.id}/assignees`, {
                                      method: "POST",
                                      json: { creatorId: who.id },
                                    }),
                                  `${who.name} will follow up on “${t.title}”.`,
                                );
                            }}
                          >
                            <option value="">Assign follow-up…</option>
                            {people.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </Select>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="text-sm text-ink-muted">Tasks left open stay on the Creative Room as a record of what wasn&rsquo;t finished.</p>
          </Step>

          <Step
            n={2}
            title="Creations"
            ok={!review.pieces.some((p) => p.status === "draft") && !review.proposals.length}
            okText={review.pieces.length ? `${review.pieces.length} ${review.pieces.length === 1 ? "Creation" : "Creations"}, none left in draft.` : "No Creations are linked to this Creative Room."}
          >
            {review.pieces.filter((p) => p.status === "draft").length ? (
              <ul className="space-y-1">
                {review.pieces
                  .filter((p) => p.status === "draft")
                  .map((p) => (
                    <li key={p.id} className="text-[15px] text-ink">
                      {p.href ? (
                        <Link href={p.href} className="font-medium hover:underline">
                          {p.title}
                        </Link>
                      ) : (
                        p.title
                      )}{" "}
                      <Badge tone="neutral">Draft</Badge>
                    </li>
                  ))}
              </ul>
            ) : null}
            {review.proposals.map((p) => (
              <p key={p.id} className="text-[15px] text-ink">
                Open change to{" "}
                <Link href={`/creations/${p.artifactId}/collaborate`} className="font-medium hover:underline">
                  {p.title}
                </Link>
                : {p.summary}
              </p>
            ))}
            <p className="text-sm text-ink-muted">Drafts are fine to keep; open change proposals should be accepted or declined so contributors know where they stand.</p>
          </Step>

          <Step n={3} title="Rights" ok={!review.rights.unrecorded.length && !review.rights.claims.length} okText="Every Creation has a rights record and no ownership claims are waiting.">
            {review.rights.claims.map((a) => (
              <p key={a.id} className="text-[15px] text-ink">
                {a.creator.name}&rsquo;s claim on {a.artifact.title}: {a.claimLabel} <Badge tone={a.status === "disputed" ? "warning" : "accent"}>{a.statusLabel}</Badge>
              </p>
            ))}
            {review.rights.unrecorded.length ? <p className="text-[15px] text-ink">No rights record yet: {review.rights.unrecorded.map((r) => r.title).join(", ")}.</p> : null}
            {review.rights.exclusive.length ? (
              <p className="text-sm text-ink-muted">Exclusive licences stay in force after completion: {review.rights.exclusive.map((r) => r.title).join(", ")}.</p>
            ) : null}
            <Link href={`/rooms/${project.id}?tab=rights`} className="inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">
              Review rights
            </Link>
          </Step>

          <Step
            n={4}
            title="Attribution"
            ok={!review.attribution.uncredited.length}
            okText={`${review.attribution.contributions} ${review.attribution.contributions === 1 ? "contribution is" : "contributions are"} recorded, and everyone in the Creative Room has at least one.`}
          >
            <p className="text-[15px] text-ink">No contributions recorded for: {review.attribution.uncredited.map((p) => p.name).join(", ")}.</p>
            <p className="text-sm text-ink-muted">Record what they did so they&rsquo;re credited — or leave it if they didn&rsquo;t contribute.</p>
            <Link href={`/rooms/${project.id}?tab=contributions`} className="inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline">
              Review contributions
            </Link>
          </Step>

          <Step n={5} title="Approvals" ok={!open.approvals && !open.licence_requests} okText="Nothing is waiting for approval.">
            {approvals.map((a) => (
              <p key={a.id} className="text-[15px] text-ink">
                CreativeMind is waiting:{" "}
                <Link href={`/approvals/${a.id}`} className="font-medium hover:underline">
                  {a.actionLabel}
                </Link>
              </p>
            ))}
            {licenceRequests.map((l) => (
              <p key={l.id} className="text-[15px] text-ink">
                Licence request for{" "}
                <Link href={`/creations/${l.artifactId}?tab=rights`} className="font-medium hover:underline">
                  {l.title}
                </Link>
              </p>
            ))}
            {open.approvals + open.licence_requests > approvals.length + licenceRequests.length ? (
              <p className="text-sm text-ink-muted">Some are on other people&rsquo;s Creations or conversations.</p>
            ) : null}
          </Step>

          <section aria-label="Close the Creative Room" className="rounded-2xl border border-border bg-surface px-4 py-4 sm:px-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent text-sm text-white">6</span>
              Close the Creative Room
            </h2>
            {isOwner ? (
              <form
                className="mt-3 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError(null);
                  try {
                    await api(`/api/v1/projects/${project.id}/completion`, {
                      method: "POST",
                      json: {
                        outcome,
                        dissolveCrew: dissolve,
                        confirmTitle,
                        acknowledgeOpen: acknowledge,
                        note: note.trim() || null,
                      },
                    });
                    setMsg(outcome === "completed" ? "Creative Room completed. Everything is kept." : "Creative Room archived. Everything is kept.");
                    router.refresh();
                  } catch (err) {
                    setError(errorMessage(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-ink">Outcome</legend>
                  {(
                    [
                      ["completed", "Completed", "The work is finished. The Creative Room stays in your list as completed."],
                      ["archived", "Archived", "Put away. It moves out of your active Creative Rooms but stays searchable."],
                    ] as const
                  ).map(([value, label, help]) => (
                    <label key={value} className="flex min-h-11 items-start gap-3 text-[15px] text-ink">
                      <input type="radio" name="outcome" value={value} checked={outcome === value} onChange={() => setOutcome(value)} className="mt-1 size-5 accent-[var(--color-accent)]" />
                      <span>
                        {label}
                        <span className="block text-sm text-ink-muted">{help}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                {crew && crew.status !== "completed" ? (
                  <label className="flex min-h-11 items-start gap-3 text-[15px] text-ink">
                    <input type="checkbox" checked={dissolve} onChange={(e) => setDissolve(e.target.checked)} className="mt-1 size-5 accent-[var(--color-accent)]" />
                    <span>
                      Dissolve {crew.name}
                      <span className="block text-sm text-ink-muted">
                        The crew stops taking new members
                        {crew.invited ? ` and ${crew.invited} pending ${crew.invited === 1 ? "invitation lapses" : "invitations lapse"}` : ""}. Its {crew.active}{" "}
                        {crew.active === 1 ? "member keeps" : "members keep"} access to the Creative Room&rsquo;s history, chat and records.
                      </span>
                    </span>
                  </label>
                ) : null}
                {openTotal ? (
                  <label className="flex min-h-11 items-start gap-3 text-[15px] text-ink">
                    <input type="checkbox" checked={acknowledge} onChange={(e) => setAcknowledge(e.target.checked)} className="mt-1 size-5 accent-[var(--color-accent)]" />
                    <span>
                      Close with {openTotal} {openTotal === 1 ? "item" : "items"} still open
                      <span className="block text-sm text-ink-muted">They stay on record as they are.</span>
                    </span>
                  </label>
                ) : null}
                <Field label="Closing note (optional)" htmlFor="complete-note" hint="For the crew and the Creative Room's history.">
                  <Textarea id="complete-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} className="min-h-20" />
                </Field>
                <Field label={`Type “${project.title}” to confirm`} htmlFor="complete-confirm">
                  <Input id="complete-confirm" value={confirmTitle} onChange={(e) => setConfirmTitle(e.target.value)} autoComplete="off" />
                </Field>
                <Button type="submit" loading={busy} disabled={confirmTitle.trim().toLowerCase() !== project.title.trim().toLowerCase() || (openTotal > 0 && !acknowledge)}>
                  {outcome === "completed" ? "Complete Creative Room" : "Archive Creative Room"}
                </Button>
              </form>
            ) : (
              <p className="mt-2 text-[15px] text-ink-muted">Only the Creative Room&rsquo;s owner can complete it. You can help by resolving the items above.</p>
            )}
          </section>
        </>
      ) : isOwner ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setReopening(true)}>Reopen Creative Room</Button>
          {project.status === "completed" ? <p className="w-full text-sm text-ink-muted">To archive it instead, reopen it and close it again.</p> : null}
        </div>
      ) : null}

      {review.history.length ? (
        <section aria-label="Completion history">
          <h2 className="mb-2 text-lg font-semibold text-ink">History</h2>
          <ol className="space-y-2">
            {review.history.map((h) => (
              <li key={h.id} className={cn("rounded-2xl border border-border-soft bg-surface px-4 py-3 text-[15px] text-ink")}>
                {h.outcome === "completed" ? "Completed" : "Archived"} by {h.by ?? "the owner"} · <LocalTime iso={h.at} options={{ dateStyle: "medium" }} />
                {h.crewDissolved ? " · crew dissolved" : ""}
                {h.acknowledgedOpen ? (
                  <span className="block text-sm text-ink-muted">
                    Closed with open items:{" "}
                    {Object.entries(h.openItems)
                      .filter(([, v]) => (v ?? 0) > 0)
                      .map(([k, v]) => `${v} ${OPEN_LABEL[k] ?? k}`)
                      .join(", ")}
                  </span>
                ) : null}
                {h.note ? <span className="block text-sm text-ink-muted">“{h.note}”</span> : null}
                {h.reopened ? (
                  <span className="block text-sm text-ink-muted">
                    Reopened by {h.reopened.by ?? "the owner"} · <LocalTime iso={h.reopened.at} options={{ dateStyle: "medium" }} />
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <ConfirmDialog
        open={reopening}
        onOpenChange={setReopening}
        title="Reopen this Creative Room?"
        body={crew?.status === "completed" ? "It becomes active again, and so does its crew." : "It becomes active again."}
        confirmLabel="Reopen"
        onConfirm={() => act(() => api(`/api/v1/projects/${project.id}/reopen`, { method: "POST" }), "Creative Room reopened.").then(() => setReopening(false))}
      />
    </div>
  );
}
