import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabaseUrl.replace(/^http/, "ws");
const livekit = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? process.env.LIVEKIT_URL ?? "";
// LiveKit Cloud clients fetch region settings and may reconnect to regional hosts (*.livekit.cloud).
const livekitCloud = /^wss?:\/\/[^/]+\.livekit\.cloud(\/|$)/.test(livekit) ? "wss://*.livekit.cloud https://*.livekit.cloud" : "";
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Creator media via short-lived signed URLs; link-preview images come from arbitrary https hosts.
  `img-src 'self' data: blob: https: ${supabaseUrl}`,
  `media-src 'self' blob: ${supabaseUrl}`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseUrl} ${supabaseWs} ${livekit} ${livekit.replace(/^wss/, "https")} ${livekitCloud}`.replace(/\s+/g, " ").trim(),
  "frame-src https://www.youtube-nocookie.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  transpilePackages: [
    "@wonder/core",
    "@wonder/db",
    "@wonder/ui",
    "@wonder/creator-identity",
    "@wonder/creator-library",
    "@wonder/creator-send",
    "@wonder/creator-talk",
    "@wonder/creator-brain",
    "@wonder/creator-studio",
    "@wonder/creator-huddle",
  ],
  serverExternalPackages: ["unpdf", "livekit-server-sdk"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
