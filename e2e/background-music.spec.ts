import { expect, fakeMicrophone, test, uid } from "./fixtures";

/** A playable WAV: `seconds` of a soft two-note tone, 22.05 kHz mono. */
function toneWav(seconds: number): Buffer {
  const rate = 22_050;
  const n = Math.round(rate * seconds);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round((Math.sin((2 * Math.PI * 330 * i) / rate) + Math.sin((2 * Math.PI * 495 * i) / rate)) * 4000), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// Background music on the Audio page (owner, 6 Oct 2026): a track from the CreativeRadio library under the take — level,
// tempo with the pitch kept, trim — mixed on the device and kept as a version; it plays, and it's what's published,
// credited as the track's license asks.
test.describe("Audio page: background music", () => {
  test("choose library music, shape it while hearing it, use it; the mix plays and is published with its credit", async ({ page, creator, browser }) => {
    test.setTimeout(180_000);
    await fakeMicrophone(page, true);
    // The library's files are never fetched in tests: each track's audio is a short generated tone.
    const library = (await (await page.request.get("/api/v1/soundtrack")).json()) as { tracks: Array<{ id: string; title: string; artist: string; audioUrl: string }> };
    const track = library.tracks[0]!;
    const wav = toneWav(12);
    for (const t of library.tracks) {
      await page.route(new URL(t.audioUrl, "http://localhost:3000").href.replace(/^http:\/\/localhost:3000/, "**"), (route) =>
        route.fulfill({ status: 200, body: wav, headers: { "content-type": "audio/wav", "access-control-allow-origin": "*", "accept-ranges": "bytes" } }),
      );
    }

    const title = `Platform 3 ${uid()}`;
    const res = await page.request.post("/api/v1/artifacts", { data: { artifactType: "song_concept", title, content: "Before the first train." } });
    const id = ((await res.json()) as { artifact: { id: string } }).artifact.id;
    await page.goto(`/creations/${id}/audio`);
    const editor = page.getByRole("region", { name: "Editor" });

    await page.getByRole("button", { name: "Record", exact: true }).click();
    const rec = page.getByRole("dialog", { name: "Record" });
    await expect(rec.getByRole("button", { name: "Stop" })).toBeEnabled();
    await page.waitForTimeout(2500);
    await rec.getByRole("button", { name: "Stop" }).click();
    await rec.getByRole("button", { name: "Keep this take" }).click();
    await expect(rec).toBeHidden({ timeout: 30_000 });

    // One quiet row under the recording.
    await editor.getByRole("button", { name: "Add background music" }).click();
    const sheet = page.getByRole("dialog", { name: "Background music" });
    await sheet.getByRole("list", { name: "Music" }).getByRole("button", { name: new RegExp(track.title) }).click();

    // Shape it while hearing it under the take.
    const tempo = sheet.getByRole("slider", { name: "Tempo" });
    await tempo.focus();
    await page.keyboard.press("ArrowRight");
    await expect(sheet.getByText("105%", { exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: "Play with your take" }).click();
    await expect(sheet.getByRole("button", { name: "Pause" })).toBeVisible();
    await sheet.getByRole("button", { name: "Pause" }).click();
    await expect(sheet).toContainText(`“${track.title}” by ${track.artist}`);

    // Use it: mixed here, kept as a version; the recording now plays with its music.
    await sheet.getByRole("button", { name: "Use this music" }).click();
    await expect(sheet).toBeHidden({ timeout: 60_000 });
    await expect(editor.getByRole("button", { name: new RegExp(`Background music: ${track.title}`) })).toBeVisible();
    await expect(editor).toContainText("105% tempo");
    await expect(editor.getByRole("button", { name: "Play the recording with its music" })).toBeEnabled();

    // Publish the finished piece: its own page plays the mix, and the music is credited.
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const pub = page.getByRole("dialog", { name: "Publish as link" });
    await pub.getByRole("button", { name: "Publish as link" }).click();
    await expect(pub.getByText(/^Published/)).toBeVisible({ timeout: 30_000 });
    const link = (await pub.getByText(new RegExp(`/p/${creator.handle}/`)).first().textContent())!.trim();
    const guest = await (await browser.newContext()).newPage();
    await guest.goto(link.slice(link.indexOf("/p/")));
    await expect(guest.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(guest.getByText(new RegExp(`Music: .*${track.artist}`))).toBeVisible();
    await guest.context().close();
  });
});
