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
    await expect(rows.first()).toContainText(/Lyrics\s*you/);

    // Start it: a Creation of the part's kind, on its own page (lyrics → the Writing page).
    await work.getByRole("button", { name: "Start Lyrics" }).click();
    await expect(page).toHaveURL(/\/creations\/[0-9a-f-]{36}\/write$/);
    const artifactId = page.url().match(/creations\/([0-9a-f-]{36})/)![1];
    const art = (await (await page.request.get(`/api/v1/artifacts/${artifactId}`)).json()).artifact as { title: string; current_version_id: string };
    expect(art.title).toBe(`${title} · Lyrics`);
    await page.request.post(`/api/v1/artifacts/${artifactId}/versions`, { data: { content: "Every Sunday my father waited\nat Platform 3, coat folded.", baseVersionId: art.current_version_id, label: "First words" } });

    // The Creation page fits its context: the words set as lyrics, which Room they're a part of, Continue writing first.
    await page.goto(`/creations/${artifactId}`);
    await expect(page.getByRole("region", { name: "Preview" })).toContainText("Every Sunday my father waited");
    await expect(page.getByRole("status").filter({ hasText: "Lyrics in" }).getByRole("link", { name: title })).toHaveAttribute("href", `/rooms/${projectId}`);
    await expect(page.getByRole("link", { name: "Continue writing" })).toHaveAttribute("href", `/creations/${artifactId}/write`);

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
    await expect(bWork.getByRole("list", { name: "Where it stands" }).getByRole("listitem").nth(2)).toContainText(/Voice\s*you \(this part only\)/);
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

    // Made with (step 2): Mira keeps a take — it records Lyrics v2. The lyrics move on; her page says so and shows the lines.
    const voiceId = b.url().match(/creations\/([0-9a-f-]{36})/)![1];
    const voiceArt = (await (await b.request.get(`/api/v1/artifacts/${voiceId}`)).json()).artifact as { current_version_id: string };
    expect((await b.request.post(`/api/v1/artifacts/${voiceId}/versions`, { data: { content: "A first take.", baseVersionId: voiceArt.current_version_id, label: "First take" } })).ok()).toBe(true);
    const lyricsNow = (await (await page.request.get(`/api/v1/artifacts/${artifactId}`)).json()).artifact as { current_version_id: string };
    await page.request.post(`/api/v1/artifacts/${artifactId}/versions`, { data: { content: "Every Sunday my father waited\nat Platform 3, his coat folded.", baseVersionId: lyricsNow.current_version_id, label: "Second pass" } });
    await b.reload();
    const notice = b.getByRole("status").filter({ hasText: "Lyrics moved on" });
    await expect(notice).toContainText("v2 → v3");
    await notice.getByRole("button", { name: "what changed" }).click();
    const changes = b.getByRole("dialog", { name: "Lyrics: what changed" });
    await expect(changes.getByLabel("Lyrics changes")).toContainText("his coat folded");
    await changes.getByRole("button", { name: "Close" }).click();

    // Suggest to the lyricist, from the Audio page: a proposal; the Room's timeline tells it, nothing changed yet.
    await b.getByRole("button", { name: "More" }).click();
    await b.getByRole("button", { name: /Suggest to Lyrics/ }).click();
    const suggest = b.getByRole("dialog", { name: "Suggest to Lyrics" });
    await expect(suggest.getByLabel("Lyrics words")).toHaveValue(/his coat folded/);
    await suggest.getByLabel("Lyrics words").fill("Every Sunday my father waited\nat Platform 3, coat on his arm.");
    await suggest.getByLabel("What you'd change, in a line").fill("Easier to sing on the long note");
    await suggest.getByRole("button", { name: "Send suggestion" }).click();
    await expect(suggest.getByRole("status")).toContainText("Sent");
    await page.goto(`/rooms/${projectId}`);
    await expect(work.getByRole("list", { name: "What happened" }).getByRole("listitem").first()).toContainText(`${mira.name} suggested a change to Lyrics`);
    await expect(rows.nth(2)).toContainText("Lyrics moved on");
  });
});
