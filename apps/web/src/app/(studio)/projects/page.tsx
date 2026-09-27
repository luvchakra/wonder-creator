import { signedUrlsFor } from "@wonder/creator-library";
import { listProjects, PROJECT_STATUSES, PROJECT_STATUS_LABEL, type ProjectStatus } from "@wonder/creator-projects";
import { BACKGROUNDS, EmptyState, PageTitle, cn } from "@wonder/ui";
import Link from "next/link";
import { ProjectCard } from "@/components/project-card";
import { requireSession } from "@/lib/session";
import { NewProjectButton } from "./new-project";

export const metadata = { title: "Projects" };

const FILTERS = [{ key: "open", label: "All" }, ...PROJECT_STATUSES.map((s) => ({ key: s, label: PROJECT_STATUS_LABEL[s] }))] as const;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { db } = await requireSession();
  const sp = await searchParams;
  const status = (FILTERS.find((f) => f.key === sp.status)?.key ?? "open") as ProjectStatus | "open";
  const projects = await listProjects(db, { status });
  const covers = await signedUrlsFor(db, projects.map((p) => p.coverObjectId));

  return (
    <div>
      <PageTitle title="My Projects" subtitle="Bring material, pieces, conversations and Huddles together around one piece of work." action={<NewProjectButton />} />
      <nav aria-label="Filter projects" className="-mx-4 mb-6 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {FILTERS.map((f) => (
            <li key={f.key}>
              <Link
                href={f.key === "open" ? "/projects" : `/projects?status=${f.key}`}
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
          title={status === "open" ? "No projects yet" : `No ${PROJECT_STATUS_LABEL[status as ProjectStatus].toLowerCase()} projects`}
          body={status === "open" ? "A project gathers what belongs to one piece of work — your material, pieces, conversations and Huddles — without moving or copying any of it." : "Projects with this status will appear here."}
          action={status === "open" ? <NewProjectButton /> : undefined}
        />
      )}
    </div>
  );
}
