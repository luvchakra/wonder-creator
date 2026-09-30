/**
 * Creator Page templates (owner spec "Creator Page Template System", 30 Sep 2026; docs/creator-page-templates.md).
 * One curated public page, five visual lenses. Client-safe: no database access here.
 *
 * A template is presentation only. It never changes what's on the page — the same works, DejaVus, Moments and words
 * render through whichever lens the creator picks. Settings are kept per template, so switching away and back restores
 * them. There are no free-form colours, fonts, margins or positions: this is choosing an expression, not building a site.
 */
import { PAGE_SECTIONS, type PageSection } from "./publish-options";

export const TEMPLATE_IDS = ["immersive_artistic", "minimal_editorial", "cinematic_dark", "creative_collage", "soft_gradient"] as const;
export type CreatorPageTemplateId = (typeof TEMPLATE_IDS)[number];
export const DEFAULT_TEMPLATE: CreatorPageTemplateId = "soft_gradient";

export const TEMPLATE_INFO: Record<CreatorPageTemplateId, { name: string; description: string }> = {
  immersive_artistic: { name: "Immersive Artistic", description: "Expressive and image-led." },
  minimal_editorial: { name: "Minimal Editorial", description: "Calm and literary." },
  cinematic_dark: { name: "Cinematic Dark", description: "Moody and atmospheric." },
  creative_collage: { name: "Creative Collage", description: "Handmade and mixed-media." },
  soft_gradient: { name: "Soft Gradient", description: "Modern and airy." },
};

type Choice = { kind: "choice"; key: string; label: string; options: ReadonlyArray<{ value: string; label: string }>; default: string };
type Toggle = { kind: "toggle"; key: string; label: string; default: boolean };
export type TemplateSettingField = Choice | Toggle;

const choice = (key: string, label: string, options: Array<[string, string]>, def?: string): Choice => ({ kind: "choice", key, label, options: options.map(([value, l]) => ({ value, label: l })), default: def ?? options[0]![0] });
const toggle = (key: string, label: string, def: boolean): Toggle => ({ kind: "toggle", key, label, default: def });

/** The only knobs each template has — and only these (spec §23). */
export const TEMPLATE_SETTINGS: Record<CreatorPageTemplateId, readonly TemplateSettingField[]> = {
  immersive_artistic: [
    choice("heroSource", "Hero picture", [
      ["template_art", "Template painting"],
      ["creator_cover", "Your featured work"],
    ]),
    choice("heroContrast", "Hero contrast", [
      ["soft", "Soft"],
      ["balanced", "Balanced"],
    ]),
    toggle("handwrittenAccent", "Handwritten accent", true),
    choice("contentDensity", "Spacing", [
      ["compact", "Compact"],
      ["comfortable", "Comfortable"],
    ]),
  ],
  minimal_editorial: [
    choice("paperTone", "Paper", [
      ["warm", "Warm"],
      ["neutral", "Neutral"],
    ]),
    choice("headingStyle", "Headings", [
      ["serif", "Serif"],
      ["mixed", "Mixed"],
    ]),
    toggle("showCoverImage", "Show your picture", true),
    choice("botanicalAccent", "Botanical accent", [
      ["subtle", "Subtle"],
      ["none", "None"],
    ]),
  ],
  cinematic_dark: [
    choice("accentMode", "Accent", [
      ["warm", "Warm"],
      ["cool", "Cool"],
    ]),
    choice("heroContrast", "Hero contrast", [
      ["soft", "Soft"],
      ["strong", "Strong"],
    ]),
    choice("mediaDensity", "Media", [
      ["large", "Large"],
      ["balanced", "Balanced"],
    ]),
  ],
  creative_collage: [
    choice("collageIntensity", "Collage style", [
      ["light", "Light"],
      ["medium", "Medium"],
    ]),
    toggle("handwritingAccent", "Handwritten accents", true),
    toggle("paperTexture", "Paper texture", true),
  ],
  soft_gradient: [
    choice("gradientPreset", "Gradient", [
      ["lavender", "Lavender"],
      ["peach", "Peach"],
      ["sky", "Sky"],
    ]),
    choice("compactness", "Spacing", [
      ["compact", "Compact"],
      ["standard", "Standard"],
    ]),
    choice("cardStyle", "Cards", [
      ["soft", "Soft"],
      ["minimal", "Minimal"],
    ]),
  ],
};

export type TemplateSettings = Record<string, string | boolean>;

export function isTemplateId(v: unknown): v is CreatorPageTemplateId {
  return typeof v === "string" && (TEMPLATE_IDS as readonly string[]).includes(v);
}

/** An unknown or retired template falls back safely to the default (spec §45). */
export function resolveTemplateId(v: unknown): CreatorPageTemplateId {
  return isTemplateId(v) ? v : DEFAULT_TEMPLATE;
}

/** One template's settings: stored values that are still valid, defaults for the rest; unknown keys are dropped. */
export function settingsFor(id: CreatorPageTemplateId, all: unknown): TemplateSettings {
  const stored = (all && typeof all === "object" ? (all as Record<string, unknown>)[id] : null) as Record<string, unknown> | null;
  const out: TemplateSettings = {};
  for (const f of TEMPLATE_SETTINGS[id]) {
    const v = stored?.[f.key];
    out[f.key] = f.kind === "toggle" ? (typeof v === "boolean" ? v : f.default) : typeof v === "string" && f.options.some((o) => o.value === v) ? v : f.default;
  }
  return out;
}

/** Validates a settings patch for one template; throws on anything not offered for it. */
export function validateSettings(id: CreatorPageTemplateId, patch: Record<string, unknown>): TemplateSettings {
  const out: TemplateSettings = {};
  for (const [k, v] of Object.entries(patch)) {
    const f = TEMPLATE_SETTINGS[id].find((x) => x.key === k);
    if (!f) throw new Error(`“${k}” isn't a setting of this template.`);
    if (f.kind === "toggle" ? typeof v !== "boolean" : typeof v !== "string" || !f.options.some((o) => o.value === v)) throw new Error(`That isn't a choice for “${f.label}”.`);
    out[k] = v as string | boolean;
  }
  return out;
}

/** Merge one template's settings into the stored per-template map, leaving the other templates' settings untouched. */
export function mergeTemplateSettings(all: unknown, id: CreatorPageTemplateId, patch: Record<string, unknown>): Record<string, TemplateSettings> {
  const base = (all && typeof all === "object" ? { ...(all as Record<string, TemplateSettings>) } : {}) as Record<string, TemplateSettings>;
  base[id] = { ...settingsFor(id, all), ...validateSettings(id, patch) };
  return base;
}

/**
 * The page's sections in the creator's order, with what each needs to be worth showing. Identity is always first and
 * isn't a section the creator can hide; a section with nothing public in it is never rendered (no empty headings, no
 * "0 pieces").
 */
export interface SectionContent {
  featured: number;
  creations: number;
  dejavu: number;
  moments: number;
  conversations: number;
  about: number;
  open_to: number;
  links: number;
}

export function visibleSections(sections: ReadonlyArray<{ section: PageSection; enabled: boolean }>, content: SectionContent): PageSection[] {
  const seen = new Set<PageSection>();
  const out: PageSection[] = [];
  for (const s of sections) {
    if (seen.has(s.section)) continue;
    seen.add(s.section);
    if (s.enabled && content[s.section] > 0) out.push(s.section);
  }
  return out;
}

/** The spec's default order: DejaVu, Featured, Creations, Moments, About, Open to (then Links and Community, off). */
export const DEFAULT_SECTIONS: ReadonlyArray<{ section: PageSection; enabled: boolean }> = (["dejavu", "featured", "creations", "moments", "about", "open_to", "links", "conversations"] as const).map((section) => ({ section, enabled: section !== "conversations" }));

/** Stored sections made whole: defaults when there are none, unknown ones dropped, newer ones appended switched off. */
export function normalizeSections(raw: unknown): Array<{ section: PageSection; enabled: boolean }> {
  const list = Array.isArray(raw) && raw.length ? (raw as Array<{ section: string; enabled: boolean }>) : DEFAULT_SECTIONS;
  const out = list.filter((s) => (PAGE_SECTIONS as readonly string[]).includes(s.section)).map((s) => ({ section: s.section as PageSection, enabled: !!s.enabled }));
  for (const s of PAGE_SECTIONS) if (!out.some((x) => x.section === s)) out.push({ section: s, enabled: false });
  return out;
}
