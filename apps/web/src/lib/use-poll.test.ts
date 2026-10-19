import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPolling, type PollDocument } from "./use-poll";

/** A page whose visibility the test controls. */
function fakeDocument(): PollDocument & { set(state: "visible" | "hidden"): void } {
  const listeners = new Set<() => void>();
  const doc = {
    visibilityState: "visible",
    addEventListener: (_: "visibilitychange", l: () => void) => void listeners.add(l),
    removeEventListener: (_: "visibilitychange", l: () => void) => void listeners.delete(l),
    set(state: "visible" | "hidden") {
      doc.visibilityState = state;
      for (const l of [...listeners]) l();
    },
  };
  return doc;
}

describe("startPolling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs on every interval while the tab is visible", async () => {
    const task = vi.fn();
    const stop = startPolling(task, 1000, {}, fakeDocument());
    await vi.advanceTimersByTimeAsync(3500);
    expect(task).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("does nothing while the tab is hidden, and runs at once when it returns after a full interval", async () => {
    const doc = fakeDocument();
    const task = vi.fn();
    startPolling(task, 1000, {}, doc);
    await vi.advanceTimersByTimeAsync(1100);
    expect(task).toHaveBeenCalledTimes(1);
    doc.set("hidden");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(task).toHaveBeenCalledTimes(1);
    doc.set("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1100);
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("waits out the rest of the interval when the tab returns early", async () => {
    const doc = fakeDocument();
    const task = vi.fn();
    startPolling(task, 1000, {}, doc);
    await vi.advanceTimersByTimeAsync(1100);
    doc.set("hidden");
    await vi.advanceTimersByTimeAsync(200);
    doc.set("visible");
    await vi.advanceTimersByTimeAsync(100);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(800);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("backs off ×1.5 up to the cap, and starts over when the tab returns", async () => {
    const doc = fakeDocument();
    const task = vi.fn();
    startPolling(task, 1000, { backoff: true, maxMs: 2000 }, doc);
    await vi.advanceTimersByTimeAsync(1000); // run 1, next in 1500
    await vi.advanceTimersByTimeAsync(1400);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200); // run 2 at 2500, next in 2000 (capped)
    expect(task).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(task).toHaveBeenCalledTimes(3);
    doc.set("hidden");
    doc.set("visible"); // a full interval has not passed since run 3? it has not: schedules the rest at the base interval
    await vi.advanceTimersByTimeAsync(1100);
    expect(task).toHaveBeenCalledTimes(4);
  });

  it("keeps going when the task fails", async () => {
    const task = vi.fn().mockRejectedValue(new Error("offline"));
    startPolling(task, 1000, {}, fakeDocument());
    await vi.advanceTimersByTimeAsync(3100);
    expect(task).toHaveBeenCalledTimes(3);
  });
});
