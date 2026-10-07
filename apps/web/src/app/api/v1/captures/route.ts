import { CAPTURE_KINDS, recentCaptures, type CaptureKind } from "@/lib/captures";
import { withApi } from "@/lib/api";

/** GET /api/v1/captures?kind=&before=&limit= — the caller's own captures, newest first (Home's "My captures"). */
export const GET = withApi(async ({ db, creatorId, req }) => {
  const sp = req.nextUrl.searchParams;
  const kind = (CAPTURE_KINDS as readonly string[]).includes(sp.get("kind") ?? "") ? (sp.get("kind") as CaptureKind) : null;
  return recentCaptures(db, creatorId, { kind, before: sp.get("before"), limit: Number(sp.get("limit")) || 24 });
});
