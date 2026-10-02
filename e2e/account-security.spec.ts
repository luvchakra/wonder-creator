import { createHmac } from "node:crypto";
import { expect, signInViaUi, test, type Page } from "./fixtures";

/**
 * "Sign out" for a test: leave the signed-in page first, so its background requests (which answer a lost session by
 * going to /sign-in) can't race the test's own navigation, then drop the session cookies.
 */
async function dropSession(page: Page) {
  await page.goto("/legal/security");
  await page.context().clearCookies();
}

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) from a base32 secret — what an authenticator app computes. */
function totp(secret: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

test.describe("Account security", () => {
  test("two-step verification: set up with an authenticator, then nothing works until the code is entered", async ({ page, creator, consoleGuard }) => {
    // The wrong code below is refused by the auth server on purpose.
    consoleGuard.allow(/factors\/[0-9a-f-]+\/verify/);
    await page.goto("/settings?section=privacy");
    const panel = page.getByRole("region", { name: "Sign-in & security" });
    await panel.getByRole("button", { name: "Set up two-step verification" }).click();
    const secret = (await panel.locator("code").innerText()).trim();
    await panel.getByLabel("Code from your app").fill(totp(secret));
    await panel.getByRole("button", { name: "Turn on" }).click();
    await expect(panel.getByRole("status")).toContainText("Two-step verification is on");

    // Sign out, sign in with the password only: the code is required before anything else.
    await dropSession(page);
    await signInViaUi(page, creator, /\/sign-in\/verify$/);
    expect((await page.request.get("/api/v1/creators/me")).status()).toBe(401);
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in\/verify$/);
    await page.getByLabel("Code").fill("000000");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "isn't right" })).toBeVisible();
    await page.getByLabel("Code").fill(totp(secret));
    await page.getByRole("button", { name: "Verify" }).click();
    await page.waitForURL((u) => u.pathname === "/");
    expect((await page.request.get("/api/v1/creators/me")).status()).toBe(200);
  });

  test("change password needs the current one and the policy; forgotten passwords have a way back", async ({ page, creator, consoleGuard }) => {
    // The wrong current password is refused on purpose; a background poll may 401 after cookies are cleared.
    consoleGuard.allow(/\/api\/v1\/account\/password/);
    consoleGuard.allow(/\/api\/v1\/notifications/);
    await page.goto("/settings?section=privacy");
    const panel = page.getByRole("region", { name: "Sign-in & security" });
    await panel.getByRole("button", { name: "Change password" }).click();
    await panel.getByLabel("Current password").fill("not-my-password-1");
    await panel.getByLabel("New password").fill("a quiet harbour 2026");
    await panel.getByRole("button", { name: "Change password" }).click();
    await expect(panel.getByRole("alert")).toContainText("isn't right");
    await panel.getByLabel("Current password").fill(creator.password);
    await panel.getByLabel("New password").fill("short");
    await panel.getByRole("button", { name: "Change password" }).click();
    await expect(panel.getByRole("alert")).toContainText("10 characters");
    await panel.getByLabel("New password").fill("a quiet harbour 2026");
    await panel.getByRole("button", { name: "Change password" }).click();
    await expect(panel.getByRole("status")).toContainText("Password changed.");

    await dropSession(page);
    await signInViaUi(page, { email: creator.email, password: "a quiet harbour 2026" }, /^\/$/);
    await dropSession(page);
    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await page.getByLabel("Email").fill("nobody-here@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    // The same answer whether or not there's an account.
    await expect(page.getByRole("status")).toContainText(/If there.s an account for that email/);
  });

  test("security headers, cross-site refusal and a vulnerability-report contact", async ({ page, creator: _c }) => {
    const res = await page.request.get("/legal/security");
    expect(res.status()).toBe(200);
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["cross-origin-opener-policy"]).toBe("same-origin");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-content-type-options"]).toBe("nosniff");
    const txt = await (await page.request.get("/.well-known/security.txt")).text();
    expect(txt).toMatch(/^Contact: /m);
    expect(txt).toMatch(/^Policy: .*\/legal\/security$/m);
    // A request a browser marks as coming from another site is refused, even with valid cookies.
    const cross = await page.request.patch("/api/v1/creators/me", { data: { bio: "x" }, headers: { "sec-fetch-site": "cross-site" } });
    expect(cross.status()).toBe(403);
  });
});
