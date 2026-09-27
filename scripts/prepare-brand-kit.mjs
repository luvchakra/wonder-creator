#!/usr/bin/env node
/**
 * Publishes the owner-supplied Wonder Creator Vector Kit (27 Sep 2026) for the web app and writes the typed registry
 * `packages/ui/src/brand/kit.ts` plus the line-icon components `packages/ui/src/brand/kit-icons.tsx`.
 *
 *   node scripts/prepare-brand-kit.mjs <path to Wonder-Creator-Vector-Kit>
 *
 * Nothing is redrawn or recoloured. Small vector files (≤ 64 KB — logos, icons, the Palette button, washes, gradients,
 * simple illustrations, textures) are published byte-for-byte under content-hashed names. The heavy painted pieces
 * (botanicals, painted illustrations, patterns) are published from the kit's own PNG renders as downscaled-only
 * AVIF + WebP. Line icons become React components whose only change is stroke → currentColor, so they follow the
 * surrounding text colour. The kit itself isn't committed (≈140 MB); see packages/ui/src/brand/ASSETS.md.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const sharp = createRequire(join(root, "apps/web/package.json"))("sharp");
const kit = process.argv[2];
if (!kit) throw new Error("usage: prepare-brand-kit.mjs <Wonder-Creator-Vector-Kit dir>");

const out = join(root, "apps/web/public/brand/kit");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const hash = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 10);
const camel = (s) => s.replace(/\.(svg|png)$/, "").replace(/^(wonder-creator-|icon-)/, "").replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const svgSize = (txt) => {
  const vb = /viewBox="([\d.\s-]+)"/.exec(txt)?.[1]?.trim().split(/\s+/).map(Number);
  return vb ? { width: vb[2], height: vb[3] } : { width: 0, height: 0 };
};

function publishSvg(file) {
  const buf = readFileSync(file);
  const txt = buf.toString("utf8");
  if (/<script|\son[a-z]+=|javascript:|<foreignObject|href="http/i.test(txt)) throw new Error(`unsafe SVG: ${file}`);
  const name = `${basename(file, ".svg")}.${hash(buf)}.svg`;
  writeFileSync(join(out, name), buf);
  return { svg: `/brand/kit/${name}`, ...svgSize(txt) };
}

async function publishRaster(png, widths) {
  const meta = await sharp(png).metadata();
  const ws = [...new Set(widths.map((w) => Math.min(w, meta.width)))];
  const v = { avif: [], webp: [] };
  for (const w of ws) {
    const img = sharp(png).resize({ width: w, withoutEnlargement: true });
    for (const [fmt, buf] of [
      ["avif", await img.clone().avif({ quality: 55, effort: 5 }).toBuffer()],
      ["webp", await img.clone().webp({ quality: 78, alphaQuality: 90, effort: 5 }).toBuffer()],
    ]) {
      const name = `${basename(png, ".png")}-${w}.${hash(buf)}.${fmt}`;
      writeFileSync(join(out, name), buf);
      v[fmt].push({ src: `/brand/kit/${name}`, width: w });
    }
  }
  return { width: meta.width, height: meta.height, ...v };
}

const svgDir = (d) => join(kit, "svg", d);
const files = (d, ext = ".svg") => readdirSync(d).filter((f) => f.endsWith(ext)).sort();
const registry = {};
const group = async (key, dir, { raster } = {}) => {
  registry[key] = {};
  for (const f of files(svgDir(dir))) {
    const svgPath = join(svgDir(dir), f);
    const small = statSync(svgPath).size <= 64 * 1024;
    const png = join(kit, "png", dir, f.replace(/\.svg$/, ".png"));
    registry[key][camel(f)] = small && !raster ? publishSvg(svgPath) : await publishRaster(png, raster ?? [430, 768, 1024, 1440]);
  }
};

await group("logo", "01-Logo");
await group("appIcon", "02-App-Icons");
registry.paletteButton = publishSvg(join(svgDir("03-Palette-Button"), "palette-button-master.svg"));
// App icons for the browser tab, home screen and PWA: the kit's own 1024px render, downscaled.
registry.appIconPng = {};
for (const size of [512, 192, 180]) {
  const buf = await sharp(join(kit, "png/02-App-Icons/app-icon-primary.png")).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
  const name = `app-icon-primary-${size}.${hash(buf)}.png`;
  writeFileSync(join(out, name), buf);
  registry.appIconPng[`s${size}`] = { src: `/brand/kit/${name}`, width: size, height: size };
}
await group("botanical", "05-Botanical-Corners", { raster: [430, 768, 1024] });
await group("wash", "06-Watercolour-Washes");
await group("overlay", "08-Overlays-Gradients");
await group("painted", "09-Illustrative-Elements/painted", { raster: [430, 768, 1024] });
await group("mark", "09-Illustrative-Elements/simple");
await group("texture", "10-Textures");
await group("pattern", "11-Pattern-Elements", { raster: [430, 768, 1024] });

// Line icons → components (stroke becomes currentColor; geometry untouched).
const icons = files(svgDir("04-Tool-Icons/line")).map((f) => {
  const txt = readFileSync(join(svgDir("04-Tool-Icons/line"), f), "utf8");
  const inner = /<g[^>]*>([\s\S]*)<\/g>/.exec(txt)?.[1];
  if (!inner || /<script|\son[a-z]+=/i.test(inner)) throw new Error(`unexpected icon: ${f}`);
  const jsx = inner.replace(/stroke-width=/g, "strokeWidth=").replace(/stroke-linecap=/g, "strokeLinecap=").replace(/stroke-linejoin=/g, "strokeLinejoin=").replace(/fill-rule=/g, "fillRule=").replace(/clip-rule=/g, "clipRule=");
  const name = camel(f).replace(/^./, (c) => c.toUpperCase());
  return `export function Kit${name}Icon(props: IconProps) {\n  return (\n    <KitIcon {...props}>\n      ${jsx}\n    </KitIcon>\n  );\n}`;
});
// Filled icons (tinted round chips) are published as files for richer tiles.
registry.iconChip = {};
for (const f of files(svgDir("04-Tool-Icons/filled"))) registry.iconChip[camel(f).replace(/Filled$/, "")] = publishSvg(join(svgDir("04-Tool-Icons/filled"), f));

const ts = `// Generated by scripts/prepare-brand-kit.mjs — do not edit by hand.
// The owner-supplied Wonder Creator Vector Kit (see ASSETS.md). Files are content-hashed and served immutable.
import type { BrandImageVariant } from "./watercolor";

export interface KitVector {
  svg: string;
  width: number;
  height: number;
}
export interface KitRaster {
  width: number;
  height: number;
  avif: readonly BrandImageVariant[];
  webp: readonly BrandImageVariant[];
}
export type KitAsset = KitVector | KitRaster;

export const KIT = ${JSON.stringify(registry, null, 2)} as const;
`;
writeFileSync(join(root, "packages/ui/src/brand/kit.ts"), ts);
const tsx = `// Generated by scripts/prepare-brand-kit.mjs — do not edit by hand.
// Line icons from the owner-supplied Vector Kit; the only change is stroke → currentColor.
import * as React from "react";

type IconProps = Omit<React.SVGProps<SVGSVGElement>, "children"> & { size?: number | string };

function KitIcon({ size = 24, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {children}
    </svg>
  );
}

${icons.join("\n\n")}
`;
writeFileSync(join(root, "packages/ui/src/brand/kit-icons.tsx"), tsx);
execFileSync("npx", ["prettier", "--write", "--print-width", "200", join(root, "packages/ui/src/brand/kit.ts"), join(root, "packages/ui/src/brand/kit-icons.tsx")], { cwd: root, stdio: "ignore" });
console.log("files:", readdirSync(out).length);
