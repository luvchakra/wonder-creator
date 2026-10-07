import { audit, log } from "@wonder/core";
import { NextResponse, type NextRequest } from "next/server";
import { describeRequest } from "@/lib/device";
import { createClient } from "@/lib/supabase/server";
import { OAUTH_NEXT_COOKIE } from "@/lib/oauth-next";

/**
 * Where Supabase Auth sends the browser back to: email links (confirm, reset) and Google sign-in (OAuth, PKCE). The
 * code is exchanged for a session here; `next` is followed only when it's a same-site path. A first Google sign-in
 * creates the account — the consent gate then asks for the Terms and Privacy notice, and onboarding follows. Google's
 * `next` comes in a short-lived cookie (see GoogleButton), so its return address stays exactly `/auth/callback`; a
 * code that lands on `/` instead (Supabase's Site URL fallback) is forwarded here by the proxy.
 */
export async function GET(req: NextRequest) {
  const res = await handle(req);
  // Single use: whatever happened, the stored destination is spent.
  if (req.cookies.has(OAUTH_NEXT_COOKIE)) res.cookies.set(OAUTH_NEXT_COOKIE, "", { path: "/auth", maxAge: 0 });
  return res;
}

async function handle(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stored = req.cookies.get(OAUTH_NEXT_COOKIE)?.value;
  const nextParam = req.nextUrl.searchParams.get("next") ?? (stored ? safeDecode(stored) : null) ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.startsWith("/\\") ? nextParam : "/";
  const via = req.nextUrl.searchParams.get("via") ?? (stored ? "google" : null);
  // The provider declined or the person cancelled at Google.
  const providerError = req.nextUrl.searchParams.get("error");
  if (providerError) {
    log("info", "auth.oauth_returned_error", { error: providerError.slice(0, 60) });
    return NextResponse.redirect(new URL("/sign-in?error=oauth", req.url));
  }
  if (code) {
    const db = await createClient();
    const { data, error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      const provider = data.user?.app_metadata?.provider;
      if (provider && provider !== "email" && data.user) {
        // Security history: a first OAuth sign-in is the sign-up.
        const isNew = Date.now() - new Date(data.user.created_at).getTime() < 2 * 60_000;
        const { data: creator } = await db.from("creators").select("id").eq("user_id", data.user.id).maybeSingle();
        await audit(db, { action: isNew ? "auth.signed_up" : "auth.signed_in", objectType: "creator", objectId: creator?.id ?? null, metadata: { ...describeRequest(req), method: provider } }).catch(() => undefined);
      }
      return NextResponse.redirect(new URL(next, req.url));
    }
    log("warn", "auth.code_exchange_failed", { code: error.code ?? "unknown" });
    return NextResponse.redirect(new URL(`/sign-in?error=${via === "google" ? "oauth" : "link"}`, req.url));
  }
  return NextResponse.redirect(new URL("/sign-in?error=link", req.url));
}

function safeDecode(v: string): string | null {
  try {
    return decodeURIComponent(v);
  } catch {
    return null;
  }
}
