import "server-only";
import type { ExternalKeys } from "@wonder/creator-library";

/** Server-side keys for the royalty-free picture services (never sent to the browser). Openverse needs none. */
export const externalKeys = (): ExternalKeys => ({ pixabay: process.env.PIXABAY_API_KEY || null, pexels: process.env.PEXELS_API_KEY || null });
