import "server-only";
import { createClient } from "@supabase/supabase-js";
import { DomainError } from "@wonder/core";
import type { Db } from "@wonder/db";

/**
 * Step-up authentication for high-impact actions (account deletion, ownership transfer, activating a
 * commercial license): the creator re-enters their password. Checked on a separate, stateless client so
 * the creator's own session and cookies are never replaced.
 */
export async function requirePassword(db: Db, userId: string, password: string | undefined, action: string): Promise<void> {
  if (!password) throw new DomainError("step_up_required", `Please confirm your password to ${action}.`);
  const { data } = await db.auth.getUser();
  const email = data.user?.email;
  if (!email || data.user?.id !== userId) throw new DomainError("unauthenticated", "Please sign in again.");
  const verifier = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const check = await verifier.auth.signInWithPassword({ email, password });
  if (check.error) throw new DomainError("step_up_required", "That password isn't right.");
  // End the verification session right away; it was only a proof of the password.
  await verifier.auth.signOut({ scope: "local" }).catch(() => undefined);
}
