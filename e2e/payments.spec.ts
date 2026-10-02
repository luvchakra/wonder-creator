import { createHmac, randomUUID } from "node:crypto";
import { adminPatch, expect, newCreator, PASSWORD, test, uid, type Page } from "./fixtures";

// Licence payments (Stripe / Razorpay). The app runs with a Stripe webhook secret for tests (see ci.yml) and a key the
// real Stripe rejects, so checkout creation fails honestly and confirmation is simulated with a signed webhook event.
const WEBHOOK_SECRET = process.env.E2E_STRIPE_WEBHOOK_SECRET ?? "e2e-webhook-secret";

function signed(event: unknown, secret = WEBHOOK_SECRET, t = Math.floor(Date.now() / 1000)) {
  const body = JSON.stringify(event);
  return { body, signature: `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}` };
}

async function postStripe(page: Page, event: unknown, secret?: string) {
  const { body, signature } = signed(event, secret);
  return page.request.post("/api/v1/payments/webhooks/stripe", { headers: { "stripe-signature": signature, "content-type": "application/json" }, data: body });
}

test.describe("Licence payments", () => {
  test("a licensee pays; only the provider's signed confirmation settles it; the owner sees it in Business and can refund", async ({ page: owner, creator, openContext, consoleGuard }) => {
    test.setTimeout(120_000);
    void creator;
    // Expected: the test key is refused by the provider (502), the refund needs a password first (403).
    consoleGuard.allow(/status of 502/);
    consoleGuard.allow(/status of 403 \(Forbidden\) \(http:\/\/[^)]*\/api\/v1\/payments\//);
    const title = `Harbour light ${uid()}`;
    const piece = (await (await owner.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title } })).json()).artifact.id as string;
    expect((await owner.request.patch(`/api/v1/artifacts/${piece}`, { data: { status: "final", privacy: "public" } })).ok()).toBe(true);

    const { page: payer } = await openContext("payer");
    await newCreator(payer);
    const terms = { licenseType: "promotional", mode: "paid_nonexclusive", feeAmount: 1500, feeCurrency: "INR", territory: "India" };
    const rq = await payer.request.post(`/api/v1/artifacts/${piece}/license-requests`, { data: { proposedUse: "Spring poster", terms } });
    expect(rq.ok()).toBe(true);
    const requestId = (await rq.json()).request.id as string;
    expect((await owner.request.post(`/api/v1/license-requests/${requestId}`, { data: { action: "approve", password: PASSWORD } })).ok()).toBe(true);

    // The licensee sees the fee and pays on the provider's page — here the provider refuses the test key, honestly.
    await payer.goto(`/creations/${piece}?tab=rights`);
    const fee = payer.getByLabel("Licence fee");
    await expect(fee).toContainText("Not paid yet");
    await fee.getByRole("button", { name: "Pay ₹1,500.00" }).click();
    await expect(fee.getByRole("alert")).toContainText(/didn't accept|couldn't be reached/);

    // The order exists with the licence's amount; nobody can mark it paid by asking.
    const [order] = (await (await payer.request.get("/api/v1/payments")).json()).payments as Array<{ id: string; amount_minor: number; currency: string; status: string }>;
    expect(order).toMatchObject({ amount_minor: 150000, currency: "INR", status: "created" });
    // Test setup: the checkout the provider would have created.
    await adminPatch("payment_orders", `id=eq.${order!.id}`, { provider: "stripe", provider_order_ref: `cs_e2e_${order!.id}`, status: "open", checkout_url: "https://checkout.stripe.com/c/pay/e2e" });

    const paid = { id: `evt_${randomUUID()}`, type: "checkout.session.completed", data: { object: { id: `cs_e2e_${order!.id}`, payment_status: "paid", amount_total: 150000, currency: "inr", payment_intent: `pi_e2e_${order!.id}` } } };
    // A forged event is refused; the genuine one settles once; a replay changes nothing.
    expect((await postStripe(payer, paid, "not-the-secret")).status()).toBe(422);
    const ok = await postStripe(payer, paid);
    expect(ok.status()).toBe(200);
    expect((await ok.json()).outcome).toBe("applied");
    expect((await (await postStripe(payer, paid)).json()).outcome).toBe("duplicate");

    await payer.goto(`/payments/${order!.id}`);
    await expect(payer.getByRole("heading", { level: 1 })).toHaveText("Payment received");
    if (process.env.PAY_SHOTS) await payer.screenshot({ path: `${process.env.PAY_SHOTS}/pay-return.png` });
    await payer.goto(`/creations/${piece}?tab=rights`);
    await expect(payer.getByLabel("Licence fee")).toContainText("Paid");
    await expect(payer.getByRole("button", { name: /^Pay / })).toHaveCount(0);

    // The owner: paid in the licence list and received in Business, linked to the payment.
    await owner.goto(`/creations/${piece}?tab=rights`);
    const ownerFee = owner.getByLabel("Licence fee");
    await expect(ownerFee).toContainText("₹1,500.00");
    await expect(ownerFee).toContainText("via Stripe");
    if (process.env.PAY_SHOTS) await ownerFee.locator("xpath=ancestor::section[1]").screenshot({ path: `${process.env.PAY_SHOTS}/pay-owner.png` });
    await owner.goto("/business");
    const records = owner.getByRole("list", { name: "Records" });
    await expect(records).toContainText("paid through Wonder Creator");
    // Settled by the provider: it can't be re-marked by hand (refund instead), only annotated.
    await records.getByRole("button", { name: /^More for License income/ }).first().click();
    await expect(owner.getByRole("menuitem", { name: "Add note" })).toBeVisible();
    await expect(owner.getByRole("menuitem", { name: /Mark as expected|Cancel/ })).toHaveCount(0);
    await owner.keyboard.press("Escape");
    const csv = await owner.request.get(`/api/v1/payments/statement?year=${new Date().getFullYear()}`);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const text = await csv.text();
    expect(text).toContain("provider_clearing:stripe");
    expect(text).toContain(`pi_e2e_${order!.id}`);

    // Refunds ask for the password again; the (test) provider refuses, and nothing is marked refunded.
    await owner.goto(`/creations/${piece}?tab=rights`);
    await owner.getByLabel("Licence fee").getByRole("button", { name: "Refund…" }).click();
    const dialog = owner.getByRole("dialog", { name: "Refund this payment" });
    await expect(dialog.getByLabel("Amount (INR)")).toHaveValue("1500");
    await dialog.getByLabel("Reason").fill("Poster cancelled");
    await dialog.getByRole("button", { name: "Refund" }).click();
    const stepUp = owner.getByRole("dialog", { name: "Confirm it's you" });
    await stepUp.getByLabel("Password").fill(PASSWORD);
    await stepUp.getByRole("button", { name: "Confirm" }).click();
    await expect(dialog.getByRole("alert")).toContainText(/didn't accept|couldn't be reached/);
    const after = (await (await owner.request.get(`/api/v1/payments/${order!.id}`)).json()).payment as { status: string };
    expect(after.status).toBe("paid");
  });

  test("webhooks need a valid, fresh signature", async ({ page, creator: _c }) => {
    const ev = { id: `evt_${randomUUID()}`, type: "checkout.session.expired", data: { object: { id: "cs_nobody" } } };
    expect((await page.request.post("/api/v1/payments/webhooks/stripe", { data: JSON.stringify(ev), headers: { "content-type": "application/json" } })).status()).toBe(422);
    const stale = signed(ev, WEBHOOK_SECRET, Math.floor(Date.now() / 1000) - 3600);
    expect((await page.request.post("/api/v1/payments/webhooks/stripe", { headers: { "stripe-signature": stale.signature }, data: stale.body })).status()).toBe(422);
    const ok = await postStripe(page, ev);
    expect((await ok.json()).outcome).toBe("unmatched");
    // Razorpay isn't connected in this environment: an honest 503, never a fake success.
    expect((await page.request.post("/api/v1/payments/webhooks/razorpay", { data: "{}" })).status()).toBe(503);
  });
});
