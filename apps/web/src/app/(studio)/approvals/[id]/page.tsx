import { getApproval } from "@wonder/creator-brain";
import { getAutonomy } from "@wonder/creator-identity";
import { AUTONOMY_LEVELS } from "@wonder/creator-identity/autonomy";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ApprovalDetail } from "./approval-detail";
import { PaletteScope } from "@/components/creative-palette";

export const metadata = { title: "Approval" };

export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, creator } = await requireSession();
  const [approval, autonomy] = await Promise.all([getApproval(db, id).catch(() => null), getAutonomy(db, creator.id)]);
  if (!approval) notFound();
  const level = autonomy[approval.domain as keyof typeof autonomy];
  const setting = level ? (AUTONOMY_LEVELS.find((l) => l.level === level)?.label ?? level) : null;
  return (
    <>
      <PaletteScope context={{ page: "approval", ids: { approvalArtifactId: approval.target.kind === "artifact" ? (approval.target.id ?? undefined) : undefined } }} />
      <ApprovalDetail key={approval.id} approval={approval} setting={setting} />
    </>
  );
}
