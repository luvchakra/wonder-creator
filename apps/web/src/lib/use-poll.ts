"use client";
import { useEffect, useRef } from "react";

/** The few things of `document` a poller needs (so it can be tested without a browser). */
export interface PollDocument {
  visibilityState: string;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export interface PollOptions {
  /** Slow down ×1.5 after each run, up to `maxMs`: for jobs that take a while. */
  backoff?: boolean;
  maxMs?: number;
}

/**
 * Runs `task` every `ms` while the tab is visible; returns a function that stops it. Going to another tab pauses it;
 * coming back runs it at once if a full interval has passed (so stale numbers don't sit there) and restarts the wait.
 * A failing task never stops the poll (the task keeps its own last good state).
 */
export function startPolling(task: () => unknown, ms: number, opts: PollOptions = {}, doc: PollDocument = document): () => void {
  const { backoff = false, maxMs = ms * 4 } = opts;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let wait = ms;
  let last = Date.now();

  const schedule = (after: number) => {
    clearTimeout(timer);
    timer = setTimeout(run, after);
  };
  async function run() {
    if (stopped || doc.visibilityState !== "visible") return; // paused: coming back restarts it
    last = Date.now();
    try {
      await task();
    } catch {
      /* the task keeps its own last good state */
    }
    if (stopped) return;
    if (backoff) wait = Math.min(maxMs, Math.round(wait * 1.5));
    schedule(wait);
  }
  const onVisibility = () => {
    clearTimeout(timer);
    if (stopped || doc.visibilityState !== "visible") return;
    wait = ms;
    const quiet = Date.now() - last;
    if (quiet >= ms) void run();
    else schedule(ms - quiet);
  };

  doc.addEventListener("visibilitychange", onVisibility);
  if (doc.visibilityState === "visible") schedule(wait);
  return () => {
    stopped = true;
    clearTimeout(timer);
    doc.removeEventListener("visibilitychange", onVisibility);
  };
}

/**
 * The one way the browser polls (docs/performance.md, CLAUDE.md › Performance). Every poll is a request the small
 * database has to answer, so a poll nobody can see shouldn't happen: it runs only while the tab is visible and `active`
 * is true. The latest `task` always runs, so it can use fresh state without restarting the timer.
 */
export function usePoll(task: () => unknown, ms: number, active = true, opts: PollOptions = {}) {
  const latest = useRef(task);
  useEffect(() => {
    latest.current = task;
  });
  const { backoff, maxMs } = opts;
  useEffect(() => {
    if (!active) return;
    return startPolling(() => latest.current(), ms, { backoff, maxMs });
  }, [ms, active, backoff, maxMs]);
}
