import { expect, test } from "@playwright/test";

test.describe("platform-reported outcomes", () => {
  test("the report endpoint is reachable without a session but refuses unsigned reports", async ({ request }) => {
    const res = await request.post("/api/v1/publications/00000000-0000-4000-8000-000000000000/metrics", { data: { metrics: { views: 5 } } });
    expect([401, 404]).toContain(res.status());
    const body = await res.json();
    expect(body.error?.code).toMatch(/unauthenticated|not_found/);
  });
});
