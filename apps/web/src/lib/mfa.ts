import "server-only";
import type { Db } from "@wonder/db";

/**
 * True when the signed-in creator has two-step verification set up but this session hasn't passed it yet (signed in
 * with the password only). Pages send them to /sign-in/verify; API routes refuse until they do. Read from the session
 * itself — no network call.
 */
export async function mfaPending(db: Db): Promise<boolean> {
  const { data } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  return !!data && data.nextLevel === "aal2" && data.currentLevel !== "aal2";
}
