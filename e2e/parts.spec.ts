import { expect, newCreator, test, uid } from "./fixtures";

// Parts (docs/creative-room-parts.md): a Song Room lays out Lyrics · Tune · Voice; crew claim parts, an outsider is
// invited to one part only, each part opens on its own page, final is said by the people on it, the timeline tells it.
test.describe("Creative Room parts", () => {
  test("Song: claim, start on the Writing page, invite a singer to Voice only, accept, mark final — the Room tells it", async ({ page, creator, openContext }) => {
    void creator;
    const title = `Platform 3 ${uid()}`;
    await page.goto("/rooms?new=1");
    const create = page.getByRole("dialog", { name: "New Creative Room" });
    await create.getByLabel("Name").fill(title);
    await create.getByLabel(/^Song/).check();
    await create.getByLabel("Already underway").check();
    await create.getByRole("button", { name: "Create Creative Room" }).click();
    await expect(page).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/);
    const projectId = page.url().split("/").pop()!;

    // The parts, in order, all open; one primary action: Claim a part.
    const work = page.getByRole("region", { name: "The work" });
    const rows = work.getByRole("list", { name: "Where it stands" }).getByRole("listitem");
    await expect(rows).toContainText([/Lyrics.*no one yet/, /Tune/, /Voice/]);
    await work.getByRole("button", { name: "Claim a part" }).click();
    await page.getByRole("dialog", { name: "Claim a part" }).getByRole("button", { name: /Lyrics/ }).click();
    await expect(rows.first()).toContainText("Lyrics you");

    // Start it: a Creation of the part's kind, on its own page (lyrics → the Writing page).
    await work.getByRole("button", { name: "Start Lyrics" }).click();
    await expect(page).toHaveURL(/\/creations\/[0-9a-f-]{36}\/write$/);
    const artifactId = page.url().match(/creations\/([0-9a-f-]{36})/)![1];
    const art = (await (await page.request.get(`/api/v1/artifacts/${artifactId}`)).json()).artifact as { title: string; current_version_id: string };
    expect(art.title).toBe(`${title} · Lyrics`);
    await page.request.post(`/api/v1/artifacts/${artifactId}/versions`, { data: { content: "Every Sunday my father waited\nat Platform 3, coat folded.", baseVersionId: art.current_version_id, label: "First words" } });

    // Back in the Room: the words glimpsed in the hero, the row at v2, Open Lyrics as the primary action.
    await page.goto(`/rooms/${projectId}`);
    await expect(work.getByText("Every Sunday my father waited")).toBeVisible();
    await expect(rows.first()).toContainText("v2");
    await expect(work.getByRole("link", { name: "Open Lyrics" })).toHaveAttribute("href", `/creations/${artifactId}/write`);

    // Invite a singer to Voice only — she needn't join the Room.
    const { page: b } = await openContext("singer");
    const mira = await newCreator(b, { name: `Mira ${uid()}` });
    await work.getByRole("button", { name: "Voice actions" }).click();
    await page.getByRole("menuitem", { name: "Invite to this part…" }).click();
    const invite = page.getByRole("dialog", { name: "Invite to Voice" });
    await invite.getByLabel("Find a creator").fill(`@${mira.handle}`);
    await invite.getByRole("button", { name: `Invite ${mira.name}` }).click();
    await expect(invite).toBeHidden();
    await expect(work.getByRole("list", { name: "What happened" }).getByRole("listitem").first()).toContainText(`You invited ${mira.name} to Voice`);

    // Mira: the invitation on her Rooms list; the Room shows its parts and nothing else; Accept; Start Voice → the Audio page.
    await b.goto("/rooms");
    await b.getByRole("region", { name: "Part invitations" }).getByRole("link", { name: /invited you to Voice/ }).click();
    await expect(b).toHaveURL(new RegExp(`/rooms/${projectId}`));
    await expect(b.getByRole("navigation", { name: "Creative Room sections" })).toHaveCount(0);
    const bWork = b.getByRole("region", { name: "The work" });
    await b.getByRole("button", { name: "Accept" }).click();
    await expect(bWork.getByRole("list", { name: "Where it stands" }).getByRole("listitem").nth(2)).toContainText("Voice you (this part only)");
    await bWork.getByRole("button", { name: "Start Voice" }).click();
    await expect(b).toHaveURL(/\/creations\/[0-9a-f-]{36}\/audio$/);
    // A part's Creation is read by everyone making the work: Mira reads the lyrics.
    expect((await b.request.get(`/api/v1/artifacts/${artifactId}`)).ok()).toBe(true);

    // The owner marks Lyrics final; the row and the timeline say so.
    await page.goto(`/rooms/${projectId}`);
    await work.getByRole("button", { name: "Lyrics actions" }).click();
    await page.getByRole("menuitem", { name: "Mark final" }).click();
    await expect(rows.first()).toContainText("Final");
    await expect(work.getByRole("list", { name: "What happened" }).getByRole("listitem").first()).toContainText("You marked Lyrics final");
    await expect(rows.nth(2)).toContainText(/Mira .* \(this part only\)/);
  });
});
