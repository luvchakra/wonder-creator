import "server-only";
import type { ExternalKeys } from "@wonder/creator-library";

/** Server-side keys for the royalty-free picture services (never sent to the browser). Openverse needs none. */
export const externalKeys = (): ExternalKeys => ({ pixabay: process.env.PIXABAY_API_KEY || null, unsplash: process.env.UNSPLASH_ACCESS_KEY || null });
