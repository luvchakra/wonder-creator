import { KIT } from "@wonder/ui";
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
    icons: [
      { src: KIT.appIconPng.s192.src, sizes: "192x192", type: "image/png" },
      { src: KIT.appIconPng.s512.src, sizes: "512x512", type: "image/png" },
      { src: KIT.appIcon.appIconPrimary.svg, sizes: "any", type: "image/svg+xml" },
    ],
  };
}
