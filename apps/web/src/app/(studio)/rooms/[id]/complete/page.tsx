import { listApprovals } from "@wonder/creator-brain";
import { completionReview, projectConversationIds } from "@wonder/creator-projects";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { CompleteView } from "./complete-view";

export const metadata = { title: "Complete Creative Room" };

export default async function CompleteProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const review = await completionReview(db, creator.id, id).catch(() => null);
  if (!review) notFound();
  const conversationIds = await projectConversationIds(db, id);
  const approvals = await listApprovals(db, {
    state: "open",
    conversationIds,
  }).catch(() => []);
  const licenceRequests = review.pieces.length
    ? ((
        await db
          .from("license_requests")
          .select("id, artifact_id, artifacts(title)")
          .in(
            "artifact_id",
            review.pieces.map((p) => p.id),
          )
          .in("status", ["pending", "countered"])
          .limit(50)
      ).data ?? [])
    : [];
  return (
    <CompleteView
      viewerId={creator.id}
      review={review}
      approvals={approvals.map((a) => ({
        id: a.id,
        actionLabel: a.actionLabel,
      }))}
      licenceRequests={licenceRequests.map((l) => ({
        id: l.id,
        artifactId: l.artifact_id,
        title: (l.artifacts as { title: string } | null)?.title ?? "A Creation",
      }))}
    />
  );
}
