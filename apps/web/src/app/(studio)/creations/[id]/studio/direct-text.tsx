"use client";
import { snapPosition, type SlideOverlay } from "@wonder/creator-studio/carousel";
import { useEffect, useRef, useState } from "react";
import { OverlayText } from "@/components/carousel/slide-render";
import { api, errorMessage } from "@/lib/client";

const MIN_SIZE = 0.02;
const MAX_SIZE = 0.2;
const clampSize = (v: number) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, v));

/**
 * The words on the image, handled right on the Studio canvas (owner, 29 Sep 2026: "allow user to pinch and zoom text on
 * image directly, also move around the text"). One finger (or the mouse) drags them; two fingers pinch to resize them;
 * a trackpad pinch (ctrl + wheel) does the same. Arrow keys move them and + / − resize them, so nothing needs a precise
 * gesture. A tap without moving opens the Slide Editor. Every change autosaves; positions snap like the editor's.
 */
export function DirectText({
  slideId,
  overlay,
  text,
  onOpen,
  onSaved,
  onError,
}: {
  slideId: string;
  overlay: SlideOverlay;
  text: string;
  onOpen: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  // What's on screen while (and just after) a gesture; the saved overlay takes over again once the slide refreshes.
  const [local, setLocal] = useState<{ base: SlideOverlay; value: SlideOverlay } | null>(null);
  const o = local && local.base === overlay ? local.value : overlay;
  const box = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ start: SlideOverlay; x: number; y: number; dist: number | null; moved: boolean } | null>(null);
  const [guide, setGuide] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (next: SlideOverlay) => setLocal({ base: overlay, value: next });
  const save = (next: SlideOverlay, delay = 0) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await api(`/api/v1/carousel-slides/${slideId}`, { method: "PATCH", json: { overlay: next } });
        onSaved();
      } catch (e) {
        onError(errorMessage(e));
      }
    }, delay);
  };

  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null;
  };
  const centre = () => {
    const all = [...pointers.current.values()];
    return { x: all.reduce((s, p) => s + p.x, 0) / all.length, y: all.reduce((s, p) => s + p.y, 0) / all.length };
  };
  // A new finger restarts the gesture from where things are now, so adding or lifting one never jumps.
  const restart = (moved: boolean) => {
    const c = centre();
    gesture.current = { start: o, x: c.x, y: c.y, dist: spread(), moved };
  };

  // A trackpad pinch arrives as ctrl + wheel; it must not zoom the page, so the listener isn't passive.
  const latest = useRef({ o, set, save });
  useEffect(() => {
    latest.current = { o, set, save };
  });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || !(e.target as HTMLElement).closest("[data-overlay-text]")) return;
      e.preventDefault();
      const { o: cur, set: put, save: keep } = latest.current;
      const next = { ...cur, size: clampSize(cur.size * Math.exp(-e.deltaY / 200)) };
      put(next);
      keep(next, 400);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div ref={box} className="pointer-events-none absolute inset-0 overflow-hidden [container-type:inline-size]">
      {guide ? <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-white/50" /> : null}
      <OverlayText
        overlay={o}
        text={text}
        role="button"
        tabIndex={0}
        data-overlay-text=""
        aria-label="Words on the image. Drag to move, pinch to resize, or use the arrow keys and plus or minus. Enter opens the slide editor."
        className="pointer-events-auto cursor-grab touch-none select-none rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:cursor-grabbing"
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          e.stopPropagation();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          restart(gesture.current?.moved ?? false);
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const g = gesture.current;
          const r = box.current?.getBoundingClientRect();
          if (!g || !r) return;
          const c = centre();
          const dx = c.x - g.x;
          const dy = c.y - g.y;
          const d = spread();
          if (!g.moved && Math.hypot(dx, dy) < 5 && !(d && g.dist && Math.abs(d - g.dist) > 5)) return;
          g.moved = true;
          const p = snapPosition(g.start.x + dx / r.width, g.start.y + dy / r.height);
          setGuide(p.snapped !== null);
          set({ ...g.start, x: p.x, y: p.y, size: d && g.dist ? clampSize(g.start.size * (d / g.dist)) : g.start.size });
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          const g = gesture.current;
          if (pointers.current.size) return restart(true);
          gesture.current = null;
          setGuide(false);
          if (!g?.moved) return onOpen();
          save(o);
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          if (!pointers.current.size) {
            gesture.current = null;
            setGuide(false);
          }
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            return onOpen();
          }
          const step = e.shiftKey ? 0.05 : 0.01;
          const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
          let next: SlideOverlay | null = null;
          if (moves[e.key]) {
            const p = snapPosition(o.x + moves[e.key]![0], o.y + moves[e.key]![1], 0);
            next = { ...o, x: p.x, y: p.y };
          } else if (e.key === "+" || e.key === "=") next = { ...o, size: clampSize(o.size * 1.1) };
          else if (e.key === "-" || e.key === "_") next = { ...o, size: clampSize(o.size / 1.1) };
          if (!next) return;
          e.preventDefault();
          set(next);
          save(next, 400);
        }}
      />
    </div>
  );
}
