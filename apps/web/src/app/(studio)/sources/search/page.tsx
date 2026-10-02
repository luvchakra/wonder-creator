import { notFound } from "next/navigation";
import { PaletteScope } from "@/components/creative-palette";
import { flagOn } from "@/lib/features";
import { requireSession } from "@/lib/session";
import { SearchWorld } from "./search-world";

export const metadata = { title: "Search your world" };

/** Search your world (board "Personal Sources — Part 2"): what discovery found, grouped by source; look further back. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if (!flagOn("personal_sources_enabled")) notFound();
  await requireSession();
  const { q } = await searchParams;
  return (
    <>
      <PaletteScope context={{ page: "search", strip: { label: "Search your world" } }} />
      <SearchWorld initialQuery={(q ?? "").slice(0, 80)} />
    </>
  );
}
