import { openCreatorShare } from "@wonder/creator-studio";
import { EmptyState } from "@wonder/ui";
import { notFound } from "next/navigation";
import { SharedPieceView } from "@/components/shared-piece";
import { requireSession } from "@/lib/session";
import { BackLink } from "@/components/back-link";

export const metadata = { title: "Shared with you" };

export default async function SharedPiecePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await requireSession();
  const piece = await openCreatorShare(db, id).catch(() => null);
  return (
    <div>
      <div className="mx-auto max-w-2xl">
        <BackLink home="/shared" homeLabel="Shared with you" />
      </div>
      {piece ? (
        <SharedPieceView piece={piece} downloadBase={`/api/v1/shares/${id}/download`} />
      ) : (
        <div className="mx-auto mt-4 max-w-md">
          <EmptyState title="This isn't shared with you anymore" body="The creator may have ended or turned off this share." />
        </div>
      )}
    </div>
  );
}
