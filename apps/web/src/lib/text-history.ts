import { useCallback, useState } from "react";

/**
 * Undo / redo for a text editor (palette-spec §9.16: undo and redo stay in the editor). The browser's own undo forgets
 * everything once the text is set from code — a kept revision, a restored draft, words brought in — and phones have no
 * undo key, so the Studio keeps its own short history. Typing is grouped: a pause, or a jump to a different kind of
 * edit, starts a new step; a change made from code is always a step of its own. Undo never touches saved versions (they
 * are immutable); it only changes the words on the canvas, which then autosave like any other edit.
 */
export interface TextHistory {
  past: string[];
  present: string;
  future: string[];
  /** When the newest step was last extended by typing (ms); 0 once it is closed. */
  typedAt: number;
}

export const HISTORY_LIMIT = 100;
/** Typing within this long of the last keystroke joins the same step. */
export const TYPING_GROUP_MS = 900;

export const startHistory = (text: string): TextHistory => ({ past: [], present: text, future: [], typedAt: 0 });

/** A change. `typing` joins the open step when it came soon enough; anything else is a step of its own. */
export function record(h: TextHistory, next: string, opts: { typing?: boolean; now?: number } = {}): TextHistory {
  if (next === h.present) return h;
  const now = opts.now ?? Date.now();
  if (opts.typing && h.typedAt && now - h.typedAt <= TYPING_GROUP_MS) return { ...h, present: next, future: [], typedAt: now };
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [], typedAt: opts.typing ? now : 0 };
}

export function undo(h: TextHistory): TextHistory {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1]!, future: [h.present, ...h.future], typedAt: 0 };
}

export function redo(h: TextHistory): TextHistory {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0]!, future: h.future.slice(1), typedAt: 0 };
}

/**
 * The editor's side of it: `set(text, { typing })` for every change to the words, `undo()` / `redo()` return the text to
 * show (or null when there's nothing to do), and `reset(text)` starts over (a different version opened).
 */
export function useTextHistory(initial: string) {
  const [h, setH] = useState(() => startHistory(initial));
  const set = useCallback((text: string, opts: { typing?: boolean } = {}) => setH((prev) => record(prev, text, opts)), []);
  const reset = useCallback((text: string) => setH(startHistory(text)), []);
  const step = (fn: (x: TextHistory) => TextHistory): string | null => {
    const next = fn(h);
    if (next === h) return null;
    setH(next);
    return next.present;
  };
  return { set, reset, undo: () => step(undo), redo: () => step(redo), canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}
