import { notFound } from "next/navigation";
import { PaletteScope } from "@/components/creative-palette";
import { flagOn } from "@/lib/features";
import { requireSession } from "@/lib/session";
import { candidateDetail } from "@/lib/sources";
import { ReviewCandidate } from "./review";

export const metadata = { title: "From your world" };

/** Review one group (board "Candidate detail"): choose exactly what to bring in. Nothing is brought in by looking. */
export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  if (!flagOn("personal_sources_enabled")) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { db } = await requireSession();
  const c = await candidateDetail(db, id);
  if (!c || c.state === "dismissed") notFound();
  if (c.state === "new") await db.from("context_candidates").update({ state: "reviewed" }).eq("id", id);
  return (
    <>
      <PaletteScope context={{ page: "settings", strip: { label: c.title } }} />
      <ReviewCandidate c={c} />
    </>
  );
}
