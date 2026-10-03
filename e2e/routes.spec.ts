import { expect, test } from "./fixtures";

// Routes follow the design's names (owner, 2 Oct 2026). Old addresses keep working through permanent redirects.
test("old addresses land on the same page under its new name", async ({ page, creator }) => {
  void creator;
  const moved: Array<[string, RegExp]> = [
    ["/profile", /\/creators\/[a-z0-9_]+$/],
    ["/space", /\/materials$/],
    ["/space?tab=collections", /\/materials\?tab=collections$/],
    ["/search?q=tide", /\/explore\?q=tide$/],
    ["/discover", /\/people$/],
    ["/community", /\/pulse$/],
    ["/projects", /\/rooms$/],
    ["/communities", /\/pulse\?filter=communities$/],
  ];
  for (const [from, to] of moved) {
    await page.goto(from);
    await expect(page).toHaveURL(to);
  }
  // A Creation's old address, with its sub-page.
  const art = ((await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: "Old links", content: "Still here." } })).json()) as { artifact: { id: string } }).artifact;
  await page.goto(`/artifacts/${art.id}/studio`);
  await expect(page).toHaveURL(new RegExp(`/creations/${art.id}/studio$`));
  // The API keeps its address.
  expect((await page.request.get(`/api/v1/artifacts/${art.id}`)).status()).toBe(200);
});
