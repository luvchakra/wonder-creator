import { listApprovals } from "@wonder/creator-brain";
import { z } from "zod";
import { withApi } from "@/lib/api";

/** The Approval Center: CreatorBrain's proposals waiting on the creator (open) or already decided (closed). */
export const GET = withApi(async ({ db, req }) => {
  const state = z.enum(["open", "closed"]).default("open").parse(new URL(req.url).searchParams.get("state") ?? undefined);
  return { approvals: await listApprovals(db, { state }) };
});
