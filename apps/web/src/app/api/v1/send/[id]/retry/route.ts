import { DomainError, must } from "@wonder/core";
import { processIntake } from "@wonder/creator-send";
import { requireUuid, withApi } from "@/lib/api";
import { providerFor } from "@/lib/brain";
import { serviceClient } from "@/lib/supabase/service";

export const maxDuration = 120;

export const POST = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  // RLS read proves the intake item belongs to the caller before the service client touches it.
  const item = must(await db.from("intake_items").select("id, state").eq("id", requireUuid(id, "item")).maybeSingle(), "We couldn't find that item.");
  if (item.state !== "failed") throw new DomainError("conflict", "This item doesn't need a retry.");
  const result = await processIntake({ db, service: serviceClient(), creatorId, provider: (await providerFor(creatorId)).provider }, item.id).catch((e) => ({ error: e }));
  if ("error" in result) throw result.error;
  return { item: result };
}, { rateLimit: 20 });
