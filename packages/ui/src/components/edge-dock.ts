"use client";
import * as React from "react";

/**
 * Edge-docked floating controls (owner's request): the Creative Palette trigger and the CreativeRadio tab can be dragged
 * anywhere and left there; on release they settle against the nearest left or right edge at the height they were
 * dropped, and keep >=72px from each other. The spot is remembered on this device. Shift + arrow keys move them too, so
 * nothing depends on a precise drag.
 */

export type DockSide = "left" | "right";
export interface DockPos {
  side: DockSide;
  /** Centre, in CSS px from the top of the viewport. */
  y: number;
}
interface Placed extends DockPos {
  h: number;
}

/** Space kept between two docked controls on the same edge (mini-player.md §15). */
export const DOCK_GAP = 72;
const MOVE_THRESHOLD = 8;
const KEY_STEP = 48;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

/**
 * Where a dropped control settles: the nearer edge, its centre kept within bounds, and clear of other docked controls
 * on that edge (moved to the closer free spot above or below; to the other edge when there's no room).
 */
export function settleDock(drop: { x: number; y: number }, o: { vw: number; min: number; max: number; h: number; gap?: number; others?: Placed[] }): DockPos {
  const gap = o.gap ?? DOCK_GAP;
  const trySide = (side: DockSide): DockPos | null => {
    let y = clamp(drop.y, o.min, o.max);
    const others = (o.others ?? []).filter((x) => x.side === side);
    for (let pass = 0; pass < 3; pass++) {
      const hit = others.find((x) => Math.abs(y - x.y) < (o.h + x.h) / 2 + gap);
      if (!hit) return { side, y };
      const need = (o.h + hit.h) / 2 + gap;
      const options = [hit.y - need, hit.y + need].filter((c) => c >= o.min && c <= o.max).sort((a, b) => Math.abs(a - y) - Math.abs(b - y));
      if (!options.length) return null;
      y = options[0]!;
    }
    return others.some((x) => Math.abs(y - x.y) < (o.h + x.h) / 2 + gap) ? null : { side, y };
  };
  const near: DockSide = drop.x < o.vw / 2 ? "left" : "right";
  return trySide(near) ?? trySide(near === "left" ? "right" : "left") ?? { side: near, y: clamp(drop.y, o.min, o.max) };
}

// Where each docked control currently sits, so a drop can keep clear of the others.
const placed = new Map<string, Placed>();

interface Stored {
  side: DockSide;
  /** Centre as a fraction of the viewport height, so it survives rotation and resizing. */
  f: number;
}

// Saved spots: read once from this device, then kept in memory (a stable snapshot for useSyncExternalStore).
const saved = new Map<string, Stored | null>();
const savedListeners = new Set<() => void>();

function read(key: string): Stored | null {
  if (saved.has(key)) return saved.get(key)!;
  let v: Stored | null = null;
  try {
    const s = JSON.parse(localStorage.getItem(key) ?? "null") as Stored | null;
    v = s && (s.side === "left" || s.side === "right") && typeof s.f === "number" && s.f >= 0 && s.f <= 1 ? s : null;
  } catch {
    v = null;
  }
  saved.set(key, v);
  return v;
}

function write(key: string, s: Stored) {
  saved.set(key, s);
  savedListeners.forEach((l) => l());
  try {
    localStorage.setItem(key, JSON.stringify(s));
  } catch {
    // Private mode or blocked storage: the spot lasts for this visit only.
  }
}

const subscribeSaved = (l: () => void) => {
  savedListeners.add(l);
  return () => savedListeners.delete(l);
};
const subscribeResize = (l: () => void) => {
  window.addEventListener("resize", l);
  return () => window.removeEventListener("resize", l);
};

export interface EdgeDock {
  /** Settled position; null until mounted (render the default CSS position until then). */
  pos: DockPos | null;
  /** True once the creator has moved it (or it isn't at its default). */
  moved: boolean;
  /** Live centre while being dragged. */
  drag: { x: number; y: number } | null;
  /** Spread onto the draggable element. */
  handlers: {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  };
  /** Call first in the element's click handler: true when the click ended a drag and should be ignored. */
  consumeClick: () => boolean;
}

export function useEdgeDock(
  key: string,
  o: {
    /** The control's height (px), for bounds and spacing. */
    height: number;
    defaultSide?: DockSide;
    /** Default centre for a viewport height. */
    defaultY: (vh: number) => number;
    /** Allowed range for the centre. */
    bounds: (vh: number) => { min: number; max: number };
  },
): EdgeDock {
  // Server render and first paint: nothing known yet, so the element keeps its default CSS position.
  const stored = React.useSyncExternalStore(subscribeSaved, () => read(key), () => null);
  const vh = React.useSyncExternalStore(subscribeResize, () => window.innerHeight, () => null);
  const [drag, setDrag] = React.useState<{ x: number; y: number } | null>(null);
  const start = React.useRef<{ px: number; py: number; cx: number; cy: number; moved: boolean; id: number } | null>(null);
  const suppress = React.useRef(false);

  const side = stored?.side ?? o.defaultSide ?? "right";
  const pos: DockPos | null = vh === null ? null : (() => {
    const b = o.bounds(vh);
    return { side, y: clamp(stored ? stored.f * vh : o.defaultY(vh), b.min, b.max) };
  })();

  React.useEffect(() => {
    if (!pos) return;
    placed.set(key, { ...pos, h: o.height });
    return () => {
      placed.delete(key);
    };
  }, [key, pos?.side, pos?.y, o.height]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (drop: { x: number; y: number }) => {
    const h = window.innerHeight;
    const b = o.bounds(h);
    const others = [...placed.entries()].filter(([k]) => k !== key).map(([, v]) => v);
    const next = settleDock(drop, { vw: window.innerWidth, min: b.min, max: b.max, h: o.height, others });
    write(key, { side: next.side, f: next.y / h });
  };

  const handlers: EdgeDock["handlers"] = {
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      suppress.current = false;
      const r = e.currentTarget.getBoundingClientRect();
      start.current = { px: e.clientX, py: e.clientY, cx: r.left + r.width / 2, cy: r.top + r.height / 2, moved: false, id: e.pointerId };
      // Follow the pointer even once it leaves the small control (a quick flick does on its first move).
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Not capturable (synthetic event): moves over the control still work.
      }
    },
    onPointerMove: (e) => {
      const s = start.current;
      if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.px;
      const dy = e.clientY - s.py;
      if (!s.moved) {
        if (Math.hypot(dx, dy) < MOVE_THRESHOLD) return;
        s.moved = true;
      }
      setDrag({ x: s.cx + dx, y: s.cy + dy });
    },
    onPointerUp: (e) => {
      const s = start.current;
      start.current = null;
      if (!s?.moved || s.id !== e.pointerId) return;
      suppress.current = true;
      setDrag(null);
      commit({ x: s.cx + (e.clientX - s.px), y: s.cy + (e.clientY - s.py) });
    },
    onPointerCancel: () => {
      start.current = null;
      setDrag(null);
    },
    onKeyDown: (e) => {
      if (!e.shiftKey || !pos) return;
      const vw = window.innerWidth;
      const moves: Record<string, { x: number; y: number }> = {
        ArrowLeft: { x: 0, y: pos.y },
        ArrowRight: { x: vw, y: pos.y },
        ArrowUp: { x: pos.side === "left" ? 0 : vw, y: pos.y - KEY_STEP },
        ArrowDown: { x: pos.side === "left" ? 0 : vw, y: pos.y + KEY_STEP },
      };
      const m = moves[e.key];
      if (!m) return;
      e.preventDefault();
      commit(m);
    },
  };

  return {
    pos,
    moved: !!stored,
    drag,
    handlers,
    consumeClick: () => {
      const was = suppress.current;
      suppress.current = false;
      return was;
    },
  };
}

/** Inline position for a docked element of the given size (fixed positioning). */
export function dockStyle(d: EdgeDock, size: { w: number; h: number }, inset: string): React.CSSProperties | undefined {
  if (d.drag) return { left: d.drag.x - size.w / 2, top: d.drag.y - size.h / 2, right: "auto", bottom: "auto", transition: "none", touchAction: "none" };
  if (!d.pos) return { touchAction: "none" };
  const edge = d.pos.side === "left" ? { left: inset, right: "auto" } : { right: inset, left: "auto" };
  return { ...edge, top: d.pos.y - size.h / 2, bottom: "auto", touchAction: "none" };
}
