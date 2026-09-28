import "server-only";
import { signedUrlsFor } from "@wonder/creator-library";
import type { Db } from "@wonder/db";
import { DomainError } from "@wonder/core";

/** Short-lived thumbnails for Working Set rows, signed through the viewer's own access. */
export const studioSigner = (db: Db) => (ids: string[]) => signedUrlsFor(db, ids);

export function assertUuid(...ids: string[]) {
  for (const id of ids) if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("not_found", "That isn't available.");
}
