"use client";
import { relativeTime } from "@wonder/core";
import { useSyncExternalStore } from "react";

// One shared clock for all time labels. The server snapshot is null, so time text renders only
// after hydration (no server/client mismatch when clocks or second boundaries differ).
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Current time (updates every second) on the client; null during server render and hydration. */
export function useNow(): Date | null {
  const t = useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
  return t === null ? null : new Date(t);
}

export function RelativeTime({ iso }: { iso: string }) {
  const n = useNow();
  return <time dateTime={iso}>{n ? relativeTime(iso, n) : ""}</time>;
}
