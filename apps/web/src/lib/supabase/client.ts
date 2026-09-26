import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@wonder/db";

// Supabase client for Client Components (realtime subscriptions and auth only; mutations go through the API).
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
