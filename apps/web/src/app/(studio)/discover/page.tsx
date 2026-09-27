import { findCollaborators, listShortlist, parseTerms } from "@wonder/creator-identity";
import { avatarUrls } from "@/lib/avatars";
import { requireSession } from "@/lib/session";
import { DiscoverView } from "./discover-view";

export const metadata = { title: "Find collaborators" };

const AVAIL = ["open", "selective", "closed"] as const;

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { db, creator } = await requireSession();
  const raw = await searchParams;
  const one = (k: string) => (Array.isArray(raw[k]) ? raw[k][0] : raw[k]) as string | undefined;
  const sp = { project: one("project"), terms: one("terms"), interest: one("interest"), location: one("location"), network: one("network") };
  // Checkboxes repeat the parameter; links may pass a comma-separated list.
  const availabilityParam = raw.availability === undefined ? ["open", "selective"] : ([] as string[]).concat(raw.availability).flatMap((a) => a.split(","));
  const projectId = sp.project && /^[0-9a-f-]{36}$/i.test(sp.project) ? sp.project : null;
  const availability = availabilityParam.filter((a): a is (typeof AVAIL)[number] => (AVAIL as readonly string[]).includes(a));
  const filters = {
    terms: sp.terms ?? "",
    interest: sp.interest ?? "",
    location: sp.location ?? "",
    availability: availability.length ? availability : (["open", "selective"] as Array<(typeof AVAIL)[number]>),
    network: sp.network === "1",
  };
  const searched = !!(filters.terms || filters.interest || filters.location || filters.network);

  const project = projectId ? (await db.from("projects").select("id, title, creator_id").eq("id", projectId).maybeSingle()).data : null;
  const crew = project ? (await db.from("crews").select("id, status").eq("project_id", project.id).maybeSingle()).data : null;
  const { data: crewAccess } = crew ? await db.rpc("project_role_of", { p_project: project!.id }) : { data: null };

  const [people, shortlist] = await Promise.all([
    searched
      ? findCollaborators(db, {
          terms: parseTerms(filters.terms),
          interest: filters.interest || null,
          location: filters.location || null,
          availability: filters.availability,
          networkOnly: filters.network,
          projectId: project?.id ?? null,
        }).catch(() => [])
      : Promise.resolve([]),
    listShortlist(db, creator.id, project?.id ?? null),
  ]);
  const avatars = await avatarUrls(db, [...people.map((p) => p.id), ...shortlist.map((s) => s.candidate.id)]);

  return (
    <DiscoverView
      filters={filters}
      searched={searched}
      people={people.map((p) => ({ ...p, avatarUrl: avatars[p.id] ?? null }))}
      shortlist={shortlist.map((s) => ({ ...s, avatarUrl: avatars[s.candidate.id] ?? null }))}
      project={project ? { id: project.id, title: project.title } : null}
      crew={crew && crew.status !== "completed" && (crewAccess === "owner" || crewAccess === "admin") ? { id: crew.id } : null}
    />
  );
}
