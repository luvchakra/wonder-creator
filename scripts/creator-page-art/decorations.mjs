import { branch, f, grainFilter, leaf, pt, rng, smooth, svg, tornLine } from "./lib.mjs";
import { tapePiece } from "./templates.mjs";

const sheen = `<linearGradient id="tapeSheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.6"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.3"/></linearGradient>`;

/** Botanical Corner Cluster — a full corner of leaves, white blossoms and buds (transparent). */
export function botanicalCorner({ seed = 61 } = {}) {
  const r = rng(seed);
  const w = 1600, h = 1200;
  let out = "";
  out += branch(r, [[-20, h * 0.95], [w * 0.2, h * 0.7], [w * 0.42, h * 0.5], [w * 0.62, h * 0.38]], { leafLen: 190, leafW: 70, leaves: 14, flowers: 3, buds: 3, flowerR: 70, stemW: 6 });
  out += branch(r, [[-20, h * 0.6], [w * 0.14, h * 0.42], [w * 0.3, h * 0.22], [w * 0.38, h * 0.08]], { leafLen: 150, leafW: 56, leaves: 10, flowers: 2, buds: 4, flowerR: 60, stemW: 5 });
  out += branch(r, [[w * 0.2, h + 20], [w * 0.4, h * 0.85], [w * 0.62, h * 0.8], [w * 0.8, h * 0.82]], { leafLen: 150, leafW: 54, leaves: 10, flowers: 2, buds: 3, flowerR: 58, stemW: 5 });
  return svg(w, h, out, { title: "Botanical Corner Cluster", desc: "Leaves, white blossoms and buds for a page corner." });
}

/** Slim Branch Illustration — one elegant, sparse diagonal branch (transparent). */
export function slimBranch({ seed = 62 } = {}) {
  const r = rng(seed);
  const w = 1600, h = 900;
  const out = branch(r, [[w * 0.04, h * 0.9], [w * 0.3, h * 0.66], [w * 0.58, h * 0.42], [w * 0.8, h * 0.24], [w * 0.96, h * 0.1]], { leafLen: 120, leafW: 38, leaves: 16, flowers: 2, buds: 8, flowerR: 64, stemW: 4 });
  return svg(w, h, out, { title: "Slim Branch Illustration", desc: "A sparse diagonal branch with small leaves and buds." });
}

/** Watercolor Wash Blob — peach and blue washes with pooled edges and granulation (transparent). */
export function watercolorWash({ seed = 63 } = {}) {
  const r = rng(seed);
  const w = 1600, h = 900;
  const blob = (cx, cy, rad, col, id) => {
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * rad * r.range(0.85, 1.1), cy + Math.sin(a) * rad * 0.62 * r.range(0.85, 1.12)]);
    }
    return `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.6"><stop offset="0" stop-color="${col}" stop-opacity="0.55"/><stop offset="0.75" stop-color="${col}" stop-opacity="0.8"/><stop offset="1" stop-color="${col}" stop-opacity="1"/></radialGradient><g filter="url(#wet)"><path d="${smooth(pts, true, 0.5)}" fill="url(#${id})"/><path d="${smooth(pts, true, 0.5)}" fill="none" stroke="${col}" stroke-width="14" opacity="0.45"/></g>`;
  };
  const out = `<defs><filter id="wet" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="5" seed="8" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="46" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="7" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="3" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.7 1.15" result="ga"/><feComposite in="b" in2="ga" operator="in"/></filter></defs>
${blob(w * 0.36, h * 0.5, w * 0.28, "#f4a988", "wa")}${blob(w * 0.66, h * 0.52, w * 0.26, "#8fa9d6", "wb")}${blob(w * 0.5, h * 0.44, w * 0.12, "#f0b8b8", "wc")}`;
  return svg(w, h, out, { title: "Watercolor Wash Blob", desc: "Peach and blue watercolour washes." });
}

/** Translucent Gradient Blob — lavender-to-blue and blush organic shapes with a fine highlight. */
export function gradientBlob({ seed = 64 } = {}) {
  const r = rng(seed);
  const w = 1200, h = 900;
  const shape = (cx, cy, rx, ry, _n) => {
    const pts = [];
    const lobes = Array.from({ length: 3 }, () => [r.range(1, 3.99) | 0, r.range(0, Math.PI * 2), r.range(0.02, 0.09)]);
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const k = 1 + lobes.reduce((acc, [m, ph, amp]) => acc + Math.sin(a * (m + 1) + ph) * amp, 0);
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return smooth(pts, true, 0.5);
  };
  const out = `<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4c6fb"/><stop offset="0.5" stop-color="#c3c7fb"/><stop offset="1" stop-color="#a9c6fa"/></linearGradient><linearGradient id="b" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#fbd0e0"/><stop offset="1" stop-color="#f6d9f3"/></linearGradient><filter id="s"><feGaussianBlur stdDeviation="3"/></filter></defs>
<path d="${shape(w * 0.4, h * 0.46, w * 0.3, h * 0.36, 12)}" fill="url(#a)" opacity="0.85" filter="url(#s)" transform="rotate(-18 ${pt(w * 0.4, h * 0.46)})"/>
<path d="${shape(w * 0.64, h * 0.56, w * 0.26, h * 0.3, 12)}" fill="url(#b)" opacity="0.7" filter="url(#s)" transform="rotate(22 ${pt(w * 0.64, h * 0.56)})"/>
<path d="M${pt(w * 0.14, h * 0.78)} C${pt(w * 0.35, h * 0.45)} ${pt(w * 0.6, h * 0.25)} ${pt(w * 0.9, h * 0.18)}" fill="none" stroke="#fff" stroke-width="3" opacity="0.9"/>`;
  return svg(w, h, out, { title: "Translucent Gradient Blob", desc: "Soft lavender, blue and blush translucent shapes." });
}

/** Paper Tape Pieces — four washi strips with torn ends (transparent). */
export function paperTape({ seed = 65 } = {}) {
  const r = rng(seed);
  const w = 1200, h = 900;
  const out = `<defs>${sheen}<filter id="d"><feDropShadow dx="2" dy="4" stdDeviation="4" flood-color="#5a4630" flood-opacity="0.18"/></filter></defs><g filter="url(#d)">
${tapePiece(r, w * 0.3, h * 0.25, 440, 130, -12, "#e3c9a0", 0.85)}${tapePiece(r, w * 0.72, h * 0.22, 420, 120, 4, "#eadfc8", 0.85)}${tapePiece(r, w * 0.28, h * 0.68, 360, 120, 18, "#b9bcc4", 0.8)}${tapePiece(r, w * 0.7, h * 0.7, 440, 125, -6, "#dcc29a", 0.85)}</g>`;
  return svg(w, h, out, { title: "Paper Tape Pieces", desc: "Washi tape strips in kraft, cream and grey." });
}

/** Torn Paper Strip — a white and a kraft strip with fibrous torn edges (transparent). */
export function tornPaperStrip({ seed = 66 } = {}) {
  const r = rng(seed);
  const w = 1600, h = 600;
  const strip = (y, hh, fill, edge) => {
    const top = tornLine(r, 20, w - 20, y, { step: 12, jag: 12 });
    const bottom = tornLine(r, 20, w - 20, y + hh, { step: 12, jag: 16 }).reverse();
    const d = `M${[...top, ...bottom].map(([a, b]) => pt(a, b)).join(" L")}Z`;
    return `<path d="${d}" fill="${edge}" transform="translate(0,4)" filter="url(#fib)"/><path d="${d}" fill="${fill}" filter="url(#fib)"/>`;
  };
  const out = `<defs><filter id="fib" x="-5%" y="-20%" width="110%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.04 0.4" numOctaves="3" seed="6" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="12"/><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#5a4630" flood-opacity="0.2"/></filter>${grainFilter("g", { amount: 0.1, freq: 0.9 })}</defs>
${strip(60, 190, "#f6f1e8", "#fffdf8")}${strip(330, 200, "#c8a47a", "#e7d4ba")}`;
  return svg(w, h, out, { title: "Torn Paper Strip", desc: "Torn strips of white and kraft paper." });
}

/** Ink Scribble Accents — loose pen loops, underline swooshes and a small heart (transparent, ink colour). */
export function inkScribble({ seed = 67 } = {}) {
  const r = rng(seed);
  const w = 1600, h = 500;
  let loops = `M${pt(60, 260)}`;
  let x = 60;
  for (let i = 0; i < 5; i++) {
    loops += ` C${pt(x + 40, 60)} ${pt(x + 110, 60)} ${pt(x + 90, 250)} S${pt(x + 150, 330)} ${pt(x + 170, 200)}`;
    x += r.range(90, 130);
  }
  const out = `<g fill="none" stroke="#1d1b1a" stroke-linecap="round" stroke-linejoin="round">
<path d="${loops}" stroke-width="9"/>
<path d="${smooth([[420, 330], [700, 290], [1000, 250], [1300, 230]])}" stroke-width="7"/>
<path d="${smooth([[520, 390], [820, 350], [1150, 320], [1420, 300]])}" stroke-width="5"/>
<path d="${smooth([[760, 440], [1000, 420], [1200, 400]])}" stroke-width="3"/>
<path d="M1450,150 C1420,100 1360,120 1380,170 C1395,205 1440,230 1450,250 C1460,230 1505,205 1520,170 C1540,120 1480,100 1450,150Z" stroke-width="5"/></g>`;
  return svg(w, h, out, { title: "Ink Scribble Accents", desc: "Pen loops, underlines and a small heart." });
}

/** Soft Shadow Card Backdrop — a warm card with dappled leaf shadows falling across it. */
export function softShadowCard({ seed = 68 } = {}) {
  const r = rng(seed);
  const w = 1600, h = 900;
  let shadows = "";
  for (let i = 0; i < 22; i++) shadows += leaf(w * 0.55 + r.range(0, w * 0.4), r.range(0, h * 0.8), r.range(120, 240), r.range(40, 80), r.range(100, 200), { fill: "#8a7560" });
  const out = `<defs><linearGradient id="c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbf6ef"/><stop offset="1" stop-color="#efe3d3"/></linearGradient><filter id="sh" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="22"/></filter><filter id="d" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#6b5a45" flood-opacity="0.18"/></filter><clipPath id="k"><rect x="60" y="60" width="${w - 120}" height="${h - 140}" rx="36"/></clipPath>${grainFilter("g", { amount: 0.05 })}</defs>
<rect x="60" y="60" width="${w - 120}" height="${h - 140}" rx="36" fill="url(#c)" filter="url(#d)"/>
<g clip-path="url(#k)"><g filter="url(#sh)" opacity="0.28">${shadows}</g><rect width="${w}" height="${h}" filter="url(#g)"/></g>`;
  return svg(w, h, out, { title: "Soft Shadow Card Backdrop", desc: "A warm card with soft leaf shadows." });
}

/** Subtle Grain Overlay — a tileable warm noise to lay over any surface (transparent). */
export function grainOverlay({ amount = 0.09, freq = 0.85, seed = 12 } = {}) {
  const s = 512;
  const out = `<defs>${grainFilter("g", { amount, freq, seed })}</defs><rect width="${s}" height="${s}" filter="url(#g)"/>`;
  return svg(s, s, out, { title: "Subtle Grain Overlay", desc: "Tileable paper grain." });
}

/** Light Leak / Glow Overlay — warm window light with soft mullion shadows. */
export function lightLeak() {
  const w = 1600, h = 900;
  const out = `<defs><radialGradient id="l" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stop-color="#ffe2b0"/><stop offset="0.4" stop-color="#f6b56d"/><stop offset="0.8" stop-color="#c77a3e"/><stop offset="1" stop-color="#8e5530"/></radialGradient><filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="26"/></filter></defs>
<rect width="${w}" height="${h}" fill="url(#l)"/>
<g fill="#7a4524" opacity="0.45" filter="url(#b)" transform="skewX(-14)"><rect x="${f(w * 0.62)}" y="-40" width="70" height="${h + 80}"/><rect x="${f(w * 0.9)}" y="-40" width="70" height="${h + 80}"/><rect x="${f(w * 0.5)}" y="${f(h * 0.45)}" width="${f(w * 0.6)}" height="60"/></g>
<rect width="${w}" height="${h}" fill="#fff4de" opacity="0.12"/>`;
  return svg(w, h, out, { title: "Light Leak / Glow Overlay", desc: "Warm window light with soft shadows." });
}

/** Cloud & Mist Overlay — a pale sky of soft, layered clouds. */
export function cloudMist({ seed = 70 } = {}) {
  const r = rng(seed);
  const w = 1600, h = 900;
  let puffs = "";
  for (let i = 0; i < 60; i++) {
    const y = r.range(h * 0.35, h * 1.05);
    puffs += `<ellipse cx="${f(r.range(-100, w + 100))}" cy="${f(y)}" rx="${f(r.range(120, 320))}" ry="${f(r.range(50, 130))}" fill="${r.pick(["#ffffff", "#f7f3f6", "#eef0f8", "#f8ecec"])}" opacity="${f(r.range(0.55, 0.95))}"/>`;
  }
  const out = `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9c7e2"/><stop offset="0.6" stop-color="#dde2ef"/><stop offset="1" stop-color="#f4e9e6"/></linearGradient><filter id="c" x="-20%" y="-50%" width="140%" height="200%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="3" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="90" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="14"/></filter></defs>
<rect width="${w}" height="${h}" fill="url(#s)"/><g filter="url(#c)">${puffs}</g>`;
  return svg(w, h, out, { title: "Cloud & Mist Overlay", desc: "Soft layered clouds on a pale sky." });
}

/** Handwritten Note Element — a lined card with a torn top edge, script lines and a blossom sprig (transparent). */
export function handwrittenNote({ seed = 71 } = {}) {
  const r = rng(seed);
  const w = 1200, h = 1100;
  const top = tornLine(r, 80, 900, 170, { step: 10, jag: 9 });
  const d = `M${top.map(([a, b]) => pt(a, b)).join(" L")} L900,960 L80,960Z`;
  let lines = "";
  for (let i = 0; i < 9; i++) lines += `<line x1="120" x2="860" y1="${250 + i * 76}" y2="${250 + i * 76}" stroke="#d9cfbf" stroke-width="2.5"/>`;
  const sprig = branch(r, [[1180, 1080], [1060, 820], [980, 560], [960, 330]], { leafLen: 110, leafW: 36, leaves: 10, flowers: 3, buds: 3, flowerR: 44 });
  const out = `<defs><filter id="d" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="6" dy="14" stdDeviation="14" flood-color="#5a4630" flood-opacity="0.2"/></filter>${grainFilter("g", { amount: 0.07 })}<clipPath id="k"><path d="${d}"/></clipPath></defs>
<g transform="rotate(-3 490 560)"><path d="${d}" fill="#f7f1e6" filter="url(#d)"/><g clip-path="url(#k)">${lines}<rect width="${w}" height="${h}" filter="url(#g)"/></g></g>${sprig}`;
  return svg(w, h, out, { title: "Handwritten Note Element", desc: "A lined note card with a torn top edge and a blossom sprig." });
}
