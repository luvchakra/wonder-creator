"use client";
import { Avatar, Badge, Button, Field, Input, PageTitle, Textarea, buttonClasses, cn } from "@wonder/ui";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

type Availability = "open" | "selective" | "closed";
const AVAILABILITY_LABEL: Record<Availability, string> = { open: "Open to collaborate", selective: "Selective", closed: "Not taking collaborations" };

export interface Person {
  id: string;
  handle: string | null;
  name: string;
  bio: string | null;
  location: string | null;
  availability: Availability;
  disciplines: string[];
  skills: string[];
  reasons: string[];
  known: boolean;
  signals: { inProject: "active" | "invited" | null };
  avatarUrl: string | null;
}

interface Shortlisted {
  id: string;
  candidate: { id: string; name: string; handle: string | null; disciplines: string[] };
  note: string | null;
  avatarUrl: string | null;
}

export function DiscoverView({
  filters,
  searched,
  people: initial,
  shortlist,
  project,
  crew,
}: {
  filters: { terms: string; interest: string; location: string; availability: Availability[]; network: boolean };
  searched: boolean;
  people: Person[];
  shortlist: Shortlisted[];
  project: { id: string; title: string } | null;
  crew: { id: string } | null;
}) {
  const router = useRouter();
  const [ask, setAsk] = useState("");
  const [asking, setAsking] = useState(false);
  const [brain, setBrain] = useState<{ people: Person[]; offline: boolean; summary: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listed = new Map(shortlist.map((s) => [s.candidate.id, s.id]));
  const shown = brain ? brain.people : initial;

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
    <div className="mx-auto max-w-4xl space-y-6">
      {project ? (
        <Link href={`/projects/${project.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> {project.title}
        </Link>
      ) : null}
      <PageTitle
        title="Find collaborators"
        subtitle={`${project ? `For ${project.title}. ` : ""}Search by what people do and how you know them. Results explain why they're here; nobody is ranked by popularity.`}
      />

      <section aria-label="Ask CreatorBrain" className="rounded-2xl border border-border-soft bg-surface px-4 py-4 sm:px-5">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setAsking(true);
            setError(null);
            try {
              const r = await api<{ query: { terms: string[]; count: number; networkOnly: boolean; location: string | null }; people: Omit<Person, "avatarUrl">[]; offline: boolean }>("/api/v1/collaborators/suggest", {
                method: "POST",
                json: { ask, projectId: project?.id ?? null },
              });
              const q = r.query;
              const summary = [q.terms.length ? q.terms.join(", ") : "anyone", q.networkOnly ? "in your network" : null, q.location ? `in ${q.location}` : null].filter(Boolean).join(" · ");
              setBrain({ people: r.people.map((p) => ({ ...p, avatarUrl: null })), offline: r.offline, summary: `Up to ${q.count}: ${summary}` });
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setAsking(false);
            }
          }}
        >
          <Field label="Who are you looking for?" htmlFor="discover-ask" hint="For example: “Find three cinematographers in my network who fit this project.”">
            <Textarea id="discover-ask" value={ask} onChange={(e) => setAsk(e.target.value)} maxLength={500} className="min-h-16" />
          </Field>
          <Button type="submit" loading={asking} disabled={!ask.trim()}>
            <Sparkles className="size-4" aria-hidden /> Suggest people
          </Button>
        </form>
      </section>

      <details open={!brain} className="rounded-2xl border border-border-soft bg-surface">
        <summary className="min-h-11 cursor-pointer px-4 py-3 text-[15px] font-medium text-ink sm:px-5">Filters</summary>
        <form action="/discover" className="grid gap-4 border-t border-border-soft px-4 py-4 sm:grid-cols-2 sm:px-5">
          {project ? <input type="hidden" name="project" value={project.id} /> : null}
          <Field label="Disciplines or skills" htmlFor="f-terms" hint="Comma-separated, e.g. cinematographer, sound design">
            <Input id="f-terms" name="terms" defaultValue={filters.terms} maxLength={300} />
          </Field>
          <Field label="Interest" htmlFor="f-interest">
            <Input id="f-interest" name="interest" defaultValue={filters.interest} maxLength={60} />
          </Field>
          <Field label="Location" htmlFor="f-location" hint="Only people who show their location match.">
            <Input id="f-location" name="location" defaultValue={filters.location} maxLength={120} />
          </Field>
          <fieldset>
            <legend className="text-sm font-medium text-ink">Availability</legend>
            <div className="mt-1 flex flex-wrap gap-x-4">
              {(["open", "selective", "closed"] as const).map((a) => (
                <label key={a} className="flex min-h-11 items-center gap-2 text-[15px] text-ink">
                  <input type="checkbox" name="availability" value={a} defaultChecked={filters.availability.includes(a)} className="size-5 accent-[var(--color-accent)]" />
                  {AVAILABILITY_LABEL[a]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex min-h-11 items-center gap-2 text-[15px] text-ink sm:col-span-2">
            <input type="checkbox" name="network" value="1" defaultChecked={filters.network} className="size-5 accent-[var(--color-accent)]" />
            Only people I know (crews, Huddles, pieces or follows in common)
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">Search</Button>
          </div>
        </form>
      </details>

      <div aria-live="polite" className="sr-only">
        {msg}
      </div>
      {msg ? <p className="rounded-2xl bg-accent-softer px-4 py-3 text-[15px] text-ink">{msg}</p> : null}
      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fdecec] px-4 py-3 text-[15px] text-danger">
          {error}
        </p>
      ) : null}

      <section aria-label="People">
        {brain ? (
          <p className="mb-3 text-sm text-ink-muted">
            CreatorBrain looked for: {brain.summary}.{" "}
            {brain.offline ? "AI isn't connected, so your request was read with simple rules. " : ""}
            <button type="button" className="font-medium text-accent-ink underline" onClick={() => setBrain(null)}>
              Back to filters
            </button>
          </p>
        ) : null}
        {shown.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {shown.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-surface px-4 py-4">
                <div className="flex items-start gap-3">
                  <Avatar name={p.name} src={p.avatarUrl} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{p.name}</p>
                    <p className="text-sm text-ink-muted">
                      {p.handle ? `@${p.handle}` : null}
                      {p.location ? ` · ${p.location}` : null}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1">
                      <Badge tone={p.availability === "open" ? "success" : p.availability === "selective" ? "accent" : "neutral"}>{AVAILABILITY_LABEL[p.availability]}</Badge>
                      {p.known ? <Badge tone="neutral">In your network</Badge> : null}
                      {p.signals.inProject ? <Badge tone="neutral">{p.signals.inProject === "active" ? "In this crew" : "Invited"}</Badge> : null}
                    </p>
                  </div>
                </div>
                {p.disciplines.length || p.skills.length ? <p className="text-sm text-ink">{[...p.disciplines, ...p.skills].slice(0, 6).join(" · ")}</p> : null}
                <div>
                  <p className="text-sm font-medium text-ink">Why they&rsquo;re here</p>
                  <ul className="mt-0.5 list-disc pl-5 text-sm text-ink-muted">
                    {p.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  {p.handle ? (
                    <Link href={`/creators/${p.handle}`} className={buttonClasses({ variant: "secondary" })} aria-label={`View ${p.name}'s profile`}>
                      View profile
                    </Link>
                  ) : null}
                  {listed.has(p.id) ? (
                    <Button variant="ghost" onClick={() => act(() => api(`/api/v1/collaborators/shortlist/${listed.get(p.id)}`, { method: "DELETE" }), `${p.name} removed from your shortlist.`)} aria-label={`Remove ${p.name} from shortlist`}>
                      On shortlist ✓
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={() => act(() => api("/api/v1/collaborators/shortlist", { method: "POST", json: { candidateId: p.id, projectId: project?.id ?? null } }), `${p.name} added to your shortlist.`)} aria-label={`Shortlist ${p.name}`}>
                      Shortlist
                    </Button>
                  )}
                  {crew && !p.signals.inProject && p.availability !== "closed" ? (
                    <Button onClick={() => act(() => api(`/api/v1/crews/${crew.id}/members`, { method: "POST", json: { creatorId: p.id } }), `${p.name} was invited to the crew.`)} aria-label={`Invite ${p.name} to the crew`}>
                      Invite to crew
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : searched || brain ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface/70 px-5 py-6 text-center text-[15px] text-ink-muted">
            No one matches yet. Try broader words (“photo” finds photographers and photography), or include selective availability.
          </p>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-surface/70 px-5 py-6 text-center text-[15px] text-ink-muted">Search by discipline, skill, interest or location — or ask CreatorBrain.</p>
        )}
      </section>

      <section aria-label="Shortlist">
        <h2 className="mb-2 text-lg font-semibold text-ink">{project ? "Shortlist for this project" : "Your shortlist"}</h2>
        <p className="mb-3 text-sm text-ink-muted">Private to you — the people on it aren&rsquo;t told.</p>
        {shortlist.length ? (
          <ul className="space-y-2">
            {shortlist.map((s) => (
              <li key={s.id} className={cn("flex items-center gap-3 rounded-2xl border border-border-soft bg-surface px-4 py-2")}>
                <Avatar name={s.candidate.name} src={s.avatarUrl} size={36} />
                <span className="min-w-0 flex-1 text-[15px] text-ink">
                  {s.candidate.handle ? (
                    <Link href={`/creators/${s.candidate.handle}`} className="font-medium hover:underline">
                      {s.candidate.name}
                    </Link>
                  ) : (
                    s.candidate.name
                  )}
                  {s.candidate.disciplines.length ? <span className="block text-sm text-ink-muted">{s.candidate.disciplines.slice(0, 3).join(" · ")}</span> : null}
                </span>
                <Button variant="ghost" onClick={() => act(() => api(`/api/v1/collaborators/shortlist/${s.id}`, { method: "DELETE" }), `${s.candidate.name} removed from your shortlist.`)} aria-label={`Remove ${s.candidate.name} from shortlist`}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">Nobody yet.</p>
        )}
      </section>
    </div>
  );
}
