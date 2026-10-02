import "server-only";

/**
 * Whether "Continue with Google" is switched on for this project's auth server (Supabase → Authentication →
 * Providers → Google). Read from the public `/auth/v1/settings` endpoint and cached for five minutes, so the button
 * only appears when it will work — never a broken redirect.
 */
export async function googleSignInEnabled(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, next: { revalidate: 300 }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}
