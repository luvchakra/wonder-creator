import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { Database, Db } from "@wonder/db";
import { cookies } from "next/headers";

// Supabase client for Server Components, Server Functions and Route Handlers.
// Create a new client per request; don't share it across requests.
export async function createClient(): Promise<Db> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore: the proxy refreshes the session instead.
          }
        },
      },
    },
  );
}
