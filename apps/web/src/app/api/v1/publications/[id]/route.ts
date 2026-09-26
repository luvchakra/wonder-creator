import { DomainError } from "@wonder/core";
import { approvePublication, attemptPublication, cancelPublication, updatePublication } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { serviceClient, serviceConfigured } from "@/lib/supabase/service";

export const maxDuration = 60;

/** Edit a draft's copy or schedule (approved publications can't change). */
export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => ({ publication: await updatePublication(db, requireUuid(id, "publication"), await readJson(req)) }));

/**
 * approve: the creator's approval of exactly this version and copy; published now, or at the scheduled time.
 * retry: try a failed publication again (same approval, same idempotency key). cancel: stop it.
 * Outcomes are recorded only from the destination's answer.
 */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  const publicationId = requireUuid(id, "publication");
  const { action } = z.object({ action: z.enum(["approve", "retry", "cancel"]) }).parse(await readJson(req));
  if (action === "cancel") return { publication: await cancelPublication(db, publicationId) };
  if (!serviceConfigured()) throw new DomainError("provider_unavailable", "Publishing isn't set up on this server yet.");
  if (action === "approve") {
    const approved = await approvePublication(db, publicationId);
    if (approved.status === "scheduled") return { publication: approved };
  } else {
    // Only the creator's own failed publication can be retried; RLS decides what they can see.
    const { data } = await db.from("publications").select("status").eq("id", publicationId).maybeSingle();
    if (!data) throw new DomainError("not_found", "We couldn't find that publication.");
    if (data.status !== "failed") throw new DomainError("conflict", "Only a publication that didn't go through can be retried.");
  }
  return { publication: await attemptPublication({ service: serviceClient(), creatorId, appOrigin: req.nextUrl.origin }, publicationId) };
}, { rateLimit: 20 });
