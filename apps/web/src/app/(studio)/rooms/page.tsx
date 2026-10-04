import { signedUrlsFor } from "@wonder/creator-library";
import { listProjects, myCrewInvites, PROJECT_STATUSES, PROJECT_STATUS_LABEL, type ProjectStatus } from "@wonder/creator-projects";
import { BACKGROUNDS, EmptyState, PageTitle, cn, KIT } from "@wonder/ui";
import Link from "next/link";
import { LocalTime } from "@/components/client-time";
import { ProjectCard } from "@/components/project-card";
import { requireSession } from "@/lib/session";
import { NewProjectButton } from "./new-project";

export const metadata = { title: "Creative Rooms" };

const FILTERS = [{ key: "open", label: "All" }, ...PROJECT_STATUSES.map((s) => ({ key: s, label: PROJECT_STATUS_LABEL[s] }))] as const;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string; new?: string }> }) {
  const { db, creator } = await requireSession();
  const sp = await searchParams;
  const status = (FILTERS.find((f) => f.key === sp.status)?.key ?? "open") as ProjectStatus | "open";
  const [projects, invites] = await Promise.all([listProjects(db, { status, viewerId: creator.id }), myCrewInvites(db, creator.id)]);
  const covers = await signedUrlsFor(db, projects.map((p) => p.coverObjectId));

  return (
    <div>
      <PageTitle art={KIT.painted.flowerBranch} title="My Creative Rooms" subtitle="Bring material, Creations, conversations and Huddles together around one piece of work." action={<NewProjectButton initialOpen={sp.new === "1"} />} />
      {invites.length ? (
        <section aria-label="Crew invitations" className="mb-6 space-y-2">
          {invites.map((i) => (
            <Link key={i.crewId} href={`/crews/${i.crewId}`} className="flex min-h-11 items-center gap-3 rounded-2xl border border-[#cfd0ff] bg-accent-softer px-4 py-3 text-[15px] text-ink hover:bg-accent-soft">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{i.invitedBy}</span> invited you to join <span className="font-medium">{i.crewName}</span>
                {i.roleTitle ? ` as ${i.roleTitle}` : ""} <span className="text-ink-muted">· {i.projectTitle}</span>
                {i.expiresAt ? (
                  <span className="block text-sm text-ink-muted">
                    Answer by <LocalTime iso={i.expiresAt} />
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-sm font-medium text-accent-ink">View invitation</span>
            </Link>
          ))}
        </section>
      ) : null}
      <nav aria-label="Filter Creative Rooms" className="-mx-4 mb-6 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {FILTERS.map((f) => (
            <li key={f.key}>
              <Link
                href={f.key === "open" ? "/rooms" : `/rooms?status=${f.key}`}
                aria-current={status === f.key ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm",
                  status === f.key ? "bg-accent text-white" : "border border-border bg-surface text-ink-muted hover:border-accent",
                )}
              >
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {projects.length ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <ProjectCard p={{ ...p, coverUrl: p.coverObjectId ? (covers[p.coverObjectId] ?? null) : null }} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          image={BACKGROUNDS.botanicalLeaves}
          title={status === "open" ? "No Creative Rooms yet" : `No ${PROJECT_STATUS_LABEL[status as ProjectStatus].toLowerCase()} Creative Rooms`}
          body={status === "open" ? "A Creative Room gathers what belongs to one piece of work — your material, Creations, conversations and Huddles — without moving or copying any of it." : "Creative Rooms with this status will appear here."}
          action={status === "open" ? <NewProjectButton /> : undefined}
        />
      )}
    </div>
  );
}
