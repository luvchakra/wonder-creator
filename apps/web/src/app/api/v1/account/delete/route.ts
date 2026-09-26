import { DomainError } from "@wonder/core";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/service";

/**
 * Permanent account deletion with step-up authentication: the creator re-enters their password.
 * Deleting the auth user cascades to all creator-owned data; personal tenants are cleaned up.
 */
export const POST = withApi(async ({ db, userId, req }) => {
  const { password } = z.object({ password: z.string().min(1), confirm: z.literal("DELETE") }).parse(await readJson(req));
  const { data: user } = await db.auth.getUser();
  if (!user.user?.email || user.user.id !== userId) throw new DomainError("unauthenticated", "Please sign in again.");
  const check = await db.auth.signInWithPassword({ email: user.user.email, password });
  if (check.error) throw new DomainError("forbidden", "That password isn't right.");
  const service = serviceClient();
  const { data: files } = await service.from("storage_objects").select("bucket, path").eq("creator_id", (await db.from("creators").select("id").eq("user_id", userId).single()).data!.id);
  if (files?.length) await service.storage.from("creator-media").remove(files.map((f) => f.path));
  const del = await service.auth.admin.deleteUser(userId);
  if (del.error) throw new DomainError("internal", "We couldn't delete your account. Please contact support.");
  await db.auth.signOut();
  return { ok: true };
}, { rateLimit: 3 });
