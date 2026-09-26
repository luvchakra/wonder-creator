import { audit, DomainError, publishEvent } from "@wonder/core";
import { downloadUrlFor, getMaterial } from "@wonder/creator-library";
import { NextResponse } from "next/server";
import { requireUuid, withApi } from "@/lib/api";

/** Download the stored original (owner only). Redirects to a one-minute signed URL; quarantined files are never served. */
export const GET = withApi<{ id: string }>(
  async ({ db }, { id }) => {
    const materialId = requireUuid(id, "material");
    const m = await getMaterial(db, materialId);
    if (!m.storage_object_id)
      throw new DomainError(
        "not_found",
        "This material has no stored file to download.",
      );
    const url = await downloadUrlFor(db, m.storage_object_id);
    if (!url)
      throw new DomainError("forbidden", "This file can't be downloaded.");
    await publishEvent(db, {
      type: "CreativeMaterialExported",
      aggregate: "material",
      aggregateId: materialId,
      payload: { kind: "original" },
    }).catch(() => undefined);
    await audit(db, { action: "material.downloaded", objectType: "material", objectId: materialId });
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "cache-control": "no-store" },
    });
  },
  { rateLimit: 30 },
);
