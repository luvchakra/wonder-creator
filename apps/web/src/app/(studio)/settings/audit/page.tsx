import { PageTitle } from "@wonder/ui";
import Link from "next/link";
import { AUDIT_CATEGORIES, listAudit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { AuditView } from "./audit-view";
import { PaletteScope } from "@/components/creative-palette";

export const metadata = { title: "Security & activity" };

export default async function AuditPage() {
  const { db, creator } = await requireSession();
  const [first, signIns, shares, published] = await Promise.all([
    listAudit(db, {}),
    listAudit(db, { category: "security", limit: 20 }),
    db.from("artifact_shares").select("id", { count: "exact", head: true }).eq("creator_id", creator.id).is("revoked_at", null).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
    db.from("publications").select("id", { count: "exact", head: true }).eq("status", "published"),
  ]);
  const lastSignIn = signIns.entries.find((e) => e.title === "Signed in" || e.title === "Created your account") ?? null;
  const failedChecks = signIns.entries.filter((e) => e.outcome === "failed").length;
  return (
    <>
      <PaletteScope context={{ page: "settings" }} />
      <div className="mx-auto max-w-3xl">
        <Link href="/settings?section=privacy" className="inline-flex min-h-11 items-center text-sm text-accent-ink hover:underline">
          ← Privacy & Security
        </Link>
        <PageTitle title="Security & activity" subtitle="What happened on your account, in plain words. Only you can see this." />
        <AuditView
          categories={[...AUDIT_CATEGORIES]}
          initial={first}
          summary={{
            lastSignIn: lastSignIn ? { at: lastSignIn.at, device: lastSignIn.details.find((d) => d.label === "Device")?.value ?? null } : null,
            failedChecks,
            liveShares: shares.count ?? 0,
            published: published.count ?? 0,
          }}
        />
      </div>
    </>
  );
}
