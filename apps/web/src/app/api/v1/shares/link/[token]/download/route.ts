import { DomainError } from "@wonder/core";
import { openShareLink } from "@wonder/creator-studio";
import { withApi } from "@/lib/api";
import { sharedDownload } from "@/lib/shared";

/** Download through a private link (signed-out visitors included), when the owner allowed downloads. */
export const GET = withApi<{ token: string }>(async ({ db, req }, { token }) => {
  const piece = await openShareLink(db, token);
  if (!piece) throw new DomainError("not_found", "This link has expired or was turned off.");
  return sharedDownload(piece, req.nextUrl.searchParams.get("format"));
}, { public: true, rateLimit: 30 });
