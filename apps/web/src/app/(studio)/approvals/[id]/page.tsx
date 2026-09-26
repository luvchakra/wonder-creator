import { getApproval } from "@wonder/creator-brain";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ApprovalDetail } from "./approval-detail";

export const metadata = { title: "Approval" };

export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await requireSession();
  const approval = await getApproval(db, id).catch(() => null);
  if (!approval) notFound();
  return <ApprovalDetail key={approval.id} approval={approval} />;
}
