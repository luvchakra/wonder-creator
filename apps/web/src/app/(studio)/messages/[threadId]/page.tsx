import { getThread, markThreadRead } from "@wonder/creator-projects";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ThreadView } from "./thread-view";

export const metadata = { title: "Conversation" };

export default async function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(threadId)) notFound();
  const { db, creator } = await requireSession();
  const thread = await getThread(db, creator.id, threadId).catch(() => null);
  if (!thread) notFound();
  await markThreadRead(db, creator.id, threadId);
  const other = thread.other.id;

  // What a message can be about: projects and pieces both of you can open.
  const [projects, pieces] = await Promise.all([
    db.from("projects").select("id, title, creator_id, crews(crew_members(creator_id, status))").neq("status", "archived").limit(200),
    db.from("artifacts").select("id, title, creator_id, artifact_contributors(contributor_creator_id)").or(`creator_id.eq.${creator.id},creator_id.eq.${other}`).neq("status", "archived").limit(300),
  ]);
  type CrewRow = { crew_members: Array<{ creator_id: string; status: string }> } | Array<{ crew_members: Array<{ creator_id: string; status: string }> }> | null;
  const inProject = (p: { creator_id: string; crews: unknown }, who: string) =>
    p.creator_id === who || ([] as Array<{ crew_members: Array<{ creator_id: string; status: string }> }>).concat((p.crews as CrewRow) ?? []).some((c) => c.crew_members.some((m) => m.creator_id === who && m.status === "active"));
  const involved = (a: { creator_id: string; artifact_contributors: Array<{ contributor_creator_id: string }> }, who: string) => a.creator_id === who || a.artifact_contributors.some((c) => c.contributor_creator_id === who);
  const about = [
    ...(projects.data ?? []).filter((p) => inProject(p, creator.id) && inProject(p, other)).map((p) => ({ value: `project:${p.id}`, label: `Project: ${p.title}` })),
    ...(pieces.data ?? [])
      .filter((a) => involved(a, creator.id) && involved(a, other))
      .map((a) => ({ value: `artifact:${a.id}`, label: `Piece: ${a.title}` })),
  ];
  return <ThreadView thread={thread} about={about} />;
}
