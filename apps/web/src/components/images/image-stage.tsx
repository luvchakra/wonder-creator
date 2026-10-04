"use client";
import { aspectRatioOf, overlayOf, type ImageEdits, type TextBox } from "@wonder/creator-studio/images";
import { cn } from "@wonder/ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CroppedImage, FONT_STACK, OverlayText, Shade } from "@/components/carousel/slide-render";
import { BlurBand, filterStyle } from "@/components/images/edited-image";

/**
 * The Images page's canvas (owner, 4 Oct 2026): the picture fills it; pinch, drag and double-tap to look closer (the
 * view only — the crop lives in Edit); text boxes are real text on the picture that the creator drags to move, pinches
 * to size, taps to select and taps again to type into. Every change goes back through `onTexts` as numbers; nothing is
 * drawn into the picture. Keyboard: arrows nudge a selected box, Enter edits it, Delete removes it, Escape lets go.
 */
const PAPER = "#fbf7f0";
const MIN_SCALE = 1;
const MAX_SCALE = 6;
const TAP_SLOP = 6;
const TAP_MS = 400;
const DOUBLE_MS = 320;

type Pointer = { x: number; y: number; boxId: string | null };
type Gesture =
  | { kind: "pan"; x0: number; y0: number; view: View }
  | { kind: "drag"; boxId: string; x0: number; y0: number; bx: number; by: number }
  | { kind: "pinch-view"; d0: number; mid0: { x: number; y: number }; view: View }
  | { kind: "pinch-box"; boxId: string; d0: number; size0: number };
interface View {
  s: number;
  x: number;
  y: number;
}

export function ImageStage({
  src,
  natural,
  edits,
  texts,
  selectedId,
  editingId,
  label,
  onSelect,
  onEdit,
  onTexts,
}: {
  src: string | null;
  natural: { width: number; height: number } | null;
  edits: ImageEdits;
  texts: TextBox[];
  selectedId: string | null;
  editingId: string | null;
  label: string;
  onSelect: (id: string | null) => void;
  onEdit: (id: string | null) => void;
  /** The boxes after a change; `commit` once a gesture ends or typing pauses, so the caller may keep a version. */
  onTexts: (texts: TextBox[], commit: boolean) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, Pointer>());
  const gesture = useRef<Gesture | null>(null);
  // What was pressed, and whether that box was already the selection then (focus selects it before the tap ends).
  const press = useRef<{ x: number; y: number; t: number; boxId: string | null; wasSelected: boolean; moved: boolean } | null>(null);
  const lastTap = useRef<{ x: number; y: number; t: number } | null>(null);
  const live = useRef(texts);
  useEffect(() => {
    live.current = texts;
  }, [texts]);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const r = e!.contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // The picture fills the canvas: as large as it fits, frame included.
  const ratio = aspectRatioOf(edits.aspect, natural);
  const pad = edits.frame === "paper" ? 0.045 : edits.frame === "border" ? 0.015 : 0;
  const byWidth = size.w;
  const heightAt = (fw: number) => (fw * (1 - 2 * pad)) / ratio + 2 * pad * fw;
  const frameW = Math.max(0, heightAt(byWidth) <= size.h ? byWidth : size.h / ((1 - 2 * pad) / ratio + 2 * pad));
  const innerW = frameW * (1 - 2 * pad);
  const innerH = innerW / ratio;

  const clampView = (v: View): View => {
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.s));
    const slackX = Math.max(0, (frameW * s - size.w) / 2 + size.w * 0.1);
    const slackY = Math.max(0, (heightAt(frameW) * s - size.h) / 2 + size.h * 0.1);
    return { s, x: Math.min(slackX, Math.max(-slackX, v.x)), y: Math.min(slackY, Math.max(-slackY, v.y)) };
  };
  const local = (e: { clientX: number; clientY: number }) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };
  const boxAt = (target: EventTarget | null) => (target instanceof Element ? (target.closest("[data-text-id]") as HTMLElement | null)?.dataset.textId ?? null : null);
  const patch = (id: string, p: Partial<TextBox>, commit: boolean) => onTexts(live.current.map((t) => (t.id === id ? { ...t, ...p } : t)), commit);

  function zoomAround(point: { x: number; y: number }, s: number, from: View = view) {
    const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
    const cx = (point.x - from.x) / from.s;
    const cy = (point.y - from.y) / from.s;
    setView(clampView({ s: ns, x: point.x - cx * ns, y: point.y - cy * ns }));
  }

  function onPointerDown(e: React.PointerEvent) {
    if (editingId && !(e.target instanceof HTMLTextAreaElement)) onEdit(null);
    if (e.target instanceof HTMLTextAreaElement) return;
    stage.current?.setPointerCapture(e.pointerId);
    const p = local(e);
    const boxId = boxAt(e.target);
    pointers.current.set(e.pointerId, { ...p, boxId });
    const ps = [...pointers.current.values()];
    if (ps.length === 1) {
      press.current = { ...p, t: e.timeStamp, boxId, wasSelected: !!boxId && selectedId === boxId, moved: false };
      const box = boxId ? live.current.find((t) => t.id === boxId) : null;
      gesture.current = box ? { kind: "drag", boxId: box.id, x0: p.x, y0: p.y, bx: box.x, by: box.y } : { kind: "pan", x0: p.x, y0: p.y, view };
    } else if (ps.length === 2) {
      press.current = null;
      const d0 = Math.hypot(ps[0]!.x - ps[1]!.x, ps[0]!.y - ps[1]!.y) || 1;
      const onBox = ps[0]!.boxId && ps[0]!.boxId === selectedId ? ps[0]!.boxId : ps[1]!.boxId && ps[1]!.boxId === selectedId ? ps[1]!.boxId : null;
      const box = onBox ? live.current.find((t) => t.id === onBox) : null;
      gesture.current = box ? { kind: "pinch-box", boxId: box.id, d0, size0: box.size } : { kind: "pinch-view", d0, mid0: { x: (ps[0]!.x + ps[1]!.x) / 2, y: (ps[0]!.y + ps[1]!.y) / 2 }, view };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const cur = pointers.current.get(e.pointerId);
    if (!cur) return;
    const p = local(e);
    pointers.current.set(e.pointerId, { ...cur, ...p });
    const g = gesture.current;
    if (!g) return;
    if (press.current && Math.hypot(p.x - press.current.x, p.y - press.current.y) > TAP_SLOP) press.current.moved = true;
    const ps = [...pointers.current.values()];
    if (g.kind === "drag") {
      const nx = g.bx + (p.x - g.x0) / (innerW * view.s);
      const ny = g.by + (p.y - g.y0) / (innerH * view.s);
      patch(g.boxId, { x: Math.min(0.97, Math.max(0.03, nx)), y: Math.min(0.97, Math.max(0.03, ny)) }, false);
    } else if (g.kind === "pan") {
      if (view.s > 1) setView(clampView({ ...g.view, x: g.view.x + (p.x - g.x0), y: g.view.y + (p.y - g.y0) }));
    } else if (ps.length >= 2) {
      const d = Math.hypot(ps[0]!.x - ps[1]!.x, ps[0]!.y - ps[1]!.y) || 1;
      if (g.kind === "pinch-box") {
        patch(g.boxId, { size: Math.min(0.3, Math.max(0.02, g.size0 * (d / g.d0))) }, false);
      } else {
        const mid = { x: (ps[0]!.x + ps[1]!.x) / 2, y: (ps[0]!.y + ps[1]!.y) / 2 };
        const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, g.view.s * (d / g.d0)));
        const cx = (g.mid0.x - g.view.x) / g.view.s;
        const cy = (g.mid0.y - g.view.y) / g.view.s;
        setView(clampView({ s: ns, x: mid.x - cx * ns, y: mid.y - cy * ns }));
      }
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (g && (g.kind === "drag" || g.kind === "pinch-box") && pointers.current.size === 0) onTexts(live.current, true);
    const pr = press.current;
    if (pr && !pr.moved && pointers.current.size === 0 && e.timeStamp - pr.t < TAP_MS && e.type !== "pointercancel") {
      const p = local(e);
      if (pr.boxId) {
        if (pr.wasSelected) onEdit(pr.boxId);
        else onSelect(pr.boxId);
        lastTap.current = null;
      } else {
        const last = lastTap.current;
        if (last && e.timeStamp - last.t < DOUBLE_MS && Math.hypot(p.x - last.x, p.y - last.y) < 24) {
          zoomAround(p, view.s > 1 ? 1 : 2.5);
          lastTap.current = null;
        } else {
          lastTap.current = { ...p, t: e.timeStamp };
          onSelect(null);
        }
      }
    }
    press.current = null;
    if (pointers.current.size === 0) gesture.current = null;
    else if (pointers.current.size === 1) {
      // One finger left after a pinch: carry on as a pan from here.
      const [rest] = [...pointers.current.values()];
      gesture.current = { kind: "pan", x0: rest!.x, y0: rest!.y, view };
      press.current = null;
    }
  }

  // Desktop: the wheel zooms around the cursor (not passive, so the page doesn't scroll instead).
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      setView((v) => {
        const r = el.getBoundingClientRect();
        const point = { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
        const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.s * Math.exp(-e.deltaY * 0.0015)));
        const cx = (point.x - v.x) / v.s;
        const cy = (point.y - v.y) / v.s;
        return clampView({ s: ns, x: point.x - cx * ns, y: point.y - cy * ns });
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameW, size.w, size.h]);

  function onBoxKey(e: React.KeyboardEvent, t: TextBox) {
    const step = e.shiftKey ? 0.05 : 0.01;
    const move = (dx: number, dy: number) => {
      e.preventDefault();
      patch(t.id, { x: Math.min(0.97, Math.max(0.03, t.x + dx)), y: Math.min(0.97, Math.max(0.03, t.y + dy)) }, true);
    };
    if (e.key === "ArrowLeft") move(-step, 0);
    else if (e.key === "ArrowRight") move(step, 0);
    else if (e.key === "ArrowUp") move(0, -step);
    else if (e.key === "ArrowDown") move(0, step);
    else if (e.key === "Enter") {
      e.preventDefault();
      onEdit(t.id);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onTexts(live.current.filter((x) => x.id !== t.id), true);
      onSelect(null);
    } else if (e.key === "Escape") onSelect(null);
  }

  return (
    <div
      ref={stage}
      className="relative size-full touch-none select-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {frameW > 0 ? (
        <div
          className={cn("absolute left-1/2 top-1/2", edits.frame === "paper" && "shadow-[0_18px_40px_-22px_rgba(40,30,20,0.55)]", edits.frame === "border" && "ring-1 ring-ink/10")}
          style={{
            width: frameW,
            padding: pad * frameW,
            background: edits.frame === "paper" ? PAPER : edits.frame === "border" ? "#ffffff" : undefined,
            transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px)) scale(${view.s})`,
            transformOrigin: "center",
          }}
        >
          <div className="relative overflow-hidden bg-surface-muted [container-type:inline-size]" style={{ width: innerW, height: innerH }} role="img" aria-label={label}>
            {src ? <CroppedImage src={src} transform={{ zoom: edits.zoom, focalX: edits.focalX, focalY: edits.focalY }} style={filterStyle(edits)} /> : null}
            {texts.map((t) => {
              const o = overlayOf(t);
              const text = t.text.trim();
              const editing = editingId === t.id;
              const f = FONT_STACK[t.font];
              return (
                <span key={t.id} className="contents">
                  {edits.blurBehind && (text || editing) ? <BlurBand y={t.y} /> : null}
                  {text || editing ? <Shade overlay={o} /> : null}
                  {editing ? (
                    <textarea
                      aria-label="Text on the picture"
                      autoFocus
                      value={t.text}
                      rows={Math.max(1, Math.min(6, t.text.split("\n").length))}
                      placeholder="Your words"
                      onChange={(e) => patch(t.id, { text: e.target.value.slice(0, 600) }, false)}
                      onBlur={() => onEdit(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          onEdit(null);
                        }
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent leading-[1.25] caret-accent outline outline-2 outline-offset-4 outline-white/90 placeholder:text-white/60 focus:outline-accent"
                      style={{
                        left: `${t.x * 100}%`,
                        top: `${t.y * 100}%`,
                        width: `${t.width * 100}%`,
                        fontSize: `${t.size * 100}cqw`,
                        fontFamily: `var(${f.variable ?? "--font-inter"}), ${f.css}`,
                        fontWeight: f.weight,
                        fontStyle: f.italic ? "italic" : "normal",
                        textAlign: t.align,
                        color: t.color,
                        textShadow: t.shadow ? "0 0.04em 0.3em rgb(0 0 0 / 0.55)" : "none",
                        ...(t.background === "band" ? { background: "rgb(251 247 240 / 0.9)", borderRadius: "0.35em", padding: "0.3em 0.5em" } : {}),
                      }}
                    />
                  ) : text ? (
                    <OverlayText
                      overlay={o}
                      text={text}
                      selected={selectedId === t.id}
                      data-text-id={t.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Text: ${text.slice(0, 80)}`}
                      aria-pressed={selectedId === t.id}
                      onKeyDown={(e) => onBoxKey(e, t)}
                      onFocus={() => onSelect(t.id)}
                      className="cursor-move"
                    />
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
      {view.s > 1 ? (
        <button type="button" onClick={() => setView({ s: 1, x: 0, y: 0 })} className="absolute right-2 top-2 inline-flex min-h-11 items-center rounded-full bg-black/35 px-3 text-[12.5px] font-medium text-white backdrop-blur-sm hover:bg-black/50">
          Fit
        </button>
      ) : null}
    </div>
  );
}
