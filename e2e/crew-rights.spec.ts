import { expect, newCreator, test, uid } from "./fixtures";

test.describe("Crew rights", () => {
  test("policy with publication sign-off, ownership claim acknowledged, collaborator signs off, then publishing proceeds", async ({ page: a, creator: _owner, openContext, consoleGuard }) => {
    test.setTimeout(180_000);
    // Publishing before sign-off is refused on purpose.
    consoleGuard.allow(/409 \(Conflict\).*\/publications\//);
    const { page: b } = await openContext("B");
    const zo = await newCreator(b, { name: `Zo ${uid()}` });
    const zoId = ((await (await a.request.get(`/api/v1/search?type=creators&q=${zo.handle}`)).json()) as { creators: Array<{ id: string }> }).creators[0].id;
    const { project } = (await (
      await a.request.post("/api/v1/projects", {
        data: { title: `Harbour Songs ${uid()}` },
      })
    ).json()) as { project: { id: string } };
    const { crew } = (await (await a.request.post(`/api/v1/projects/${project.id}/crew`, { data: {} })).json()) as { crew: { id: string } };
    await a.request.post(`/api/v1/crews/${crew.id}/members`, {
      data: { creatorId: zoId },
    });
    await b.request.post(`/api/v1/crews/${crew.id}/respond`, {
      data: { accept: true },
    });
    const art = (
      (await (
        await a.request.post("/api/v1/artifacts", {
          data: { artifactType: "poem", title: `Lanterns ${uid()}` },
        })
      ).json()) as {
        artifact: { id: string; current_version_id: string; title: string };
      }
    ).artifact;
    await a.request.post(`/api/v1/artifacts/${art.id}/versions`, {
      data: {
        content: "First light over the harbour.",
        baseVersionId: art.current_version_id,
        label: "Written",
      },
    });
    expect(
      (
        await a.request.post(`/api/v1/projects/${project.id}/items`, {
          data: { kind: "artifact", ids: [art.id] },
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await a.request.post(`/api/v1/artifacts/${art.id}/collaborators`, {
          data: { creatorId: zoId, role: "Co-writer", access: "propose" },
        })
      ).ok(),
    ).toBeTruthy();

    // The owner requires sign-off before publishing.
    await a.goto(`/projects/${project.id}`);
    await a.getByRole("navigation", { name: "Creative Room sections" }).getByRole("link", { name: "Rights" }).click();
    await expect(a.getByText("not legal determinations")).toBeVisible();
    await a.getByRole("button", { name: "Edit policy" }).click();
    const policy = a.getByRole("dialog", { name: "Creative Room rights policy" });
    await policy.getByLabel(/Require sign-off before publishing/).check();
    await policy.getByLabel("Agreement").fill("Credits in order of contribution.");
    await policy.getByRole("button", { name: "Save policy" }).click();
    await expect(a.getByRole("region", { name: "Creative Room policy" })).toContainText("Collaborators sign off first");
    await expect(a.getByRole("region", { name: "Waiting for sign-off" })).toContainText(zo.name);

    const { publications } = (await (
      await a.request.post(`/api/v1/artifacts/${art.id}/publications`, {
        data: { destinations: [{ kind: "profile" }], title: art.title },
      })
    ).json()) as { publications: Array<{ id: string }> };
    const blocked = await a.request.post(`/api/v1/publications/${publications[0].id}`, { data: { action: "approve" } });
    expect(blocked.status()).toBe(409);
    expect(JSON.stringify(await blocked.json())).toContain("sign off on this version");

    // Zo sees their permission and makes an ownership claim.
    await b.goto(`/projects/${project.id}?tab=rights`);
    const pieces = b.getByRole("region", { name: "Creations" });
    await pieces.getByText(art.title).click();
    await expect(pieces).toContainText("Can propose changes");
    await b.getByRole("button", { name: "Make a claim" }).click();
    const claim = b.getByRole("dialog", { name: "Make an ownership claim" });
    await claim.getByLabel("Your claim").selectOption("co_owner");
    await claim.getByLabel("Share (%)").fill("30");
    await claim.getByLabel("Why").fill("I wrote the second stanza.");
    await claim.getByRole("button", { name: "Record claim" }).click();
    const claims = b.getByRole("region", { name: "Ownership claims" });
    await expect(claims).toContainText("Co-owner · 30%");
    await expect(claims).toContainText("Awaiting response");

    // The owner is told and acknowledges it; the rights record itself is untouched.
    expect(JSON.stringify(await (await a.request.get("/api/v1/notifications")).json())).toContain("made an ownership claim");
    await a.reload();
    await a.getByRole("region", { name: "Ownership claims" }).getByRole("button", { name: "Acknowledge" }).click();
    const ack = a.getByRole("dialog", { name: "Acknowledge this claim?" });
    await ack.getByLabel("Note (optional)").fill("Agreed.");
    await ack.getByRole("button", { name: "Acknowledge" }).click();
    await expect(a.getByRole("region", { name: "Ownership claims" })).toContainText("Acknowledged by");

    // Zo signs off from the collaborate page.
    await b.goto(`/artifacts/${art.id}/collaborate`);
    const signoff = b.getByRole("region", { name: "Publishing sign-off" });
    await expect(signoff).toContainText("Not yet");
    await signoff.getByRole("button", { name: "Approve publishing" }).click();
    await b.getByRole("dialog", { name: "Approve publishing?" }).getByRole("button", { name: "Approve" }).click();
    await expect(signoff).toContainText("Approved");

    expect(
      (
        await a.request.post(`/api/v1/publications/${publications[0].id}`, {
          data: { action: "approve" },
        })
      ).ok(),
    ).toBeTruthy();
    await a.reload();
    await expect(a.getByRole("region", { name: "Waiting for sign-off" })).toHaveCount(0);
    const history = a.getByRole("region", { name: "Rights history" });
    await expect(history).toContainText("Signed off on publishing");
    await expect(history).toContainText("Acknowledged a claim");
  });
});
