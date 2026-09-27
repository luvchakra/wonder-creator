import * as React from "react";
import { cn } from "../cn";
import { KIT, type KitAsset } from "../brand/kit";
import { type BrandImageVariant, WATERCOLOR, type WatercolorKey } from "../brand/watercolor";

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

/**
 * The official Wonder Creator logo from the owner-supplied Vector Kit (SVG, never redrawn):
 * `primary` — symbol + wordmark; `mark` — the symbol alone; `stacked` — symbol above the wordmark.
 * The kit's tagline lock-ups (full, mono, reversed) aren't used: the owner chose "Ideas Become Real." (see <Tagline>).
 */
export function Logo({ variant = "primary", height = 40, className }: { variant?: "primary" | "mark" | "stacked"; height?: number; className?: string }) {
  const a = { primary: KIT.logo.logoNoTagline, mark: KIT.logo.symbol, stacked: KIT.logo.logoStacked }[variant];
  const width = Math.round((a.width / a.height) * height);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={a.svg} width={width} height={height} alt="Wonder Creator" className={cn("block select-none", className)} draggable={false} />
  );
}

/** The brand tagline, "Ideas Become Real." (owner's choice, 27 Sep 2026), as live Playfair text — no artwork exists for it. */
export function Tagline({ className }: { className?: string }) {
  return (
    <p className={cn("font-display text-ink", className)}>
      Ideas <span className="text-brand-gradient">Become</span> Real.
    </p>
  );
}

/**
 * A piece of Vector Kit artwork: vectors as a plain <img>, painted pieces as a responsive AVIF/WebP <picture>.
 * Decorative by default (empty alt, hidden from assistive tech), lazy unless `priority`.
 */
export function KitArt({ art, sizes = "(min-width: 640px) 16rem, 10rem", className, alt = "", priority = false }: { art: KitAsset; sizes?: string; className?: string; alt?: string; priority?: boolean }) {
  const common = { "aria-hidden": alt ? undefined : true, loading: priority ? ("eager" as const) : ("lazy" as const), decoding: "async" as const, draggable: false, className: cn("select-none", className) };
  if ("svg" in art) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={art.svg} alt={alt} width={art.width} height={art.height} {...common} />;
  }
  const set = (v: readonly BrandImageVariant[]) => v.map((x) => `${x.src} ${x.width}w`).join(", ");
  const fallback = art.webp[art.webp.length - 1]?.src;
  return (
    <picture>
      <source type="image/avif" srcSet={set(art.avif)} sizes={sizes} />
      <img src={fallback} alt={alt} srcSet={set(art.webp)} sizes={sizes} width={art.width} height={art.height} fetchPriority={priority ? "high" : undefined} {...common} />
    </picture>
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

/**
 * An owner-supplied watercolor piece (see `brand/watercolor.ts`) as a responsive AVIF/WebP <picture>. Decorative by
 * default (empty alt, hidden from assistive tech); lazy unless `priority`.
 */
export function Watercolor({ name, sizes, className, alt = "", priority = false }: { name: WatercolorKey; sizes: string; className?: string; alt?: string; priority?: boolean }) {
  const a = WATERCOLOR[name];
  const set = (v: readonly BrandImageVariant[]) => v.map((x) => `${x.src} ${x.width}w`).join(", ");
  const fallback = a.webp[a.webp.length - 1]!;
  return (
    <picture>
      <source type="image/avif" srcSet={set(a.avif)} sizes={sizes} />
      <img
        src={fallback.src}
        srcSet={set(a.webp)}
        sizes={sizes}
        width={a.width}
        height={a.height}
        alt={alt}
        aria-hidden={alt ? undefined : true}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        draggable={false}
        className={cn("select-none", className)}
      />
    </picture>
  );
}
