"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * "Continue with Google" (Supabase OAuth, PKCE). Google's own multicolour "G" per its sign-in branding guidelines.
 * New accounts are asked to agree to the Terms and Privacy notice right after (the /consent gate), since they never
 * see the sign-up checkbox.
 */
export function GoogleButton({ next, onError }: { next: string; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?via=google&next=${encodeURIComponent(next)}`,
        queryParams: { prompt: "select_account" },
      },
    });
    // On success the browser is already on its way to Google.
    if (error) {
      setBusy(false);
      onError("Google sign-in isn't available right now. Use your email instead.");
    }
  }
  return (
    <button
      type="button"
      onClick={() => void go()}
      disabled={busy}
      aria-busy={busy || undefined}
      className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-border-soft bg-white px-5 text-[15px] font-medium text-ink shadow-[0_3px_12px_-4px_rgb(107_91_149/0.14)] transition-colors hover:bg-[#f8f6ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
    >
      <svg aria-hidden viewBox="0 0 48 48" className="size-5 shrink-0">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {busy ? "Opening Google…" : "Continue with Google"}
    </button>
  );
}
