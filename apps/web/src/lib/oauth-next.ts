/**
 * Where to go after Google sign-in, kept in a short-lived cookie (path `/auth`, 10 minutes) instead of in the return
 * address, so that address stays exactly `/auth/callback` — the one Supabase's Redirect URLs list allows.
 */
export const OAUTH_NEXT_COOKIE = "wc_oauth_next";
