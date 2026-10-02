import { notFound } from "next/navigation";
import { PaletteScope } from "@/components/creative-palette";
import { flagOn } from "@/lib/features";
import { requireSession } from "@/lib/session";
import { candidateCards, sourceRows } from "@/lib/sources";
import { SourcesView } from "./sources-view";

export const metadata = { title: "Personal Sources" };

/**
 * Personal Sources (owner spec + boards, 2 Oct 2026): connect your world, sync on your terms, and see the few things
 * worth exploring. Connect, Discover, Review and Bring In stay separate; nothing becomes a Material until you choose it.
 */
export default async function SourcesPage() {
  if (!flagOn("personal_sources_enabled")) notFound();
  const { db } = await requireSession();
  const [sources, candidates] = await Promise.all([sourceRows(db), candidateCards(db)]);
  return (
    <>
      <PaletteScope context={{ page: "settings", strip: { label: "Personal Sources" } }} />
      <SourcesView sources={sources} candidates={candidates} />
    </>
  );
}
