import { huddleSummary } from "@wonder/creator-huddle";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { SummaryView } from "./summary-view";
import { PaletteScope } from "@/components/creative-palette";

export const metadata = { title: "Huddle summary" };

/** Your own record of a Huddle you were in: when, who you met, what you saved. The chat itself is gone. */
export default async function HuddleSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await requireSession();
  const summary = await huddleSummary(db, id);
  if (!summary) notFound();
  return (
    <>
      <PaletteScope context={{ page: "huddle-summary" }} />
      <SummaryView summary={summary} />
    </>
  );
}
