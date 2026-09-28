import { KIT } from "@wonder/ui";

/**
 * Browsers still ask for /favicon.ico directly (the metadata icons cover modern tabs). Point them at the supplied Vector
 * Kit app icon instead of a 404 — the brand's own asset, nothing new drawn.
 */
export function GET(req: Request) {
  return Response.redirect(new URL(KIT.appIconPng.s192.src, req.url), 308);
}
