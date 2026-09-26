import * as React from "react";
import { cn } from "../cn";

/**
 * Brand assets are the supplied files (pixel crops of the brand board) — never redrawn.
 * The logo crops carry the board's white panel background, so they sit on white surfaces.
 */
export const BRAND_ASSETS = {
  logoPrimary: { src: "/brand/logo-primary.png", width: 395, height: 175 },
  logoMark: { src: "/brand/logo-mark.png", width: 145, height: 120 },
  appIcon: { src: "/brand/app-icon.png", width: 100, height: 100 },
  elements: { src: "/brand/brand-elements.png", width: 266, height: 316 },
} as const;

export const BACKGROUNDS = {
  sunsetCoast: "/brand/backgrounds/sunset-coast-creator.webp",
  coastalVillage: "/brand/backgrounds/coastal-village-sunset.webp",
  mistyMountains: "/brand/backgrounds/misty-mountains-dawn.webp",
  studioDesk: "/brand/backgrounds/studio-desk-camera.webp",
  botanicalLeaves: "/brand/backgrounds/botanical-leaves-glow.webp",
  archesSea: "/brand/backgrounds/arches-sea-view.webp",
  terraceLaptop: "/brand/backgrounds/terrace-laptop-sunset.webp",
  waves: "/brand/backgrounds/waves-gradient.webp",
  softForms: "/brand/backgrounds/soft-gradient-forms.webp",
  leafShadow: "/brand/backgrounds/leaf-shadow-wall.webp",
  pastelClouds: "/brand/backgrounds/pastel-clouds.webp",
} as const;

export function Logo({ variant = "primary", height = 40, className }: { variant?: "primary" | "mark"; height?: number; className?: string }) {
  const a = variant === "primary" ? BRAND_ASSETS.logoPrimary : BRAND_ASSETS.logoMark;
  const width = Math.round((a.width / a.height) * height);
  return (
    // Plain <img>: exact supplied pixels, aspect ratio preserved, no processing.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={a.src} width={width} height={height} alt="Wonder Creator" className={cn("block select-none", className)} draggable={false} />
  );
}

/** Supplied brand-elements artwork, faint and decorative (aria-hidden, no pointer events). */
export function BrandDecor({ className, opacity = 0.35 }: { className?: string; opacity?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND_ASSETS.elements.src}
      alt=""
      aria-hidden
      draggable={false}
      style={{ opacity, mixBlendMode: "multiply" }}
      className={cn("pointer-events-none absolute select-none", className)}
    />
  );
}

/**
 * A supplied background image with an approved cream overlay so text stays readable.
 * Presentation-only transforms: cover crop, focal position, opacity/overlay.
 */
export function BrandBackground({
  src,
  className,
  overlay = "cream",
  position = "center",
  children,
}: {
  src: string;
  className?: string;
  overlay?: "cream" | "soft" | "none" | "stage";
  position?: string;
  children?: React.ReactNode;
}) {
  const ov = {
    cream: "bg-gradient-to-r from-cream via-cream/85 to-cream/30",
    soft: "bg-cream/55",
    none: "",
    stage: "bg-gradient-to-t from-navy/80 via-navy/30 to-transparent",
  }[overlay];
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" aria-hidden className="pointer-events-none absolute inset-0 size-full object-cover" style={{ objectPosition: position }} />
      {ov ? <div aria-hidden className={cn("pointer-events-none absolute inset-0", ov)} /> : null}
      <div className="relative">{children}</div>
    </div>
  );
}
