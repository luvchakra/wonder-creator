import { DomainError, fromDbError, must, publishEvent } from "@wonder/core";
import { parseExternalUrl, safeFetch, type SafeFetchOptions } from "@wonder/core/server";
import type { Db, Tables } from "@wonder/db";
import { z } from "zod";

/**
 * Publishing (P0.1-10). The creator prepares a publication of a piece for a destination, reviews it and
 * approves it; the server carries out the attempt. A publication is "published" only after the destination
 * confirms it: the profile update commits, or the creator's webhook answers 2xx. Failures are recorded per
 * destination and retried with the same idempotency key. CreatorBrain may draft copy; it never publishes
 * on its own.
 */
export type Publication = Tables<"publications">;
export type PublishingDestination = Tables<"publishing_destinations">;
export type PublicationAttempt = Tables<"publication_attempts">;

/** Platforms that need their own connection (OAuth app credentials). Shown honestly as not connected. */
export const UNCONNECTED_PLATFORMS = ["Instagram", "YouTube", "TikTok", "LinkedIn", "Medium", "Substack"] as const;

// ---------------------------------------------------------------------------
// Destinations
// ---------------------------------------------------------------------------
export const destinationSchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(60),
  url: z
    .string()
    .trim()
    .max(2000)
    .refine((u) => {
      try {
        return parseExternalUrl(u).protocol === "https:";
      } catch {
        return false;
      }
    }, "Use a public https:// address."),
});

function randomSecret(): string {
  return [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function addWebhookDestination(db: Db, creatorId: string, raw: unknown): Promise<PublishingDestination> {
  const input = destinationSchema.parse(raw);
  return must(
    await db
      .from("publishing_destinations")
      .insert({ creator_id: creatorId, kind: "webhook", name: input.name, url: input.url, signing_secret: randomSecret() })
      .select("*")
      .single(),
  );
}

export async function listDestinations(db: Db): Promise<PublishingDestination[]> {
  const { data, error } = await db.from("publishing_destinations").select("*").order("created_at", { ascending: false });
  if (error) throw fromDbError(error);
  return data ?? [];
}

export async function disconnectDestination(db: Db, id: string): Promise<void> {
  const res = await db.from("publishing_destinations").update({ status: "disconnected" }).eq("id", id).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that destination.");
}

// ---------------------------------------------------------------------------
// Preparing and approving
// ---------------------------------------------------------------------------
const copyFields = {
  title: z.string().trim().min(1, "Add a title.").max(200),
  caption: z.string().trim().max(2200).nullish().transform((v) => v || null),
  description: z.string().trim().max(5000).nullish().transform((v) => v || null),
  scheduledFor: z
    .string()
    .datetime({ offset: true })
    .nullish()
    .transform((v) => v || null)
    .refine((v) => !v || new Date(v).getTime() > Date.now() + 60_000, "Pick a time at least a minute from now."),
};

/**
 * Platform-specific metadata (P1-12): tags (no "#", deduplicated), alt text, a link, and for webhooks a few extra
 * key/value fields the receiving site understands. Sent with the publication; never used to authorize anything.
 */
export const publicationMetadataSchema = z
  .object({
    tags: z
      .array(z.string().trim().max(40))
      .max(10)
      .transform((ts) => [...new Set(ts.map((t) => t.replace(/^#+/, "").trim()).filter(Boolean))])
      .optional(),
    altText: z.string().trim().max(500).optional(),
    link: z
      .string()
      .trim()
      .max(2000)
      .refine((u) => /^https:\/\/[^\s]+$/i.test(u), "Links must start with https://")
      .optional(),
    fields: z
      .record(z.string().trim().min(1).max(40), z.string().trim().max(500))
      .refine((f) => Object.keys(f).length <= 10, "At most 10 extra fields.")
      .optional(),
  })
  .strict();
export type PublicationMetadata = z.infer<typeof publicationMetadataSchema>;

/** Per-destination changes on top of the shared copy ("profile" or a destination id). */
const perDestinationSchema = z
  .record(
    z.string(),
    z.object({
      caption: copyFields.caption.optional(),
      description: copyFields.description.optional(),
      metadata: publicationMetadataSchema.optional(),
      scheduledFor: copyFields.scheduledFor.optional(),
    }),
  )
  .refine((r) => Object.keys(r).length <= 10);

export const preparePublicationSchema = z.object({
  destinations: z
    .array(z.union([z.object({ kind: z.literal("profile") }), z.object({ kind: z.literal("webhook"), id: z.string().uuid() })]))
    .min(1, "Choose at least one destination.")
    .max(10),
  ...copyFields,
  preparedBy: z.enum(["creator", "creatorbrain"]).default("creator"),
  metadata: publicationMetadataSchema.default({}),
  perDestination: perDestinationSchema.default({}),
});

export const updatePublicationSchema = z.object({ ...copyFields, metadata: publicationMetadataSchema }).partial();

/** One draft publication per destination, sharing the same copy. Nothing is published yet. */
export async function preparePublications(db: Db, creatorId: string, artifactId: string, raw: unknown): Promise<Publication[]> {
  const input = preparePublicationSchema.parse(raw);
  const webhooks = input.destinations.filter((d): d is { kind: "webhook"; id: string } => d.kind === "webhook").map((d) => d.id);
  const { data: dests } = webhooks.length ? await db.from("publishing_destinations").select("id, name, status").in("id", webhooks) : { data: [] };
  const byId = new Map((dests ?? []).map((d) => [d.id, d]));
  const seen = new Set<string>();
  const rows = input.destinations.flatMap((d): Array<{ key: string; destination_kind: "profile" | "webhook"; destination_id: string | null; destination_name: string }> => {
    const key = d.kind === "profile" ? "profile" : d.id;
    if (seen.has(key)) return [];
    seen.add(key);
    if (d.kind === "webhook") {
      const dest = byId.get(d.id);
      if (!dest || dest.status !== "active") throw new DomainError("validation", "One of those destinations isn't connected.");
      return [{ key, destination_kind: "webhook", destination_id: d.id, destination_name: dest.name }];
    }
    return [{ key, destination_kind: "profile", destination_id: null, destination_name: "Your Wonder Creator profile" }];
  });
  const res = await db
    .from("publications")
    .insert(
      rows.map(({ key, ...r }) => {
        const own = input.perDestination[key] ?? {};
        return {
          ...r,
          artifact_id: artifactId,
          creator_id: creatorId,
          title: input.title,
          caption: own.caption !== undefined ? own.caption : input.caption,
          description: own.description !== undefined ? own.description : input.description,
          scheduled_for: own.scheduledFor !== undefined ? own.scheduledFor : input.scheduledFor,
          metadata: { ...input.metadata, ...(own.metadata ?? {}) },
          prepared_by: input.preparedBy,
        };
      }),
    )
    .select("*");
  if (res.error) throw fromDbError(res.error);
  for (const p of res.data ?? []) {
    await publishEvent(db, { type: "PublicationPrepared", aggregate: "publication", aggregateId: p.id, payload: { artifactId, destination: p.destination_kind, preparedBy: p.prepared_by } });
  }
  return res.data ?? [];
}

export async function updatePublication(db: Db, id: string, raw: unknown): Promise<Publication> {
  const input = updatePublicationSchema.parse(raw);
  const patch: Partial<Publication> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.caption !== undefined) patch.caption = input.caption;
  if (input.description !== undefined) patch.description = input.description;
  if (input.scheduledFor !== undefined) patch.scheduled_for = input.scheduledFor;
  if (input.metadata !== undefined) {
    // Merge: editing tags keeps alt text, link and extra fields.
    const { data: cur } = await db.from("publications").select("metadata").eq("id", id).maybeSingle();
    patch.metadata = { ...((cur?.metadata as Record<string, unknown> | null) ?? {}), ...input.metadata };
  }
  const res = await db.from("publications").update(patch).eq("id", id).select("*").maybeSingle();
  if (res.error?.code === "55000") throw new DomainError("conflict", "This publication was already approved. Cancel it and prepare a new one to change it.");
  if (res.error) throw fromDbError(res.error);
  if (!res.data) throw new DomainError("not_found", "We couldn't find that publication.");
  return res.data;
}

function rpcError(e: { code?: string; message: string } | null) {
  if (!e) return;
  if (e.code === "P0002") throw new DomainError("not_found", "We couldn't find that publication.");
  if (e.code === "55000") throw new DomainError("conflict", e.message);
  throw fromDbError(e as never);
}

/** The creator's approval of exactly this version and copy. */
export async function approvePublication(db: Db, id: string): Promise<Publication> {
  await publishEvent(db, { type: "PublicationApprovalRequested", aggregate: "publication", aggregateId: id, payload: {} });
  const res = await db.rpc("approve_publication", { p_publication: id });
  rpcError(res.error);
  const p = res.data as Publication;
  await publishEvent(db, { type: "PublicationApproved", aggregate: "publication", aggregateId: id, payload: { scheduledFor: p.scheduled_for } });
  return p;
}

export async function cancelPublication(db: Db, id: string): Promise<Publication> {
  const res = await db.rpc("cancel_publication", { p_publication: id });
  rpcError(res.error);
  return res.data as Publication;
}

export async function listPublications(db: Db, artifactId: string) {
  const { data, error } = await db
    .from("publications")
    .select("*, publication_attempts(attempt_no, started_at, finished_at, outcome, http_status, error)")
    .eq("artifact_id", artifactId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw fromDbError(error);
  return (data ?? []).map((p) => ({ ...p, publication_attempts: [...(p.publication_attempts ?? [])].sort((a, b) => b.attempt_no - a.attempt_no) }));
}

// ---------------------------------------------------------------------------
// Attempting (server only: `service` is the pipeline client, always scoped by the server-resolved creator)
// ---------------------------------------------------------------------------
export async function signWebhook(secret: string, timestamp: number, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const webhookAnswer = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().max(200)).optional(),
    url: z.string().url().max(2000).refine((u) => u.startsWith("https://")).optional(),
  })
  .passthrough();

type Outcome = { ok: true; externalId: string | null; externalUrl: string | null; httpStatus: number | null } | { ok: false; reason: string; httpStatus: number | null };

export interface AttemptDeps {
  service: Db;
  creatorId: string;
  appOrigin: string;
  fetchOptions?: Pick<SafeFetchOptions, "resolve" | "fetchImpl">;
}

/**
 * Attempt one approved (or scheduled and due, or failed) publication. Claims it first, so concurrent
 * attempts can't both run; the result is recorded only from the destination's answer.
 */
export async function attemptPublication(deps: AttemptDeps, publicationId: string): Promise<Publication> {
  const { service, creatorId } = deps;
  const current = must(await service.from("publications").select("*").eq("id", publicationId).eq("creator_id", creatorId).maybeSingle(), "We couldn't find that publication.");
  if (current.status === "published") return current;
  if (!["approved", "scheduled", "failed"].includes(current.status) || !current.approved_at) throw new DomainError("conflict", "This publication isn't approved.");
  if (current.status === "scheduled" && current.scheduled_for && new Date(current.scheduled_for).getTime() > Date.now()) {
    throw new DomainError("conflict", "This publication is scheduled for later.");
  }
  const attemptNo = current.attempts + 1;
  const claim = await service
    .from("publications")
    .update({ status: "publishing", attempts: attemptNo, failure_reason: null })
    .eq("id", publicationId)
    .eq("creator_id", creatorId)
    .eq("status", current.status)
    .select("*");
  if (claim.error) throw fromDbError(claim.error);
  if (!claim.data?.length) throw new DomainError("conflict", "This publication is already being published.");
  const p = claim.data[0];
  const attempt = must(await service.from("publication_attempts").insert({ publication_id: p.id, creator_id: creatorId, attempt_no: attemptNo }).select("id").single());
  await publishEvent(service, { type: "PublicationAttempted", aggregate: "publication", aggregateId: p.id, payload: { attempt: attemptNo, destination: p.destination_kind } });

  let outcome: Outcome;
  try {
    outcome = p.destination_kind === "profile" ? await publishToProfile(deps, p) : await publishToWebhook(deps, p);
  } catch (e) {
    outcome = { ok: false, reason: e instanceof DomainError ? e.message : "Something went wrong while publishing.", httpStatus: null };
  }

  const finishedAt = new Date().toISOString();
  await service
    .from("publication_attempts")
    .update({
      finished_at: finishedAt,
      outcome: outcome.ok ? "succeeded" : "failed",
      http_status: outcome.httpStatus,
      error: outcome.ok ? null : outcome.reason.slice(0, 500),
      external_id: outcome.ok ? outcome.externalId : null,
      external_url: outcome.ok ? outcome.externalUrl : null,
    })
    .eq("id", attempt.id);
  const done = must(
    await service
      .from("publications")
      .update(
        outcome.ok
          ? { status: "published", published_at: finishedAt, external_id: outcome.externalId, external_url: outcome.externalUrl, failure_reason: null }
          : { status: "failed", failure_reason: outcome.reason.slice(0, 500) },
      )
      .eq("id", p.id)
      .eq("creator_id", creatorId)
      .select("*")
      .single(),
  );
  await publishEvent(service, {
    type: outcome.ok ? "ArtifactPublished" : "PublicationFailed",
    aggregate: "publication",
    aggregateId: p.id,
    payload: outcome.ok ? { artifactId: p.artifact_id, destination: p.destination_kind, externalUrl: outcome.externalUrl } : { artifactId: p.artifact_id, destination: p.destination_kind, reason: outcome.reason },
  });
  return done;
}

async function publishToProfile(deps: AttemptDeps, p: Publication): Promise<Outcome> {
  const res = await deps.service
    .from("artifacts")
    .update({ status: "published", privacy: "public" })
    .eq("id", p.artifact_id)
    .eq("creator_id", deps.creatorId)
    .neq("status", "archived")
    .select("id")
    .maybeSingle();
  if (res.error || !res.data) return { ok: false, reason: "The Creation couldn't be published to your profile (it may be archived).", httpStatus: null };
  const { data: c } = await deps.service.from("creators").select("handle").eq("id", deps.creatorId).maybeSingle();
  return { ok: true, externalId: p.artifact_id, externalUrl: c?.handle ? `/creators/${c.handle}` : null, httpStatus: null };
}

async function publishToWebhook(deps: AttemptDeps, p: Publication): Promise<Outcome> {
  if (!p.destination_id) return { ok: false, reason: "This destination was removed. Prepare a new publication.", httpStatus: null };
  const dest = await deps.service.from("publishing_destinations").select("*").eq("id", p.destination_id).eq("creator_id", deps.creatorId).maybeSingle();
  if (!dest.data || dest.data.status !== "active") return { ok: false, reason: "This destination is no longer connected.", httpStatus: null };
  const [artifact, version, creator, source] = await Promise.all([
    deps.service.from("artifacts").select("id, title, artifact_type, made_for").eq("id", p.artifact_id).single(),
    p.version_id ? deps.service.from("artifact_versions").select("version_number, content").eq("id", p.version_id).maybeSingle() : Promise.resolve({ data: null }),
    deps.service.from("creators").select("display_name, handle").eq("id", deps.creatorId).single(),
    // A publication derivative says what it was adapted from (P1-13).
    deps.service.from("lineage_edges").select("source_id").eq("target_type", "artifact").eq("target_id", p.artifact_id).eq("source_type", "artifact").eq("relationship", "adapted_from").limit(1).maybeSingle(),
  ]);
  const sourceArtifact = source.data ? (await deps.service.from("artifacts").select("id, title").eq("id", source.data.source_id).eq("creator_id", deps.creatorId).maybeSingle()).data : null;
  if (!version.data) return { ok: false, reason: "The approved version is no longer available.", httpStatus: null };
  const body = JSON.stringify({
    event: "publication",
    publicationId: p.id,
    idempotencyKey: p.idempotency_key,
    artifact: { id: p.artifact_id, type: artifact.data?.artifact_type, version: version.data.version_number, madeFor: artifact.data?.made_for ?? null },
    derivedFrom: sourceArtifact ? { id: sourceArtifact.id, title: sourceArtifact.title } : null,
    title: p.title,
    caption: p.caption,
    description: p.description,
    metadata: p.metadata ?? {},
    content: version.data.content,
    creator: { name: creator.data?.display_name, handle: creator.data?.handle ?? null, profileUrl: creator.data?.handle ? `${deps.appOrigin}/creators/${creator.data.handle}` : null },
    approvedAt: p.approved_at,
  });
  const ts = Math.floor(Date.now() / 1000);
  const signature = await signWebhook(dest.data.signing_secret, ts, body);
  let res;
  try {
    res = await safeFetch(dest.data.url, {
      ...deps.fetchOptions,
      method: "POST",
      body,
      timeoutMs: 10_000,
      maxBytes: 65_536,
      accept: "application/json",
      userAgent: "WonderCreatorPublisher/1.0",
      headers: { "content-type": "application/json", "idempotency-key": p.idempotency_key, "x-wonder-timestamp": String(ts), "x-wonder-signature": `v1=${signature}` },
    });
  } catch (e) {
    return { ok: false, reason: e instanceof DomainError ? e.message : "We couldn't reach the destination.", httpStatus: null };
  }
  await deps.service.from("publishing_destinations").update({ last_used_at: new Date().toISOString() }).eq("id", dest.data.id);
  if (res.status < 200 || res.status >= 300) return { ok: false, reason: `The destination answered ${res.status}.`, httpStatus: res.status };
  let answer: z.infer<typeof webhookAnswer> = {};
  try {
    const text = new TextDecoder().decode(res.body);
    if (text.trim()) answer = webhookAnswer.parse(JSON.parse(text));
  } catch {
    // A 2xx without (valid) JSON still confirms the publication; it just has no external id/URL.
  }
  return { ok: true, externalId: answer.id ?? null, externalUrl: answer.url ?? null, httpStatus: res.status };
}

/** Scheduled publications whose time has come (for the jobs runner). */
export async function duePublications(service: Db, limit = 20) {
  const { data, error } = await service.from("publications").select("id, creator_id").eq("status", "scheduled").lte("scheduled_for", new Date().toISOString()).order("scheduled_for").limit(limit);
  if (error) throw fromDbError(error);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// CreatorPublish v1 (P1-12): preferences and the publishing overview
// ---------------------------------------------------------------------------
export const publishingPreferencesSchema = z.object({
  defaultDestinations: z.array(z.string().max(60)).max(10).default([]),
  defaultTags: z
    .array(z.string().trim().max(40))
    .max(10)
    .default([])
    .transform((ts) => [...new Set(ts.map((t) => t.replace(/^#+/, "").trim()).filter(Boolean))]),
  preferredTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 18:30.")
    .nullish()
    .transform((v) => v || null),
  timeZone: z
    .string()
    .max(60)
    .nullish()
    .transform((v) => v || null)
    .refine((tz) => {
      if (!tz) return true;
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid time zone."),
  captionStyle: z.string().trim().max(500).nullish().transform((v) => v || null),
});
export type PublishingPreferences = z.infer<typeof publishingPreferencesSchema>;

export async function getPublishingPreferences(db: Db, creatorId: string): Promise<PublishingPreferences> {
  const { data, error } = await db.from("publishing_preferences").select("*").eq("creator_id", creatorId).maybeSingle();
  if (error) throw fromDbError(error);
  return {
    defaultDestinations: ((data?.default_destinations ?? []) as unknown[]).filter((d): d is string => typeof d === "string"),
    defaultTags: data?.default_tags ?? [],
    preferredTime: data?.preferred_time ? data.preferred_time.slice(0, 5) : null,
    timeZone: data?.time_zone ?? null,
    captionStyle: data?.caption_style ?? null,
  };
}

export async function savePublishingPreferences(db: Db, creatorId: string, raw: unknown): Promise<PublishingPreferences> {
  const p = publishingPreferencesSchema.parse(raw);
  const { error } = await db.from("publishing_preferences").upsert(
    { creator_id: creatorId, default_destinations: p.defaultDestinations, default_tags: p.defaultTags, preferred_time: p.preferredTime, time_zone: p.timeZone, caption_style: p.captionStyle },
    { onConflict: "creator_id" },
  );
  if (error) throw fromDbError(error);
  return p;
}

export type QueueItem = Publication & { artifacts: { id: string; title: string } | null; publication_attempts: Array<Pick<PublicationAttempt, "attempt_no" | "finished_at" | "outcome" | "error">> };

/** Everything across pieces: what's waiting (queue), what happened (history) and where it can go. */
export async function publishingOverview(db: Db) {
  const [queue, history, destinations] = await Promise.all([
    db
      .from("publications")
      .select("*, artifacts(id, title), publication_attempts(attempt_no, finished_at, outcome, error)")
      .in("status", ["draft", "approved", "scheduled", "publishing", "failed"])
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("publications")
      .select("*, artifacts(id, title), publication_attempts(attempt_no, finished_at, outcome, error)")
      .in("status", ["published", "cancelled"])
      .order("updated_at", { ascending: false })
      .limit(100),
    listDestinations(db),
  ]);
  if (queue.error) throw fromDbError(queue.error);
  if (history.error) throw fromDbError(history.error);
  return { queue: (queue.data ?? []) as QueueItem[], history: (history.data ?? []) as QueueItem[], destinations };
}
