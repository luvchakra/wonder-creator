import { expect, test } from "./fixtures";

// Google sign-in. The button appears only when Google is switched on for the auth server; the real Google consent
// screen can't run in tests, so the hand-off to the auth server is checked (and stopped) and the return paths exercised.
test.describe("Google sign-in", () => {
  test("shown only when enabled; hands off to Google with PKCE and our callback; a cancelled sign-in comes back with a clear message", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await page.goto("/sign-in");
    const button = page.getByRole("button", { name: "Continue with Google" });
    if (!(await button.count())) {
      // Not configured in this environment: no button, and email sign-in is intact.
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
      test.info().annotations.push({ type: "note", description: "Google provider disabled here; redirect not exercised." });
    } else {
      // Our side of the hand-off: the auth server is asked for Google with PKCE and our callback. (It then redirects to
      // Google; that leg is the auth server's and can't run in a sandbox.)
      let authorize: URL | null = null;
      await page.route("**/auth/v1/authorize**", async (route) => {
        authorize = new URL(route.request().url());
        await route.fulfill({ status: 200, contentType: "text/html", body: "<title>Google</title>" });
      });
      await button.click();
      await expect.poll(() => authorize?.pathname ?? null).toBe("/auth/v1/authorize");
      const a = authorize as unknown as URL;
      expect(a.searchParams.get("provider")).toBe("google");
      expect(a.searchParams.get("code_challenge")).toBeTruthy();
      expect(a.searchParams.get("prompt")).toBe("select_account");
      // Exactly our callback, nothing after it — so it matches the Redirect URLs list and Supabase doesn't fall back to
      // the Site URL. Where to go next waits in a short-lived cookie.
      const back = new URL(a.searchParams.get("redirect_to")!);
      expect(back.pathname).toBe("/auth/callback");
      expect(back.search).toBe("");
      const kept = (await page.context().cookies()).find((c) => c.name === "wc_oauth_next");
      expect(kept && decodeURIComponent(kept.value)).toBe("/");
      expect(kept?.path).toBe("/auth");
      // Sign-up offers it too, and says the Terms come next.
      await page.goto("/sign-up");
      await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
      await expect(page.getByText("You’ll be asked to agree to the Terms and Privacy notice next.")).toBeVisible();
    }
    // Cancelled at Google (or the provider refused): back to sign-in with a readable message.
    await page.goto("/auth/callback?via=google&error=access_denied&error_description=The+user+denied");
    await expect(page).toHaveURL(/\/sign-in\?error=oauth$/);
    await expect(page.getByRole("alert").filter({ hasText: "Google sign-in didn't finish" })).toBeVisible();
    // A forged or reused code never signs anyone in.
    await page.goto("/auth/callback?via=google&code=not-a-real-code&next=//evil.example");
    await expect(page).toHaveURL(/\/sign-in\?error=oauth$/);
    // The stored destination is spent either way.
    expect((await page.context().cookies()).some((c) => c.name === "wc_oauth_next")).toBe(false);
  });

  test("a code that lands on the home page (Supabase's Site URL fallback) still reaches the callback", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await page.context().addCookies([{ name: "wc_oauth_next", value: encodeURIComponent("/creations"), url: new URL("/auth", test.info().project.use.baseURL ?? "http://localhost:3000").href }]);
    const hops: string[] = [];
    page.on("request", (r) => r.isNavigationRequest() && hops.push(new URL(r.url()).pathname));
    await page.goto("/?code=not-a-real-code");
    // Forwarded to the callback, which tried the code (a fake one is refused) — never left silently on the home page.
    await expect(page).toHaveURL(/\/sign-in\?error=oauth$/);
    expect(hops).toContain("/auth/callback");
    // A provider error on the home page comes back readable too.
    await page.goto("/?error=access_denied&error_description=The+user+denied");
    await expect(page).toHaveURL(/\/sign-in\?error=oauth$/);
  });
});
