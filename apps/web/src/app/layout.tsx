import { APP_ICONS, KIT } from "@wonder/ui";
import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { InstallBanner } from "@/components/install-banner";
import { INSTALL_CAPTURE_SCRIPT } from "@/lib/install-banner";
import "./globals.css";

// Brand typography (brand board §8): Inter for UI, Playfair Display for display/headings.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], display: "swap", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: "Wonder Creator", template: "%s · Wonder Creator" },
  description: "Bring what you have. Discover what it can become. Ideas become real.",
  // Vector Kit app icon: vector for modern tabs, PNG fallbacks and the home-screen icon.
  icons: {
    icon: [
      { url: KIT.appIcon.appIconPrimary.svg, type: "image/svg+xml" },
      { url: KIT.appIconPng.s192.src, sizes: "192x192", type: "image/png" },
    ],
    // iOS rounds the corners itself: a full-bleed icon, so no dark or white corners show.
    apple: { url: APP_ICONS.apple180.src, sizes: "180x180" },
  },
  manifest: "/manifest.webmanifest",
  // Added to the Home Screen on iOS, it opens full screen under its own name, with the status bar over the cream.
  appleWebApp: { capable: true, title: "Wonder Creator", statusBarStyle: "default" },
  // Next writes the standard `mobile-web-app-capable`; older iOS still reads Apple's own name for it.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#fef7f0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <head>
        {/* Holds Chrome's install offer if it arrives before the app has loaded (install banner; no storage, no network). */}
        <script dangerouslySetInnerHTML={{ __html: INSTALL_CAPTURE_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:shadow-lg">
          Skip to content
        </a>
        {/* Phones and tablets that can install the app, above every top bar (docs/install-banner.md). */}
        <InstallBanner />
        {children}
      </body>
    </html>
  );
}
