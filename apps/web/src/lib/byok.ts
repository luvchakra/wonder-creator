import "server-only";
import { DomainError, fromDbError } from "@wonder/core";
import { BYOK_PROVIDERS, keyHint, validateProviderKey, type ByokProvider } from "@wonder/creator-brain";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { serviceClient, serviceConfigured } from "./supabase/service";

/**
 * BYOK management (P0.1-16). Keys are validated against the provider, then stored in Vault by the service role
 * for the authenticated creator only. The secret never comes back out of these functions.
 */
export const providerSchema = z.enum(BYOK_PROVIDERS.map((p) => p.id) as [ByokProvider, ...ByokProvider[]]);
export const connectSchema = z.object({ provider: providerSchema, key: z.string().trim().min(10, "That doesn't look like an API key.").max(500, "That doesn't look like an API key.") });
export const preferencesSchema = z.object({ defaultModel: z.string().max(120).nullable().optional(), useForBrain: z.boolean().optional() });

function service(): Db {
  if (!serviceConfigured()) throw new DomainError("provider_unavailable", "Connecting your own AI key isn't set up on this server yet.");
  return serviceClient();
}

function rpcError(e: { code?: string; message: string } | null) {
  if (!e) return;
  if (e.code === "P0002") throw new DomainError("not_found", "That key isn't connected.");
  if (e.code === "22023") throw new DomainError("validation", e.message.includes("model") ? "That model isn't available with this key." : "That doesn't look like an API key.");
  throw fromDbError(e as never);
}

/** Only one connected key is used for CreatorBrain at a time. */
async function makeOnlyBrainKey(creatorId: string, provider: ByokProvider) {
  for (const other of BYOK_PROVIDERS.filter((p) => p.id !== provider)) {
    await service().rpc("byok_update", { p_creator: creatorId, p_provider: other.id, p_use_for_brain: false }).then(() => undefined, () => undefined);
  }
}

export async function connectKey(creatorId: string, raw: unknown, fetchImpl?: typeof fetch) {
  const { provider, key } = connectSchema.parse(raw);
  const check = await validateProviderKey(provider, key, fetchImpl);
  if (check.status === "invalid") throw new DomainError("validation", `${check.message} Nothing was saved.`);
  const res = await service().rpc("byok_store", {
    p_creator: creatorId,
    p_provider: provider,
    p_secret: key,
    p_hint: keyHint(key),
    p_status: check.status === "valid" ? "valid" : "unverified",
    p_models: check.status === "valid" ? check.models : [],
  });
  rpcError(res.error);
  if (res.data?.use_for_brain) await makeOnlyBrainKey(creatorId, provider);
  return { key: publicView(res.data!), check: check.status === "valid" ? { status: "valid" as const } : { status: check.status, message: check.message } };
}

export async function revalidateKey(creatorId: string, provider: ByokProvider, fetchImpl?: typeof fetch) {
  const { data: secret, error } = await service().rpc("byok_secret", { p_creator: creatorId, p_provider: provider });
  if (error) rpcError(error);
  if (!secret) throw new DomainError("not_found", "That key isn't connected.");
  const check = await validateProviderKey(provider, secret, fetchImpl);
  const res = await service().rpc("byok_update", {
    p_creator: creatorId,
    p_provider: provider,
    p_status: check.status === "unreachable" ? "unverified" : check.status,
    p_models: check.status === "valid" ? check.models : undefined,
    p_error: check.status === "valid" ? undefined : check.message,
  });
  rpcError(res.error);
  return { key: publicView(res.data!), check };
}

export async function updatePreferences(creatorId: string, provider: ByokProvider, raw: unknown) {
  const p = preferencesSchema.parse(raw);
  const res = await service().rpc("byok_update", {
    p_creator: creatorId,
    p_provider: provider,
    p_default_model: p.defaultModel ?? undefined,
    p_clear_default: p.defaultModel === null,
    p_use_for_brain: p.useForBrain,
  });
  rpcError(res.error);
  if (p.useForBrain) await makeOnlyBrainKey(creatorId, provider);
  return publicView(res.data!);
}

export async function removeKey(creatorId: string, provider: ByokProvider) {
  const res = await service().rpc("byok_remove", { p_creator: creatorId, p_provider: provider });
  rpcError(res.error);
}

type KeyRow = { provider: string; hint: string; status: string; models: string[]; default_model: string | null; use_for_brain: boolean; validated_at: string | null; last_error: string | null; created_at: string; rotated_at: string | null };

/** What the creator (and the browser) may see about a key: never the secret. */
export function publicView(k: KeyRow) {
  return {
    provider: k.provider as ByokProvider,
    hint: `…${k.hint}`,
    status: k.status as "valid" | "unverified" | "invalid",
    models: k.models,
    defaultModel: k.default_model,
    useForBrain: k.use_for_brain,
    validatedAt: k.validated_at,
    lastError: k.last_error,
    connectedAt: k.created_at,
    rotatedAt: k.rotated_at,
  };
}
export type KeyView = ReturnType<typeof publicView>;

/** The creator's own key records, read through their RLS-scoped client. */
export async function listKeys(db: Db): Promise<KeyView[]> {
  const { data, error } = await db.from("creator_ai_keys").select("provider, hint, status, models, default_model, use_for_brain, validated_at, last_error, created_at, rotated_at");
  if (error) throw fromDbError(error);
  return (data ?? []).map(publicView);
}
