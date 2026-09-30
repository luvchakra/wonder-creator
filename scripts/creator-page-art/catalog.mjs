import * as D from "./decorations.mjs";
import * as T from "./templates.mjs";

/** Every piece in the library: key, file stem, generator, and what it's for. */
export const TEMPLATES = [
  { key: "immersiveHero", file: "immersive-hero", make: T.immersiveHero, label: "Immersive Artistic Hero" },
  { key: "editorialPaper", file: "editorial-paper", make: T.editorialPaper, label: "Minimal Editorial Paper" },
  { key: "cinematicDark", file: "cinematic-dark", make: T.cinematicDark, label: "Cinematic Dark" },
  { key: "creativeCollage", file: "creative-collage", make: T.creativeCollage, label: "Creative Collage" },
  { key: "softGradient", file: "soft-gradient", make: T.softGradient, label: "Soft Gradient & Minimal" },
];
export const WIDE = [{ key: "immersiveHeroWide", file: "immersive-hero-wide", make: () => T.immersiveHero({ width: 2880, height: 1440, seed: 12 }), label: "Immersive Artistic Hero (banner)" }];
export const DECORATIONS = [
  { key: "botanicalCorner", file: "botanical-corner", make: D.botanicalCorner, label: "Botanical Corner Cluster" },
  { key: "slimBranch", file: "slim-branch", make: D.slimBranch, label: "Slim Branch Illustration" },
  { key: "watercolorWash", file: "watercolor-wash", make: D.watercolorWash, label: "Watercolor Wash Blob" },
  { key: "gradientBlob", file: "gradient-blob", make: D.gradientBlob, label: "Translucent Gradient Blob" },
  { key: "paperTape", file: "paper-tape", make: D.paperTape, label: "Paper Tape Pieces" },
  { key: "tornPaperStrip", file: "torn-paper-strip", make: D.tornPaperStrip, label: "Torn Paper Strip" },
  { key: "inkScribble", file: "ink-scribble", make: D.inkScribble, label: "Ink Scribble Accents" },
  { key: "softShadowCard", file: "soft-shadow-card", make: D.softShadowCard, label: "Soft Shadow Card Backdrop" },
  { key: "grainOverlay", file: "grain-overlay", make: D.grainOverlay, label: "Subtle Grain Overlay" },
  { key: "lightLeak", file: "light-leak", make: D.lightLeak, label: "Light Leak / Glow Overlay" },
  { key: "cloudMist", file: "cloud-mist", make: D.cloudMist, label: "Cloud & Mist Overlay" },
  { key: "handwrittenNote", file: "handwritten-note", make: D.handwrittenNote, label: "Handwritten Note Element" },
];
