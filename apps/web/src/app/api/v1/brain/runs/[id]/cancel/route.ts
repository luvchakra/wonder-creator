import { requestCancel } from "@wonder/creator-brain";
import { requireUuid, withApi } from "@/lib/api";

/** Ask a running creation to stop before its next stage. Deterministic: once saving has begun, the piece is kept. */
export const POST = withApi<{ id: string }>(async ({ db }, { id }) => requestCancel(db, requireUuid(id, "run")));
