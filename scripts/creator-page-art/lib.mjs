/**
 * Drawing helpers for the Creator Page background library (owner board, 30 Sep 2026). Everything is plain SVG built
 * from seeded randomness, so the art is organic but reproducible: run the generator again and the files are identical.
 */

/** A small seeded PRNG (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, range: (lo, hi) => lo + (hi - lo) * next(), pick: (arr) => arr[Math.floor(next() * arr.length)] };
}

export const f = (n) => (Math.round(n * 10) / 10).toString();
export const pt = (x, y) => `${f(x)},${f(y)}`;

/** A smooth closed/open path through points (Catmull-Rom → cubic Bézier). */
export function smooth(points, closed = false, tension = 0.5) {
  const p = points;
  const n = p.length;
  if (n < 2) return "";
  const get = (i) => (closed ? p[(i + n) % n] : p[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pt(p[0][0], p[0][1])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const c1 = [p1[0] + ((p2[0] - p0[0]) * tension) / 3, p1[1] + ((p2[1] - p0[1]) * tension) / 3];
    const c2 = [p2[0] - ((p3[0] - p1[0]) * tension) / 3, p2[1] - ((p3[1] - p1[1]) * tension) / 3];
    d += `C${pt(c1[0], c1[1])} ${pt(c2[0], c2[1])} ${pt(p2[0], p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

/** A mountain ridge line by midpoint displacement, closed down to the bottom edge. */
export function ridge(r, { width, y, amp, rough = 0.55, steps = 7, bottom }) {
  let pts = [
    [-40, y + r.range(-amp, amp) * 0.4],
    [width + 40, y + r.range(-amp, amp) * 0.4],
  ];
  let a = amp;
  for (let s = 0; s < steps; s++) {
    const next = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      next.push(pts[i], [(x1 + x2) / 2 + r.range(-a, a) * 0.15, (y1 + y2) / 2 + r.range(-a, a)]);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
    a *= rough;
  }
  const line = pts.map(([x, yy]) => `L${pt(x, yy)}`).join("");
  return { d: `M${pt(-40, bottom)}${line}L${pt(width + 40, bottom)}Z`, pts };
}

/** One leaf: a pointed ellipse with a curved tip, rotated about its base. */
export function leaf(x, y, len, w, angleDeg, { fill, vein, opacity = 1, curl = 0.18 } = {}) {
  const tipX = len, bend = len * curl;
  const d = `M0,0 C${f(len * 0.25)},${f(-w)} ${f(len * 0.7)},${f(-w * 0.9 + bend)} ${f(tipX)},${f(bend)} C${f(len * 0.7)},${f(w * 0.8 + bend)} ${f(len * 0.25)},${f(w)} 0,0Z`;
  const v = vein ? `<path d="M${f(len * 0.04)},0 Q${f(len * 0.55)},${f(bend * 0.6)} ${f(len * 0.92)},${f(bend * 0.95)}" fill="none" stroke="${vein}" stroke-width="${f(Math.max(1, w * 0.07))}" stroke-linecap="round" opacity="0.55"/>` : "";
  return `<g transform="translate(${pt(x, y)}) rotate(${f(angleDeg)})" opacity="${opacity}"><path d="${d}" fill="${fill}"/>${v}</g>`;
}

/** A five-petal blossom with a warm centre. */
export function blossom(x, y, r, { petal = "#fbf7f1", edge = "#e9d9cf", centre = "#d9a441", rot = 0, petals = 5 } = {}) {
  let out = `<g transform="translate(${pt(x, y)}) rotate(${f(rot)})">`;
  for (let i = 0; i < petals; i++) {
    const a = (360 / petals) * i;
    out += `<ellipse cx="0" cy="${f(-r * 0.55)}" rx="${f(r * 0.42)}" ry="${f(r * 0.58)}" fill="${petal}" stroke="${edge}" stroke-width="${f(r * 0.04)}" transform="rotate(${f(a)})"/>`;
  }
  out += `<circle r="${f(r * 0.2)}" fill="${centre}"/>`;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    out += `<circle cx="${f(Math.cos(a) * r * 0.26)}" cy="${f(Math.sin(a) * r * 0.26)}" r="${f(r * 0.045)}" fill="#a8742a"/>`;
  }
  return `${out}</g>`;
}

/** A closed bud on a short stalk. */
export function bud(x, y, r, angleDeg, { fill = "#f4e7da", tip = "#e7c9b4", stalk = "#7c8c63" } = {}) {
  return `<g transform="translate(${pt(x, y)}) rotate(${f(angleDeg)})"><path d="M0,0 L${f(r * 1.6)},0" stroke="${stalk}" stroke-width="${f(r * 0.18)}" stroke-linecap="round"/><ellipse cx="${f(r * 2.2)}" cy="0" rx="${f(r * 0.75)}" ry="${f(r * 0.5)}" fill="${fill}"/><path d="M${f(r * 1.55)},0 q${f(r * 0.4)},${f(-r * 0.55)} ${f(r * 0.9)},${f(-r * 0.2)} M${f(r * 1.55)},0 q${f(r * 0.4)},${f(r * 0.55)} ${f(r * 0.9)},${f(r * 0.2)}" fill="none" stroke="${tip}" stroke-width="${f(r * 0.12)}" stroke-linecap="round"/></g>`;
}

/**
 * A botanical branch: a curved stem with alternating leaves, blossoms and buds along it.
 * `path` is a list of stem points; leaves sprout on both sides.
 */
export function branch(r, path, { leafLen = 90, leafW = 30, leaves = 12, flowers = 3, buds = 3, stemColor = "#6f7f58", leafFills = ["#7f9168", "#94a57c", "#6d7f57", "#a7b58f"], vein = "#4f5e3c", flowerR = 34, stemW = 5, petal, centre } = {}) {
  const stem = smooth(path);
  let out = `<path d="${stem}" fill="none" stroke="${stemColor}" stroke-width="${stemW}" stroke-linecap="round"/>`;
  const along = (t) => {
    const idx = t * (path.length - 1);
    const i = Math.min(path.length - 2, Math.floor(idx));
    const u = idx - i;
    const [x1, y1] = path[i], [x2, y2] = path[i + 1];
    return { x: x1 + (x2 - x1) * u, y: y1 + (y2 - y1) * u, a: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI };
  };
  for (let i = 0; i < leaves; i++) {
    const t = 0.08 + (0.86 * i) / Math.max(1, leaves - 1);
    const { x, y, a } = along(t);
    const side = i % 2 ? 1 : -1;
    const scale = 0.65 + 0.35 * Math.sin(Math.PI * t) + r.range(-0.08, 0.08);
    out += leaf(x, y, leafLen * scale, leafW * scale, a + side * r.range(38, 62), { fill: r.pick(leafFills), vein });
  }
  for (let i = 0; i < buds; i++) {
    const { x, y, a } = along(r.range(0.55, 1));
    out += bud(x, y, flowerR * 0.35, a + r.range(-50, 50), { stalk: stemColor });
  }
  for (let i = 0; i < flowers; i++) {
    const { x, y } = along(flowers === 1 ? 0.98 : 0.3 + (0.68 * i) / Math.max(1, flowers - 1));
    out += blossom(x + r.range(-10, 10), y + r.range(-10, 10), flowerR * r.range(0.85, 1.1), { rot: r.range(0, 72), petal, centre });
  }
  return out;
}

/** A torn/deckled edge polyline from (x1,y) to (x2,y), jittered vertically. */
export function tornLine(r, x1, x2, y, { step = 14, jag = 6 } = {}) {
  const pts = [];
  for (let x = x1; x <= x2; x += step * r.range(0.6, 1.4)) pts.push([x, y + r.range(-jag, jag)]);
  pts.push([x2, y + r.range(-jag, jag)]);
  return pts;
}

/** Pseudo-handwriting: a line of looping strokes that reads as script without being words. */
export function scriptLine(r, x, y, width, { size = 22, color = "#7a6a58", opacity = 0.4, weight = 2 } = {}) {
  let d = `M${pt(x, y)}`;
  let cx = x;
  while (cx < x + width) {
    const wordLen = r.range(size * 1.5, size * 5);
    const end = Math.min(x + width, cx + wordLen);
    while (cx < end) {
      const h = r.range(0.35, 1) * size;
      const w = r.range(0.35, 0.8) * size;
      d += ` c${f(w * 0.2)},${f(-h)} ${f(w * 0.8)},${f(-h)} ${f(w * 0.5)},0 s${f(w * 0.2)},${f(h * 0.25)} ${f(w * 0.5)},${f(r.range(-2, 2))}`;
      cx += w;
    }
    cx += r.range(size * 0.6, size * 1.1);
    d += ` M${pt(cx, y + r.range(-2, 2))}`;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
}

/** Paper grain: fractal noise tinted to a warm grey, as a filter to apply over any rect. */
export function grainFilter(id, { freq = 0.9, amount = 0.08, octaves = 3, seed = 7 } = {}) {
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" stitchTiles="stitch" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 ${f(amount * 12)} -${f(amount * 5)}"/></filter>`;
}

/** Painterly edges: displace a shape by low-frequency noise, then soften. */
export function paintFilter(id, { scale = 40, freq = 0.012, blur = 2, seed = 3 } = {}) {
  return `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="4" seed="${seed}" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="${blur}"/></filter>`;
}

const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function svg(w, h, body, { title, desc } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">${title ? `<title>${esc(title)}</title>` : ""}${desc ? `<desc>${esc(desc)}</desc>` : ""}${body}</svg>\n`;
}
