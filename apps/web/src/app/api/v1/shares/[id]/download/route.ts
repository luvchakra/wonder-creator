import { DomainError } from "@wonder/core";
import { openCreatorShare } from "@wonder/creator-studio";
import { requireUuid, withApi } from "@/lib/api";
import { sharedDownload } from "@/lib/shared";

/** Download something shared with you by name, when the owner allowed downloads. */
export const GET = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const piece = await openCreatorShare(db, requireUuid(id, "share"));
  if (!piece) throw new DomainError("not_found", "This share has ended or was turned off.");
  return sharedDownload(piece, req.nextUrl.searchParams.get("format"));
});
