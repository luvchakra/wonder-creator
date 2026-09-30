import { branch, f, grainFilter, leaf, paintFilter, pt, ridge, rng, scriptLine, smooth, svg, tornLine } from "./lib.mjs";

const W = 1920;
const H = 2560;

/** 1 · Immersive Artistic Hero — a painterly sunrise over layered mountains, mist and a lake. */
export function immersiveHero({ width = W, height = H, seed = 11 } = {}) {
  const r = rng(seed);
  const horizon = height * 0.56;
  const sunX = width * 0.52;
  let clouds = "";
  const cloudCols = ["#f6c3a4", "#eeaaa6", "#d9a6c3", "#c7a9d4", "#fbd8b8", "#b9a4cf"];
  for (let i = 0; i < 38; i++) {
    const cy = r.range(height * 0.06, horizon - height * 0.1);
    const nearHorizon = (cy - height * 0.06) / (horizon - height * 0.16);
    const col = nearHorizon > 0.55 ? r.pick(["#f7c29d", "#f4b18e", "#fbd3a8"]) : r.pick(cloudCols);
    clouds += `<ellipse cx="${f(r.range(-100, width + 100))}" cy="${f(cy)}" rx="${f(r.range(160, 420))}" ry="${f(r.range(26, 70))}" fill="${col}" opacity="${f(r.range(0.35, 0.75))}"/>`;
  }
  const layers = [
    { y: horizon - height * 0.07, amp: 150, top: "#e6b3b8", bottom: "#f3cfc4", mist: 0.55 },
    { y: horizon - height * 0.03, amp: 190, top: "#c29cc0", bottom: "#e3bfc9", mist: 0.5 },
    { y: horizon + height * 0.01, amp: 170, top: "#9786b5", bottom: "#c8adc8", mist: 0.45 },
    { y: horizon + height * 0.06, amp: 150, top: "#76709f", bottom: "#a996bd", mist: 0.4 },
    { y: horizon + height * 0.11, amp: 120, top: "#5a5a86", bottom: "#86809f", mist: 0.3 },
  ];
  let mountains = "";
  layers.forEach((l, i) => {
    const { d } = ridge(r, { width, y: l.y, amp: l.amp, bottom: height, rough: 0.52 + i * 0.02 });
    mountains += `<linearGradient id="m${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${l.top}"/><stop offset="0.35" stop-color="${l.bottom}"/></linearGradient>`;
    mountains += `<path d="${d}" fill="url(#m${i})" filter="url(#soft)"/>`;
    mountains += `<rect x="-50" y="${f(l.y + 40)}" width="${width + 100}" height="${f(height * 0.05)}" fill="#fbeee8" opacity="${l.mist}" filter="url(#mist)"/>`;
  });
  const lakeY = height * 0.78;
  // The near hillside rises from the lake on the left to the right edge; pines stand along its crest.
  const crest = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = width * (0.38 + 0.66 * t);
    crest.push([x, lakeY + 44 - Math.pow(t, 1.4) * height * 0.2 + r.range(-14, 14) * t]);
  }
  const hill = `M${pt(-40, height)} L${pt(-40, height * 0.95)} C${pt(width * 0.12, height * 0.93)} ${pt(width * 0.26, lakeY + 90)} ${pt(width * 0.36, lakeY + 44)} ${crest.map(([x, y]) => `L${pt(x, y)}`).join(" ")} L${pt(width + 40, height)}Z`;
  let pines = "";
  crest.forEach(([cx, cy], i) => {
    if (i < 3) return;
    for (let k = 0; k < 2; k++) {
      const x = cx + r.range(-30, 30);
      const base = cy + r.range(10, 50);
      const h = r.range(110, 300) * (0.6 + (i / 24) * 0.6);
      let tiers = "";
      for (let t = 0; t < 6; t++) {
        const ty = base - (h * t) / 6;
        const tw = (h * 0.26 * (6 - t)) / 6;
        tiers += `<path d="M${pt(x - tw, ty)} Q${pt(x - tw * 0.3, ty - h * 0.12)} ${pt(x, ty - h * 0.3)} Q${pt(x + tw * 0.3, ty - h * 0.12)} ${pt(x + tw, ty)}Z"/>`;
      }
      pines += `<g fill="#231d30">${tiers}</g>`;
    }
  });
  let flowers = "";
  for (let i = 0; i < 140; i++) {
    const t = r.range(0.1, 1);
    const x = width * (0.38 + 0.66 * t);
    const top = lakeY + 40 - Math.pow(t, 1.4) * height * 0.2;
    flowers += `<circle cx="${f(x + r.range(-20, 20))}" cy="${f(top + r.range(80, height - top))}" r="${f(r.range(2.5, 7))}" fill="${r.pick(["#f1b84a", "#f6cf6a", "#e79a45", "#f3d9a6"])}" opacity="0.9"/>`;
  }
  const body = `<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d6fa6"/><stop offset="0.22" stop-color="#9c8cbd"/><stop offset="0.4" stop-color="#d9a3b8"/><stop offset="0.52" stop-color="#f5b48f"/><stop offset="0.6" stop-color="#fcd7a6"/></linearGradient>
<radialGradient id="glow" cx="${f(sunX / width)}" cy="${f((horizon - 40) / height)}" r="0.55"><stop offset="0" stop-color="#fff5d8" stop-opacity="0.95"/><stop offset="0.12" stop-color="#ffd8a0" stop-opacity="0.7"/><stop offset="0.45" stop-color="#f7a987" stop-opacity="0.18"/><stop offset="1" stop-color="#f7a987" stop-opacity="0"/></radialGradient>
<linearGradient id="lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9b9ae"/><stop offset="0.5" stop-color="#a88fb2"/><stop offset="1" stop-color="#6b6690"/></linearGradient>
<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1726" stop-opacity="0"/><stop offset="1" stop-color="#1b1726" stop-opacity="0.35"/></linearGradient>
<filter id="cloud" x="-30%" y="-80%" width="160%" height="260%"><feTurbulence type="fractalNoise" baseFrequency="0.008 0.03" numOctaves="4" seed="4" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="120" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="10"/></filter>
<filter id="mist" x="-10%" y="-200%" width="120%" height="500%"><feGaussianBlur stdDeviation="40"/></filter>
${paintFilter("soft", { scale: 22, freq: 0.02, blur: 1.2, seed: 9 })}
${grainFilter("grain", { amount: 0.05, freq: 0.8 })}
</defs>
<rect width="${width}" height="${height}" fill="url(#sky)"/>
<g filter="url(#cloud)">${clouds}</g>
<rect width="${width}" height="${height}" fill="url(#glow)"/>
<circle cx="${f(sunX)}" cy="${f(horizon - 40)}" r="${f(width * 0.035)}" fill="#fff6dc"/>
${mountains}
<rect x="0" y="${f(lakeY)}" width="${width}" height="${f(height - lakeY)}" fill="url(#lake)"/>
<rect x="${f(sunX - 24)}" y="${f(lakeY)}" width="48" height="${f(height * 0.09)}" fill="#fff0cf" opacity="0.55" filter="url(#mist)"/>
<rect x="-50" y="${f(lakeY - 30)}" width="${width + 100}" height="80" fill="#fdf1ea" opacity="0.5" filter="url(#mist)"/>
<linearGradient id="hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3148"/><stop offset="1" stop-color="#1f1a29"/></linearGradient>
<path d="${hill}" fill="url(#hill)"/>
${pines}${flowers}
<rect width="${width}" height="${height}" fill="url(#shade)"/>
<rect width="${width}" height="${height}" filter="url(#grain)"/>`;
  return svg(width, height, body, { title: "Immersive Artistic Hero", desc: "Sunrise over layered mountains, mist and a still lake." });
}

/** 2 · Minimal Editorial Paper — warm off-white paper, deckled edge, faint script and sage botanicals. */
export function editorialPaper({ width = W, height = H, seed = 21 } = {}) {
  const r = rng(seed);
  let script = "";
  for (let i = 0; i < 6; i++) script += scriptLine(r, width * 0.06, height * 0.08 + i * 58, width * r.range(0.22, 0.34), { size: 26, opacity: 0.32, color: "#6f5f4c", weight: 2.2 });
  const edge = tornLine(r, -10, height + 10, 0, { step: 22, jag: 14 }).map(([y, x]) => [width * 0.03 + x, y]);
  const deckle = `M-10,-10 ${edge.map(([x, y]) => `L${pt(x, y)}`).join(" ")} L-10,${height + 10}Z`;
  let stains = "";
  for (let i = 0; i < 9; i++) stains += `<ellipse cx="${f(r.pick([0, width]) + r.range(-200, 200))}" cy="${f(r.range(0, height))}" rx="${f(r.range(180, 420))}" ry="${f(r.range(120, 300))}" fill="#dcc7a5" opacity="${f(r.range(0.12, 0.28))}"/>`;
  const topRight = branch(r, [[width + 40, height * 0.02], [width * 0.9, height * 0.08], [width * 0.82, height * 0.17], [width * 0.78, height * 0.27]], { leafLen: 150, leafW: 52, leaves: 14, flowers: 0, buds: 0, stemW: 4 });
  const bottomLeft = branch(r, [[-30, height * 0.98], [width * 0.07, height * 0.9], [width * 0.18, height * 0.84], [width * 0.26, height * 0.8]], { leafLen: 170, leafW: 60, leaves: 11, flowers: 0, buds: 0, stemW: 4 });
  const flourish = `<path d="${smooth([[width * 0.55, height * 0.93], [width * 0.7, height * 0.9], [width * 0.84, height * 0.86], [width * 0.93, height * 0.83]])}" fill="none" stroke="#3c332a" stroke-width="3" stroke-linecap="round" opacity="0.55"/><path d="${smooth([[width * 0.6, height * 0.945], [width * 0.76, height * 0.915], [width * 0.9, height * 0.875]])}" fill="none" stroke="#3c332a" stroke-width="2" stroke-linecap="round" opacity="0.4"/>`;
  const body = `<defs>
<radialGradient id="paper" cx="0.55" cy="0.45" r="0.8"><stop offset="0" stop-color="#faf5ec"/><stop offset="0.7" stop-color="#f3eadc"/><stop offset="1" stop-color="#e9dcc7"/></radialGradient>
<filter id="stain" x="-50%" y="-50%" width="200%" height="200%"><feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" seed="5" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="160"/><feGaussianBlur stdDeviation="30"/></filter>
<filter id="fibre"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.3" numOctaves="2" seed="2" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="10"/></filter>
${grainFilter("grain", { amount: 0.07, freq: 0.75 })}
</defs>
<rect width="${width}" height="${height}" fill="url(#paper)"/>
<g filter="url(#stain)">${stains}</g>
<path d="${deckle}" fill="#e6d8c1" filter="url(#fibre)"/>
${script}
<g opacity="0.95">${topRight}</g><g opacity="0.95">${bottomLeft}</g>
${flourish}
<rect width="${width}" height="${height}" filter="url(#grain)"/>`;
  return svg(width, height, body, { title: "Minimal Editorial Paper", desc: "Warm paper with a deckled edge, faint script and sage leaves." });
}

/** 3 · Cinematic Dark — a dark room with warm window light falling across the wall. */
export function cinematicDark({ width = W, height = H, seed = 31 } = {}) {
  const r = rng(seed);
  const win = [[width * 0.46, height * 0.12], [width * 0.98, height * 0.2], [width * 0.98, height * 0.66], [width * 0.52, height * 0.6]];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  let bars = "";
  for (const t of [0.34, 0.67]) {
    const a = lerp(win[0], win[1], t), b = lerp(win[3], win[2], t);
    bars += `<path d="M${pt(a[0] - 16, a[1])} L${pt(a[0] + 16, a[1])} L${pt(b[0] + 16, b[1])} L${pt(b[0] - 16, b[1])}Z"/>`;
  }
  for (const t of [0.5]) {
    const a = lerp(win[0], win[3], t), b = lerp(win[1], win[2], t);
    bars += `<path d="M${pt(a[0], a[1] - 14)} L${pt(b[0], b[1] - 14)} L${pt(b[0], b[1] + 14)} L${pt(a[0], a[1] + 14)}Z"/>`;
  }
  let plant = "";
  const stems = [[width * 0.2, height * 0.62], [width * 0.24, height * 0.6], [width * 0.18, height * 0.61]];
  for (let i = 0; i < 26; i++) {
    const [sx, sy] = r.pick(stems);
    const len = r.range(90, 190);
    plant += leaf(sx + r.range(-40, 40), sy - r.range(20, 420), len, len * 0.34, r.range(-160, -20), { fill: "#0c0a09" });
  }
  const body = `<defs>
<radialGradient id="room" cx="0.7" cy="0.4" r="0.9"><stop offset="0" stop-color="#2a1c13"/><stop offset="0.45" stop-color="#140f0c"/><stop offset="1" stop-color="#070606"/></radialGradient>
<linearGradient id="light" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd08a"/><stop offset="0.5" stop-color="#f0a14f"/><stop offset="1" stop-color="#b8662a"/></linearGradient>
<linearGradient id="shaft" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffb867" stop-opacity="0"/><stop offset="0.6" stop-color="#ffb867" stop-opacity="0.14"/><stop offset="1" stop-color="#ffb867" stop-opacity="0.05"/></linearGradient>
<radialGradient id="vignette" cx="0.55" cy="0.45" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.7"/></radialGradient>
<filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="haze" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="60"/></filter>
${grainFilter("grain", { amount: 0.06, freq: 0.9 })}
</defs>
<rect width="${width}" height="${height}" fill="url(#room)"/>
<path d="M${win.map(([x, y]) => pt(x, y)).join(" L")}Z" fill="url(#light)" opacity="0.92" filter="url(#soft)"/>
<g fill="#1a110b" opacity="0.85" filter="url(#soft)">${bars}</g>
<path d="M${pt(0, height * 0.05)} L${pt(win[0][0], win[0][1])} L${pt(win[3][0], win[3][1])} L${pt(0, height * 0.8)}Z" fill="url(#shaft)" filter="url(#haze)"/>
<rect x="0" y="${f(height * 0.05)}" width="${f(width * 0.34)}" height="${f(height * 0.6)}" fill="#0a0808"/>
<rect x="${f(width * 0.04)}" y="${f(height * 0.09)}" width="${f(width * 0.26)}" height="${f(height * 0.52)}" fill="#3a2718" opacity="0.55"/>
<g fill="#0a0808"><rect x="${f(width * 0.165)}" y="${f(height * 0.09)}" width="20" height="${f(height * 0.52)}"/><rect x="${f(width * 0.04)}" y="${f(height * 0.34)}" width="${f(width * 0.26)}" height="18"/></g>
<g>${plant}</g>
<path d="M${pt(width * 0.14, height * 0.62)} h${f(width * 0.14)} l-18,110 h${f(-width * 0.14 + 36)}Z" fill="#100c0a"/>
<rect x="0" y="${f(height * 0.66)}" width="${f(width * 0.62)}" height="24" fill="#1c140e"/>
<rect x="0" y="${f(height * 0.66)}" width="${f(width * 0.62)}" height="3" fill="#c7823e" opacity="0.55"/>
<g fill="#0d0a08"><rect x="${f(width * 0.08)}" y="${f(height * 0.67)}" width="26" height="${f(height * 0.33)}"/><rect x="${f(width * 0.52)}" y="${f(height * 0.67)}" width="26" height="${f(height * 0.33)}"/>
<path d="M${pt(width * 0.62, height * 0.64)} h${f(width * 0.2)} v${f(height * 0.1)} h-24 v${f(height * 0.26)} h-24 v${f(-height * 0.22)} h${f(-width * 0.2 + 96)} v${f(height * 0.22)} h-24 v${f(-height * 0.26)} h-24Z"/>
<path d="M${pt(width * 0.8, height * 0.64)} v${f(-height * 0.2)} h-22 v${f(height * 0.2)}Z"/></g>
<path d="M${pt(width * 0.62, height * 0.64)} h${f(width * 0.2)}" stroke="#d98f45" stroke-width="3" opacity="0.6"/>
<rect x="0" y="${f(height * 0.86)}" width="${width}" height="${f(height * 0.14)}" fill="#050404" opacity="0.6"/>
<rect width="${width}" height="${height}" fill="url(#vignette)"/>
<rect width="${width}" height="${height}" filter="url(#grain)"/>`;
  return svg(width, height, body, { title: "Cinematic Dark", desc: "A dark room with warm window light, a plant and a chair." });
}

/** A small framed landscape (reused by the collage). */
function miniLandscape(r, w, h, id) {
  const { d: d1 } = ridge(r, { width: w, y: h * 0.55, amp: h * 0.12, bottom: h, steps: 6 });
  const { d: d2 } = ridge(r, { width: w, y: h * 0.72, amp: h * 0.1, bottom: h, steps: 6 });
  return `<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f5f8f"/><stop offset="0.55" stop-color="#9fb6d3"/><stop offset="0.7" stop-color="#f3d2b0"/></linearGradient><clipPath id="${id}c"><rect width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#${id}c)"><rect width="${w}" height="${h}" fill="url(#${id}s)"/><g filter="url(#photoCloud)"><ellipse cx="${f(w * 0.3)}" cy="${f(h * 0.25)}" rx="${f(w * 0.3)}" ry="${f(h * 0.07)}" fill="#fff" opacity="0.7"/><ellipse cx="${f(w * 0.72)}" cy="${f(h * 0.36)}" rx="${f(w * 0.25)}" ry="${f(h * 0.06)}" fill="#fde8d6" opacity="0.75"/></g><path d="${d1}" fill="#46597e"/><path d="${d2}" fill="#2c3a55"/></g>`;
}

export function tapePiece(r, x, y, w, h, rot, fill = "#e9dfc6", opacity = 0.78) {
  const left = tornLine(r, 0, h, 0, { step: 7, jag: 5 }).map(([yy, xx]) => [xx, yy]);
  const right = tornLine(r, 0, h, 0, { step: 7, jag: 5 }).map(([yy, xx]) => [w + xx, yy]).reverse();
  const d = `M${[...left, ...right].map(([a, b]) => pt(a, b)).join(" L")}Z`;
  return `<g transform="translate(${pt(x, y)}) rotate(${f(rot)}) translate(${f(-w / 2)},${f(-h / 2)})" opacity="${opacity}"><path d="${d}" fill="${fill}"/><path d="${d}" fill="url(#tapeSheen)" opacity="0.5"/></g>`;
}

/** 4 · Creative Collage — paper board, taped photo frames, a lined note and botanical sprigs. */
export function creativeCollage({ width = W, height = H, seed = 41 } = {}) {
  const r = rng(seed);
  const photo = (x, y, w, h, rot, id) => `<g transform="translate(${pt(x, y)}) rotate(${f(rot)})"><rect x="${f(-w / 2 - 22)}" y="${f(-h / 2 - 22)}" width="${f(w + 44)}" height="${f(h + 70)}" fill="#fbf8f2" filter="url(#drop)"/><g transform="translate(${f(-w / 2)},${f(-h / 2)})">${miniLandscape(r, w, h, id)}</g></g>`;
  const torn = (x, y, w, h, rot, fill) => {
    const top = tornLine(r, 0, w, 0, { step: 16, jag: 10 });
    const bottom = tornLine(r, 0, w, h, { step: 16, jag: 10 }).reverse();
    return `<g transform="translate(${pt(x, y)}) rotate(${f(rot)})"><path d="M${[...top, ...bottom].map(([a, b]) => pt(a, b)).join(" L")}Z" fill="${fill}" filter="url(#drop)"/></g>`;
  };
  let lines = "";
  for (let i = 0; i < 7; i++) lines += `<line x1="30" x2="${f(width * 0.34 - 30)}" y1="${f(90 + i * 62)}" y2="${f(90 + i * 62)}" stroke="#b9c8d8" stroke-width="2"/>`;
  let words = "";
  for (let i = 0; i < 5; i++) words += scriptLine(r, 50, 140 + i * 62, width * 0.26 * r.range(0.6, 1), { size: 30, color: "#2f3a4d", opacity: 0.8, weight: 3 });
  const note = `<g transform="translate(${pt(width * 0.1, height * 0.42)}) rotate(-7)"><rect width="${f(width * 0.34)}" height="${f(560)}" fill="#fdfbf6" filter="url(#drop)"/>${lines}${words}</g>`;
  const sprigTL = branch(r, [[-40, height * 0.3], [width * 0.05, height * 0.2], [width * 0.1, height * 0.12], [width * 0.16, height * 0.04]], { leafLen: 110, leafW: 36, leaves: 12, flowers: 4, buds: 3, flowerR: 36 });
  const sprigBR = branch(r, [[width + 30, height * 0.98], [width * 0.9, height * 0.9], [width * 0.84, height * 0.84]], { leafLen: 100, leafW: 34, leaves: 9, flowers: 3, buds: 2, flowerR: 32 });
  const body = `<defs>
<linearGradient id="board" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1e9dc"/><stop offset="1" stop-color="#e6dac7"/></linearGradient>
<linearGradient id="tapeSheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.6"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.3"/></linearGradient>
<filter id="drop" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="6" dy="14" stdDeviation="14" flood-color="#5a4630" flood-opacity="0.22"/></filter>
<filter id="photoCloud" x="-30%" y="-100%" width="160%" height="300%"><feTurbulence type="fractalNoise" baseFrequency="0.02 0.06" numOctaves="3" seed="4" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="40"/><feGaussianBlur stdDeviation="6"/></filter>
${grainFilter("grain", { amount: 0.08, freq: 0.7 })}
</defs>
<rect width="${width}" height="${height}" fill="url(#board)"/>
${torn(width * 0.55, -40, width * 0.55, 380, 4, "#c9a57e")}
${torn(width * 0.02, height * 0.7, width * 0.5, 300, -3, "#efe4d2")}
${torn(width * 0.5, height * 0.8, width * 0.55, 260, 6, "#d6b893")}
${photo(width * 0.66, height * 0.28, width * 0.42, height * 0.2, 7, "p1")}
${photo(width * 0.7, height * 0.58, width * 0.34, height * 0.16, -4, "p2")}
${note}
${tapePiece(r, width * 0.52, height * 0.16, 220, 70, 30)}${tapePiece(r, width * 0.86, height * 0.4, 200, 64, -35, "#dccfb3")}${tapePiece(r, width * 0.6, height * 0.51, 180, 60, -20)}${tapePiece(r, width * 0.25, height * 0.42, 200, 64, 12, "#e2d6bc")}
<g opacity="0.95">${sprigTL}</g><g opacity="0.95">${sprigBR}</g>
<rect width="${width}" height="${height}" filter="url(#grain)"/>`;
  return svg(width, height, body, { title: "Creative Collage", desc: "Paper board with taped photos, a handwritten note and blossoms." });
}

/** 5 · Soft Gradient & Minimal — airy pastels, translucent organic shapes, a fine arc and a botanical accent. */
export function softGradient({ width = W, height = H, seed = 51 } = {}) {
  const r = rng(seed);
  const blob = (cx, cy, rad, _n, jitter) => {
    const pts = [];
    // A few low-frequency lobes, sampled finely, so the outline is organic and never faceted.
    const lobes = Array.from({ length: 3 }, () => [r.range(1, 3.99) | 0, r.range(0, Math.PI * 2), r.range(0, jitter)]);
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const rr = rad * (1 + lobes.reduce((acc, [k, ph, amp]) => acc + Math.sin(a * (k + 1) + ph) * amp, 0));
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return smooth(pts, true, 0.5);
  };
  const sprig = branch(r, [[width * 0.98, height * 0.99], [width * 0.9, height * 0.86], [width * 0.86, height * 0.74], [width * 0.84, height * 0.66]], { leafLen: 180, leafW: 60, leaves: 12, flowers: 3, buds: 5, flowerR: 70, stemW: 6, petal: "#fbeee6", centre: "#e3b07a", leafFills: ["#9aab86", "#b3c09f", "#869a72"] });
  const body = `<defs>
<linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eeeafc"/><stop offset="0.5" stop-color="#f8f0f4"/><stop offset="1" stop-color="#fdf1ea"/></linearGradient>
<linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c7befa"/><stop offset="1" stop-color="#b8d0fb"/></linearGradient>
<linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbd1dc"/><stop offset="1" stop-color="#fbe1cf"/></linearGradient>
<linearGradient id="g3" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#d6d0fb"/><stop offset="1" stop-color="#fbd6d6"/></linearGradient>
<filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="120"/></filter>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
${grainFilter("grain", { amount: 0.035, freq: 0.9 })}
</defs>
<rect width="${width}" height="${height}" fill="url(#base)"/>
<g filter="url(#blur)"><circle cx="${f(width * 0.1)}" cy="${f(height * 0.5)}" r="${f(width * 0.4)}" fill="#c9c1fb" opacity="0.8"/><circle cx="${f(width * 0.95)}" cy="${f(height * 0.15)}" r="${f(width * 0.42)}" fill="#fbcfd6" opacity="0.8"/><circle cx="${f(width * 0.8)}" cy="${f(height * 0.7)}" r="${f(width * 0.35)}" fill="#c6d6fb" opacity="0.6"/><circle cx="${f(width * 0.4)}" cy="${f(height * 0.95)}" r="${f(width * 0.3)}" fill="#fcdcc6" opacity="0.6"/></g>
<path d="${blob(width * 0.2, height * 0.5, width * 0.28, 12, 0.1)}" fill="url(#g1)" opacity="0.55" filter="url(#soft)"/>
<path d="${blob(width * 0.85, height * 0.3, width * 0.36, 12, 0.1)}" fill="url(#g2)" opacity="0.6" filter="url(#soft)"/>
<path d="${blob(width * 0.72, height * 0.72, width * 0.3, 12, 0.12)}" fill="url(#g3)" opacity="0.5" filter="url(#soft)"/>
<path d="M${pt(-40, height * 0.42)} C${pt(width * 0.3, height * 0.1)} ${pt(width * 0.7, height * 0.18)} ${pt(width + 40, height * 0.5)}" fill="none" stroke="#fff" stroke-width="3" opacity="0.8"/>
<path d="M${pt(width * 0.1, height * 1.02)} C${pt(width * 0.2, height * 0.7)} ${pt(width * 0.5, height * 0.62)} ${pt(width * 0.75, height * 0.66)}" fill="none" stroke="#fff" stroke-width="2" opacity="0.7"/>
<g opacity="0.95">${sprig}</g>
<rect width="${width}" height="${height}" filter="url(#grain)"/>`;
  return svg(width, height, body, { title: "Soft Gradient & Minimal", desc: "Airy pastel gradient with translucent shapes and a botanical accent." });
}

/** Five colour swatches per template, read from the board. */
export const TEMPLATE_PALETTES = {
  immersiveHero: ["#f5a988", "#e8b6c3", "#c9bde3", "#7682a8", "#2d2c3f"],
  editorialPaper: ["#efe7da", "#dfcdb5", "#a3ae90", "#6f7d5d", "#8d7560"],
  cinematicDark: ["#14120f", "#2f4868", "#8a5a3c", "#e0a060", "#f3ebe0"],
  creativeCollage: ["#d9bb92", "#e8ddcb", "#8f9a7c", "#8ea3bb", "#2f3d52"],
  softGradient: ["#c6bdf8", "#f8c7cf", "#c3d4fb", "#fbd7c3", "#f1ece8"],
};
