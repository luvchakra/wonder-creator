import { createAuthUser, expect, signInViaUi, test } from "./fixtures";

// Privacy compliance (GDPR / DPDP): notice and consent before use, choices and requests in Settings, a full export.
test.describe("Privacy", () => {
  test("a new account reads the notice and agrees before anything else; optional choices are off unless chosen", async ({ page }, info) => {
    const user = await createAuthUser("Asha Notice");
    await page.setViewportSize({ width: 390, height: 844 });
    await signInViaUi(page, user, /^\/consent$/);
    // Nothing else opens until they agree.
    await page.goto("/");
    await expect(page).toHaveURL(/\/consent$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Before you begin");
    const analytics = page.getByRole("checkbox", { name: /usage measures/ });
    await expect(analytics).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: /emails/ })).not.toBeChecked();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Tick the box" })).toBeVisible();
    await page.getByRole("checkbox", { name: /18 or older/ }).check();
    await analytics.check();
    await info.attach("consent-390.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL((u) => u.pathname === "/onboarding");
    const { consents } = (await (await page.request.get("/api/v1/privacy/consents")).json()) as { consents: Array<{ purpose: string; granted: boolean }> };
    expect(Object.fromEntries(consents.map((c) => [c.purpose, c.granted]))).toEqual({ terms: true, privacy_notice: true, age_confirmation: true, product_analytics: true, product_emails: false });
    // Once agreed, the prompt doesn't come back.
    await page.goto("/consent");
    await expect(page).not.toHaveURL(/\/consent$/);
  });

  test("Settings: change a choice, make a request with a due date, and export everything", async ({ page, creator }, info) => {
    await page.goto("/settings?section=privacy");
    const panel = page.getByRole("region", { name: "Your data & choices" });
    await panel.getByRole("switch", { name: /emails/ }).click();
    await expect(panel.getByRole("status").filter({ hasText: "Turned on." })).toBeVisible();

    await panel.getByRole("button", { name: "Make a privacy request" }).click();
    await panel.getByLabel("What would you like?").selectOption("correction");
    await panel.getByLabel("Details").fill("My old surname is still on an early Creation.");
    await panel.getByRole("button", { name: "Send request" }).click();
    await expect(panel.getByRole("status").filter({ hasText: /Received\. We.ll answer by/ })).toBeVisible();
    const list = panel.getByRole("list", { name: "Your privacy requests" });
    await expect(list).toContainText("Correct or complete my data");
    await expect(list).toContainText(/Received · answer by/);
    await info.attach("privacy-settings.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });

    const res = await page.request.get("/api/v1/account/export");
    expect(res.status()).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect((data.account as { email: string }).email).toBe(creator.email);
    expect(data.noticeVersion).toBeTruthy();
    expect((data.consent_records as Array<{ purpose: string }>).some((c) => c.purpose === "product_emails")).toBe(true);
    expect(data.privacy_requests as unknown[]).toHaveLength(1);
    expect(data).toHaveProperty("artifacts");
    expect(data).toHaveProperty("scrapbook_posts");
  });

  test("the notice, terms and subprocessors are public; sign-up asks for agreement", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    for (const [path, heading] of [
      ["/legal/privacy", "Privacy notice"],
      ["/legal/terms", "Terms of Service"],
      ["/legal/subprocessors", "Subprocessors"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    }
    await page.goto("/legal/privacy");
    for (const s of ["Your rights", "Grievance Officer and complaints", "How long we keep it", "International transfers", "Children"]) await expect(page.getByRole("heading", { name: s })).toBeVisible();
    await page.goto("/sign-up");
    await page.getByLabel("Your name").fill("No Box");
    await page.getByLabel("Email").fill("no-box@example.com");
    await page.getByLabel("Password").fill("e2e-password-0123456789");
    await page.getByRole("button", { name: /Let's begin/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Tick the box" })).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up$/);
  });
});
