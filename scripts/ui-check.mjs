#!/usr/bin/env node
// Text-first UI check: open a path, find or click elements by role and name,
// print each match's text and box (CSS px). Cheaper than a screenshot.
//
//   node scripts/ui-check.mjs <path> [--find role:name]... [--click role:name]...
//                             [--shot file.jpg] [--width 390] [--height 844]
//
// Base URL: UI_CHECK_BASE_URL (default http://localhost:3000; run `npm run dev` first).
// Optional UI_CHECK_CHROMIUM=/path/to/chromium for a pre-installed browser.

import { chromium } from '@playwright/test';

const USAGE =
  'usage: node scripts/ui-check.mjs <path> [--find role:name]... [--click role:name]... [--shot file.jpg] [--width 390] [--height 844]';
const MAX_MATCHES = 10;

function parseTarget(spec) {
  const at = spec.indexOf(':');
  if (at < 1) throw new Error(`expected role:name, got "${spec}"\n${USAGE}`);
  return { role: spec.slice(0, at), name: spec.slice(at + 1) };
}

function parseArgs(argv) {
  const opts = { path: '/', find: [], click: [], shot: null, width: 390, height: 844 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`${arg} needs a value\n${USAGE}`);
      return next;
    };
    if (arg === '--find') opts.find.push(parseTarget(value()));
    else if (arg === '--click') opts.click.push(parseTarget(value()));
    else if (arg === '--shot') opts.shot = value();
    else if (arg === '--width') opts.width = Number(value());
    else if (arg === '--height') opts.height = Number(value());
    else if (arg.startsWith('--')) throw new Error(`unknown flag ${arg}\n${USAGE}`);
    else opts.path = arg;
  }
  return opts;
}

const oneLine = (text) => text.replace(/\s+/g, ' ').trim().slice(0, 80);
const px = (n) => Math.round(n);

async function report(locator, label) {
  const total = await locator.count();
  if (total === 0) {
    console.log(`${label}: no match`);
    return;
  }
  console.log(`${label}: ${total} match${total === 1 ? '' : 'es'}`);
  for (let i = 0; i < Math.min(total, MAX_MATCHES); i++) {
    const el = locator.nth(i);
    const text = oneLine(await el.innerText({ timeout: 2000 }).catch(() => ''));
    const box = await el.boundingBox();
    const where = box
      ? `x=${px(box.x)} y=${px(box.y)} w=${px(box.width)} h=${px(box.height)}`
      : 'not rendered';
    console.log(`  [${i + 1}] "${text}" ${where}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const base = process.env.UI_CHECK_BASE_URL ?? 'http://localhost:3000';
  const browser = await chromium.launch({
    executablePath: process.env.UI_CHECK_CHROMIUM || undefined,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: opts.width, height: opts.height },
      deviceScaleFactor: 1,
    });
    const locate = (target) => page.getByRole(target.role, { name: target.name });
    const settle = () => page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    await page.goto(new URL(opts.path, base).href, { waitUntil: 'load' });
    await settle();
    console.log(`open ${page.url()} @ ${opts.width}x${opts.height}`);

    for (const target of opts.find) {
      await report(locate(target), `find ${target.role}:${target.name}`);
    }

    let missed = false;
    for (const target of opts.click) {
      await report(locate(target), `click ${target.role}:${target.name}`);
      if ((await locate(target).count()) === 0) {
        missed = true;
        continue;
      }
      await locate(target).first().click({ timeout: 5000 });
      await settle();
      console.log(`  -> ${page.url()}`);
    }

    if (opts.shot) {
      const boxes = [];
      for (const target of opts.find) {
        for (const el of await locate(target).all()) {
          const box = await el.boundingBox();
          if (box) boxes.push(box);
        }
      }
      const { sx, sy } = await page.evaluate(() => ({ sx: window.scrollX, sy: window.scrollY }));
      const clip = boxes.length
        ? {
            x: Math.max(0, Math.min(...boxes.map((b) => b.x)) + sx),
            y: Math.max(0, Math.min(...boxes.map((b) => b.y)) + sy),
          }
        : null;
      if (clip) {
        clip.width = Math.max(...boxes.map((b) => b.x + b.width)) + sx - clip.x;
        clip.height = Math.max(...boxes.map((b) => b.y + b.height)) + sy - clip.y;
      }
      await page.screenshot({
        path: opts.shot,
        type: 'jpeg',
        quality: 60,
        scale: 'css',
        fullPage: Boolean(clip),
        ...(clip ? { clip } : {}),
      });
      console.log(`shot ${opts.shot} ${clip ? 'cropped to find matches' : 'viewport'}`);
    }

    if (missed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
