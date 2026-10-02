import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session on every request and keeps the
// auth cookies in sync between the request and the response.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Don't run code between createServerClient and getClaims(): it would
  // make session refresh bugs hard to track down.
  const { data } = await supabase.auth.getClaims();

  // Signed-out visitors to `/` see the public landing page; signed-in creators get their Home at the same URL.
  if (!data?.claims && request.nextUrl.pathname === "/") {
    const landing = NextResponse.rewrite(new URL("/welcome", request.url), { request });
    response.cookies.getAll().forEach((c) => landing.cookies.set(c));
    return landing;
  }

  return response;
}
