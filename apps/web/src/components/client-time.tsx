"use client";
import { relativeTime } from "@wonder/core";
import { useSyncExternalStore } from "react";

// One shared clock for all time labels. The server snapshot is null, so time text renders only
// after hydration (no server/client mismatch when clocks or second boundaries differ).
//
// Labels like "5 min ago" change at most every 45 seconds, so most of the page is told every 15 seconds — a tick each
// second re-rendered every label for the whole session. Only a live stopwatch (the Huddle's elapsed time) asks for
// every second, and then only it is told every second. Nothing ticks while the tab is hidden; coming back ticks once.
let now = Date.now();
const slow = new Set<() => void>();
const fast = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let lastSlow = 0;
const SLOW_MS = 15_000;

function tick(force = false) {
  now = Date.now();
  fast.forEach((l) => l());
  if (force || now - lastSlow >= SLOW_MS - 50) {
    lastSlow = now;
    slow.forEach((l) => l());
  }
}
const onVisibility = () => {
  if (document.visibilityState === "visible") tick(true);
};
let every = 0;
/** (Re)starts the timer only when the speed it needs changes: none, every 15 s, or every second. */
function retime() {
  const want = fast.size ? 1000 : slow.size ? SLOW_MS : 0;
  if (want === every) return;
  every = want;
  if (timer) clearInterval(timer);
  timer = null;
  document.removeEventListener("visibilitychange", onVisibility);
  if (!want) return;
  document.addEventListener("visibilitychange", onVisibility);
  timer = setInterval(() => document.visibilityState === "visible" && tick(), want);
}
function subscriber(set: Set<() => void>) {
  return (cb: () => void) => {
    set.add(cb);
    if (!timer) {
      now = Date.now();
      lastSlow = now;
    }
    retime();
    return () => {
      set.delete(cb);
      retime();
    };
  };
}
const subscribeSlow = subscriber(slow);
const subscribeFast = subscriber(fast);

/**
 * The current time on the client; null during server render and hydration. Updates every 15 seconds while the tab is
 * visible, or every second with `everySecond` (for a stopwatch that shows seconds).
 */
export function useNow(everySecond = false): Date | null {
  const t = useSyncExternalStore(
    everySecond ? subscribeFast : subscribeSlow,
    () => now,
    () => null,
  );
  return t === null ? null : new Date(t);
}

export function RelativeTime({ iso }: { iso: string }) {
  const n = useNow();
  return <time dateTime={iso}>{n ? relativeTime(iso, n) : ""}</time>;
}

/** A time in the viewer's own locale and time zone, rendered after hydration (the server can't know either). */
export function LocalTime({ iso, options }: { iso: string; options?: Intl.DateTimeFormatOptions }) {
  const n = useNow();
  return <time dateTime={iso}>{n ? new Date(iso).toLocaleString([], options ?? { dateStyle: "medium", timeStyle: "short" }) : ""}</time>;
}
