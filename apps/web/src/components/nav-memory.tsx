"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * The per-tab trail behind every Back (docs/ui-redesign/back-navigation.md): the pages this tab visited, newest last, as
 * path + query with the page's title, in sessionStorage. Back is a return, not a parent link: it goes to the most recent
 * page with a different path, then to an explicit `?from=`, then to the page's home. Pages that only forward never enter
 * the trail; deleting or leaving something drops its pages.
 */
const KEY = "wc.nav.trail";
const EVENT = "wc-nav";
const MAX = 20;

export interface TrailEntry {
  /** Path + query, as visited. */
  p: string;
  /** The page's own title (without the app's name), when it had one. */
  t?: string;
}

function read(): TrailEntry[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((e): e is TrailEntry => !!e && typeof (e as TrailEntry).p === "string") : [];
  } catch {
    return [];
  }
}
function write(list: TrailEntry[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* private mode: Back falls back to `from`, then home */
  }
}
const pathOf = (p: string) => p.split(/[?#]/)[0]!;
// A name only, never markup: the title is shown as Back's label ("Back to <title>").
const pageTitle = () => document.title.replace(/[<>]/g, "").replace(/\s*·\s*Wonder Creator$/, "").trim() || undefined;

/** Drop every page under `prefix` from the trail (a Creation or Material deleted, a Huddle left). */
export function forget(prefix: string) {
  write(read().filter((e) => { const path = pathOf(e.p); return path !== prefix && !path.startsWith(`${prefix}/`); }));
}

/** The trail's raw value, for useSyncExternalStore (a stable string between changes). */
export function trailSnapshot(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
export function subscribeTrail(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Where `?from=` points, for links opened in a new tab or shared (rule 2). Unknown values point nowhere. */
export function fromTarget(from: string | null): string | null {
  const m = /^(room|creation|studio|material|collection):([0-9a-f-]{36})$/i.exec(from ?? "");
  if (!m) return null;
  const id = m[2]!;
  return { room: `/rooms/${id}`, creation: `/creations/${id}`, studio: `/creations/${id}/studio`, material: `/materials/${id}`, collection: `/materials/collections/${id}` }[m[1]!.toLowerCase() as "room"]!;
}

/** Rule 1: the most recent page in this tab whose path differs from `here`'s. */
export function trailTarget(raw: string, here: string): TrailEntry | null {
  let list: TrailEntry[];
  try {
    list = JSON.parse(raw) as TrailEntry[];
  } catch {
    return null;
  }
  const herePath = pathOf(here);
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (e && typeof e.p === "string" && pathOf(e.p) !== herePath) return e;
  }
  return null;
}

/** Going Back is a pop: everything after the target leaves the trail, so a second Back keeps going back. */
export function popTo(target: string) {
  const list = read();
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]!.p === target) return write(list.slice(0, i + 1));
  }
}

/** Kept for the Carousel's Studio: the most recent page outside `prefix` (everything of one Creation), or null. */
export function lastPageOutside(prefix: string): string | null {
  const list = read();
  for (let i = list.length - 1; i >= 0; i--) {
    const path = pathOf(list[i]!.p);
    if (path !== prefix && !path.startsWith(`${prefix}/`)) return list[i]!.p;
  }
  return null;
}

// A page left within moments of arriving, with no tap or key in between, was a forward, not a stop: ForwardTo (the
// Studio address → the Writing page), a replace after load, or a redirect from a streamed page — which reloads the
// document, so the arrival is kept in sessionStorage and a new document trusts it only when it was referred by that
// page. A typed address has no referrer: it is always a stop. The next page takes the forward's place in the trail.
const ARRIVED = "wc.nav.arrived";
const FORWARD_MS = 1500;
let seenThisDocument = false;
let listening = false;
type Arrival = { path: string; at: number; acted?: boolean };
function readArrival(): Arrival | null {
  try {
    return JSON.parse(sessionStorage.getItem(ARRIVED) ?? "null") as Arrival | null;
  } catch {
    return null;
  }
}
function watchInput() {
  if (listening) return;
  listening = true;
  const mark = () => {
    const a = readArrival();
    if (a && !a.acted) {
      try {
        sessionStorage.setItem(ARRIVED, JSON.stringify({ ...a, acted: true }));
      } catch {
        /* nothing to keep */
      }
    }
  };
  window.addEventListener("pointerdown", mark, true);
  window.addEventListener("keydown", mark, true);
}
function wasForwardedFrom(pathname: string): string | null {
  const a = readArrival();
  if (!a || a.acted || a.path === pathname || Date.now() - a.at > FORWARD_MS) return null;
  if (seenThisDocument) return a.path;
  try {
    return document.referrer && new URL(document.referrer).origin === window.location.origin && new URL(document.referrer).pathname === a.path ? a.path : null;
  } catch {
    return null;
  }
}

/** Records each page this tab visits (mounted once in the app shell). */
export function NavMemory() {
  // The path drives it; the query is read as it is at that moment. (No useSearchParams: it would need a Suspense
  // boundary around the whole app shell, which splits every page's streaming.)
  const pathname = usePathname();
  useEffect(() => {
    watchInput();
    const here = `${pathname}${window.location.search}`;
    const forwarder = wasForwardedFrom(pathname);
    if (forwarder) {
      const before = read();
      if (before.length && pathOf(before[before.length - 1]!.p) === forwarder) write(before.slice(0, -1));
    }
    seenThisDocument = true;
    try {
      sessionStorage.setItem(ARRIVED, JSON.stringify({ path: pathname, at: Date.now() }));
    } catch {
      /* private mode */
    }
    // Coming back to a page already in the trail is a return to it: the pages after it leave (a stack), so Done on the
    // Slide editor, then Back on the Studio, goes where the Studio was opened from — not back into the Slide editor.
    const list = read();
    const at = list.map((e) => pathOf(e.p)).lastIndexOf(pathOf(here));
    write([...(at >= 0 ? list.slice(0, at) : list), { p: here, t: pageTitle() }]);
    // The title can arrive just after the path (streamed metadata): keep this page's entry in step with it.
    const head = document.head;
    const obs = new MutationObserver(() => {
      const t = pageTitle();
      const list = read();
      const last = list[list.length - 1];
      if (last && last.p === here && last.t !== t) write([...list.slice(0, -1), { p: here, t }]);
    });
    obs.observe(head, { subtree: true, childList: true, characterData: true });
    return () => obs.disconnect();
  }, [pathname]);
  return null;
}
