"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const key = (v: unknown) => JSON.stringify(v);

export type AutosaveState = "idle" | "saving" | "saved" | "error";

/**
 * Words that save themselves (owner, 21 Oct 2026: "it should auto saved whatever is written"). Saves `value` a moment
 * after the last change, when `flush()` is called (a field losing focus), and when the tab is hidden or the page is left
 * (`leave` describes a keepalive request, so nothing typed is lost). One save at a time, always the latest value;
 * whatever changes while a save is out goes in the next round. A failure waits for the next change or flush. No page
 * refresh. The quiet status line (`state`) says where it stands; there is no Save button.
 */
export function useAutosave<T>(opts: {
  value: T;
  /** What is already saved (the first render's value). */
  saved: T;
  send: (v: T) => Promise<unknown>;
  /** The request to fire when the page is left with unsaved changes. */
  leave?: (v: T) => { url: string; method: string; json: unknown };
  enabled?: boolean;
  delayMs?: number;
}) {
  const { value, send, leave, enabled = true, delayMs = 700 } = opts;
  const savedKey = useRef(key(opts.saved));
  const latest = useRef(value);
  const sendRef = useRef(send);
  const leaveRef = useRef(leave);
  const inFlight = useRef(false);
  const [state, setState] = useState<AutosaveState>("idle");
  useEffect(() => {
    latest.current = value;
    sendRef.current = send;
    leaveRef.current = leave;
  });

  const flush = useCallback(async () => {
    if (!enabled || inFlight.current) return;
    inFlight.current = true;
    try {
      while (key(latest.current) !== savedKey.current) {
        const sending = latest.current;
        setState("saving");
        await sendRef.current(sending);
        savedKey.current = key(sending);
      }
      setState("saved");
    } catch {
      setState("error");
    } finally {
      inFlight.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || key(value) === savedKey.current) return;
    const t = setTimeout(() => void flush(), delayMs);
    return () => clearTimeout(t);
  }, [value, enabled, delayMs, flush]);

  useEffect(() => {
    // Leaving (the tab hidden, or another page opened) sends what's still unsaved.
    const sendNow = () => {
      const req = leaveRef.current;
      if (!enabled || !req || key(latest.current) === savedKey.current) return;
      const r = req(latest.current);
      void fetch(r.url, { method: r.method, keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify(r.json) });
      savedKey.current = key(latest.current);
    };
    const hide = () => document.visibilityState === "hidden" && sendNow();
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      sendNow();
    };
  }, [enabled]);

  return { state, flush };
}

/** The one quiet line under an autosaved field. */
export function autosaveLine(state: AutosaveState): string {
  return state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Couldn't save yet. Keep writing; we'll try again." : "";
}
