import { requireSession } from "@/lib/session";

/** A Creation's page title: its own name (falling back to the page's kind), read under the viewer's access. */
export async function creationTitle(params: Promise<{ id: string }>, fallback: string) {
  const { id } = await params;
  const { db } = await requireSession();
  const { data } = /^[0-9a-f-]{36}$/i.test(id) ? await db.from("artifacts").select("title").eq("id", id).maybeSingle() : { data: null };
  return { title: data?.title?.trim() || fallback };
}
