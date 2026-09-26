import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

// Brand typography (brand board §8): Inter for UI, Playfair Display for display/headings.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], display: "swap", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: "Wonder Creator", template: "%s · Wonder Creator" },
  description: "Bring what you have. Discover what it can become. Ideas become real.",
  icons: { icon: "/brand/app-icon.png", apple: "/brand/app-icon.png" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#fef7f0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:shadow-lg">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
