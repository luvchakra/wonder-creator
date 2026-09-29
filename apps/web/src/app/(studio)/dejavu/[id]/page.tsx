import { MOMENT_FILTERS, getDejaVu, getDejaVuMoments, type MomentFilter } from "@wonder/creator-moments";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { withThumbs } from "@/lib/moments";
import { DejaVuView } from "./view";
import { flagOn } from "@/lib/features";

export const metadata = { title: "DejaVu" };

/**
 * One DejaVu (docs/moments-dejavu.md §9): every Moment carrying this thread, across Materials, notes and Creations,
 * newest first under Today / Yesterday / month / year. Only what the viewer can still open is shown (checked by each
 * owning domain, server-side).
 */
export default async function DejaVuPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ filter?: string; from?: string; to?: string }> }) {
  if (!flagOn("dejavu_enabled")) notFound();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await requireSession();
  const dejavu = await getDejaVu(db, id).catch(() => null);
  if (!dejavu) notFound();
  const filter = sp.filter && (MOMENT_FILTERS as readonly string[]).includes(sp.filter) ? (sp.filter as MomentFilter) : null;
  const range = { from: sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : null, to: sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : null };
  const page = await withThumbs(db, await getDejaVuMoments(db, id, { filter, dateFrom: range.from, dateTo: range.to }));
  return <DejaVuView key={`${filter}:${range.from}:${range.to}`} dejavu={dejavu} filter={filter} range={range} initial={page} />;
}
