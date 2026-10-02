import type { Db } from "@wonder/db";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/**
 * A back button that knows where the creator came from (owner, 29 Sep 2026: "on click of 'see more' it moves to a new
 * page; there should be a context aware back button"). Pages opened from the Studio carry `?from=studio:<creation id>`;
 * the label names that Creation, read under the viewer's own access — an unknown or unreadable value shows nothing.
 */
export async function ContextBack({ db, from }: { db: Db; from: string | undefined }) {
  const m = /^studio:([0-9a-f-]{36})$/i.exec(from ?? "");
  if (!m) return null;
  const { data: a } = await db.from("artifacts").select("id, title").eq("id", m[1]!).maybeSingle();
  if (!a) return null;
  return (
    <Link href={`/creations/${a.id}/studio`} className="-ml-2 mb-1 inline-flex min-h-11 max-w-full items-center gap-1 rounded-full pr-3 text-[13.5px] font-medium text-ink-muted hover:text-ink">
      <ChevronLeft className="size-5 shrink-0" aria-hidden />
      <span className="truncate">Back to {a.title || "the Creative Studio"}</span>
    </Link>
  );
}
