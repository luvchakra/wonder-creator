import "server-only";
import { DomainError } from "@wonder/core";
import type { Db } from "@wonder/db";

/**
 * Platform administrators: the few people who run Wonder Creator itself (owner, 21 Oct 2026: careers needs a setting only
 * they may change). Who they are is server configuration, never data a session can write:
 * `WONDERCREATOR_PLATFORM_ADMIN_EMAILS`, a comma-separated list of sign-in emails. With none set, nobody is one.
 */
export function isPlatformAdminEmail(email: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  const list = (env.WONDERCREATOR_PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && list.includes(email.trim().toLowerCase());
}

/** The signed-in user's email, when they are a platform administrator; null otherwise (signed out included). */
export async function platformAdminEmail(db: Db): Promise<string | null> {
  const { data } = await db.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  return isPlatformAdminEmail(email) ? email : null;
}

/** For admin-only routes: anyone else gets the same answer as a page that doesn't exist. */
export async function requirePlatformAdmin(db: Db): Promise<void> {
  if (!(await platformAdminEmail(db))) throw new DomainError("not_found", "We couldn't find that.");
}
