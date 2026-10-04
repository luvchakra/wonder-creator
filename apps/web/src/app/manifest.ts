import { APP_ICONS, KIT } from "@wonder/ui";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wonder Creator",
    short_name: "Wonder",
    description: "Ideas become real.",
    start_url: "/",
    display: "standalone",
    background_color: "#fef7f0",
    theme_color: "#fef7f0",
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
