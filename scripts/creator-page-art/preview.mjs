// Renders every piece to PNG in a directory for review: node preview.mjs <outdir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { DECORATIONS, TEMPLATES, WIDE } from "./catalog.mjs";

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
for (const a of [...TEMPLATES, ...WIDE, ...DECORATIONS]) {
  const s = a.make();
  writeFileSync(join(out, `${a.file}.svg`), s);
  const [, w, h] = /viewBox="0 0 (\d+) (\d+)"/.exec(s);
  const scale = Math.min(1, 800 / Number(w));
  await page.setViewportSize({ width: Math.round(w * scale), height: Math.round(h * scale) });
  await page.setContent(`<html><body style="margin:0;background:#f4efe8"><img src="data:image/svg+xml;base64,${Buffer.from(s).toString("base64")}" style="width:100%;display:block"></body></html>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, `${a.file}.png`) });
  console.log(a.file, `${Math.round(s.length / 1024)} KB`);
}
await browser.close();
