import "server-only";
import { createClient } from "@supabase/supabase-js";
import { DomainError } from "@wonder/core";
import type { Database, Db } from "@wonder/db";

/**
 * Service-role client. Bypasses RLS, so it is used ONLY for pipeline-owned state
 * (storage registration, intake/job state, scan status, huddle cleanup) and always
 * with an explicit, server-resolved creator id. Never exposed to the browser.
 */
export function serviceClient(): Db {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new DomainError("provider_unavailable", "Uploads and background processing aren't configured on this server yet.");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export const serviceConfigured = () => !!process.env.SUPABASE_SECRET_KEY;
