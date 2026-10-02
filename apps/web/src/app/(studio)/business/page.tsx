import { listBusinessRecords } from "@wonder/creator-studio";
import { requireSession } from "@/lib/session";
import { Ledger } from "./ledger";

export const metadata = { title: "Business" };

/** CreatorBusiness (P1-19): what the creator's work has earned and cost. Licence fees paid through Stripe or Razorpay settle here automatically; everything else is recorded by the creator. */
export default async function BusinessPage() {
  const { db } = await requireSession();
  const records = await listBusinessRecords(db);
  const titles = new Map<string, string>();
  const ids = [...new Set(records.map((r) => r.artifact_id).filter((x): x is string => !!x))];
  if (ids.length) {
    const { data } = await db.from("artifacts").select("id, title").in("id", ids);
    for (const a of data ?? []) titles.set(a.id, a.title);
  }
  return <Ledger initial={records.map((r) => ({ ...r, artifactTitle: r.artifact_id ? (titles.get(r.artifact_id) ?? null) : null }))} />;
}
