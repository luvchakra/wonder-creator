import "server-only";
import type { Db, Tables } from "@wonder/db";
import { redirect } from "next/navigation";
import { cache } from "react";
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

/** For studio pages: signed in and onboarded (onboarding is progressive, not a gate on creating). */
export async function requireSession(opts: { allowOnboarding?: boolean } = {}): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/sign-in");
  if (!opts.allowOnboarding && s.creator.onboarding_step !== "complete" && !s.creator.handle) redirect("/onboarding");
  return s;
}
