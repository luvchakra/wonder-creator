"use client";
import Link from "next/link";
import type { TelemetryEvent } from "@/lib/telemetry";
import { trackClient } from "@/lib/track";

/** A link that records one outcome event when followed (phase 02 §16). */
export function TrackedLink({ event, ...props }: React.ComponentProps<typeof Link> & { event: TelemetryEvent }) {
  return <Link {...props} onClick={(e) => (trackClient(event), props.onClick?.(e))} />;
}
