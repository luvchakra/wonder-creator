import { APP_ICONS, KIT } from "@wonder/ui";
import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // This deployment's own address: the manifest lists itself as a related app (below), which needs an absolute URL.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return {
    id: "/",
    name: "Wonder Creator",
    short_name: "Wonder",
    description: "Bring what you have. Discover what it can become. Ideas become real.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fef7f0",
    theme_color: "#fef7f0",
    // Lets a browser tab ask "is this app installed here?" (getInstalledRelatedApps), so the install banner stays away
    // once it is. The web app itself stays the preferred way in (docs/install-banner.md).
    related_applications: [{ platform: "webapp", url: `${proto}://${host}/manifest.webmanifest` }],
    prefer_related_applications: false,
    // Home screen (owner, 4 Oct 2026: white lines and a small, soft icon): full-bleed "maskable" icons that Android
    // shapes itself instead of shrinking a rounded icon onto a white plate; the rounded ones stay for everything else.
    icons: [
      { src: APP_ICONS.maskable192.src, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: APP_ICONS.maskable512.src, sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: KIT.appIconPng.s192.src, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: KIT.appIconPng.s512.src, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: KIT.appIcon.appIconPrimary.svg, sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
