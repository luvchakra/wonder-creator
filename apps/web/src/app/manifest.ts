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
    icons: [{ src: "/brand/app-icon.png", sizes: "100x100", type: "image/png" }],
  };
}
