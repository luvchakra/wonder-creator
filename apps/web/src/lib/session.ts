import "server-only";
import { log } from "@wonder/core";
import { consentNeeded } from "@wonder/creator-identity/privacy-options";
import type { Db, Tables } from "@wonder/db";
import { redirect } from "next/navigation";
import { cache } from "react";
import { consentsFor } from "./consents";
import { mfaPending } from "./mfa";
import { createClient } from "./supabase/server";

export interface Session {
  db: Db;
  userId: string;
  creator: Tables<"creators">;
}

/** Resolve the signed-in creator for a Server Component (deduplicated per request). */
export const getSession = cache(async (): Promise<Session | null> => {
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) return null;
  const creator = await db.from("creators").select("*").eq("user_id", userId).maybeSingle();
  if (!creator.data) return null;
  return { db, userId, creator: creator.data };
});

/**
 * True when the Terms, Privacy notice or age declaration haven't been accepted for the current notice version. A
 * failed lookup doesn't lock the creator out (it's logged); the next request asks again.
 */
export const needsConsent = cache(async (db: Db): Promise<boolean> => {
  try {
    return consentNeeded(await consentsFor(db));
  } catch (e) {
    log("warn", "consent.lookup_failed", { error: e instanceof Error ? e.message.slice(0, 200) : "unknown" });
    return false;
  }
});

/**
 * For studio pages: signed in, verified, agreed to the current notice, and onboarded (onboarding is progressive, not a
 * gate on creating).
 */
export async function requireSession(opts: { allowOnboarding?: boolean; allowConsent?: boolean } = {}): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/sign-in");
  // Two-step verification set up but not passed in this session (password only so far).
  if (await mfaPending(s.db)) redirect("/sign-in/verify");
  // GDPR Art. 7 / DPDP §6: proof of notice and consent before the service is used; asked again when the notice changes.
  if (!opts.allowConsent && (await needsConsent(s.db))) redirect("/consent");
  if (!opts.allowOnboarding && s.creator.onboarding_step !== "complete" && !s.creator.handle) redirect("/onboarding");
  return s;
}
