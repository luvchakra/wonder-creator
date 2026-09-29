"use client";
import type { TelemetryEvent, TelemetryProps } from "./telemetry";

/** Fire-and-forget outcome event from the browser (never blocks, never retries, never carries content). */
export function trackClient(event: TelemetryEvent, props: TelemetryProps = {}) {
  try {
    const body = JSON.stringify({ event, props });
    if (!navigator.sendBeacon?.("/api/v1/telemetry", new Blob([body], { type: "application/json" })))
      void fetch("/api/v1/telemetry", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => undefined);
  } catch {
    /* telemetry is never worth an error */
  }
}
