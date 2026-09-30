import { OPEN_TO_LABEL, type OpenTo } from "@wonder/creator-community/shared";
import { settingsFor, visibleSections, type CreatorPageTemplateId, type TemplateSettings } from "@wonder/creator-studio/creator-page";
import type { PageSection } from "@wonder/creator-studio/publish";
import type { PublicCard, PublicCreatorPage } from "../../lib/public-pages";

/** The Creator Page's shared model (pure): what to show and in what form, whatever the template. */

export interface PageModel {
  data: PublicCreatorPage;
  sections: PageSection[];
  featured: PublicCard | null;
  creations: PublicCard[];
  dejavus: PublicCreatorPage["dejavus"];
  moments: PublicCreatorPage["moments"];
  openTo: string[];
  statement: string | null;
  counts: Array<{ label: string; n: number }>;
}

/** What the page shows: the creator's order, only sections with something public in them, no empty DejaVus. */
export function pageModel(data: PublicCreatorPage): PageModel {
  const featured = data.works.find((w) => w.featured) ?? data.works.find((w) => w.coverUrl) ?? data.works[0] ?? null;
  const dejavus = data.dejavus.filter((d) => d.count > 0);
  const creations = data.works.filter((w) => w !== featured);
  const sections = visibleSections(data.sections as Array<{ section: PageSection; enabled: boolean }>, {
    featured: featured ? 1 : 0,
    // Creations lists the rest; with Featured off it lists everything.
    creations: (data.sections as Array<{ section: string; enabled: boolean }>).some((s) => s.section === "featured" && s.enabled) ? creations.length : data.works.length,
    dejavu: dejavus.length,
    moments: data.moments.length,
    conversations: data.conversations.length,
    about: data.creator.bio || data.creator.location || data.links.length ? 1 : 0,
    open_to: data.openTo.length,
    links: data.links.length,
  });
  // Links live inside About; a page showing Links without About shows About (with its links) in that place.
  const ordered = [...new Set(sections.map((s) => (s === "links" ? "about" : s)))] as PageSection[];
  return {
    data,
    sections: ordered,
    featured,
    creations: sections.includes("featured") ? creations : data.works,
    dejavus,
    moments: data.moments,
    openTo: data.openTo.map((o: string) => OPEN_TO_LABEL[o as OpenTo] ?? o),
    statement: data.headline || data.intro?.split("\n")[0] || null,
    counts: [
      { label: data.works.length === 1 ? "Creation" : "Creations", n: data.works.length },
      { label: data.moments.length === 1 ? "Moment" : "Moments", n: data.moments.length },
      { label: dejavus.length === 1 ? "DejaVu" : "DejaVus", n: dejavus.length },
    ].filter((c) => c.n > 0),
  };
}

export function templateSettings(data: PublicCreatorPage, id: CreatorPageTemplateId): TemplateSettings {
  return settingsFor(id, data.templateSettings);
}


/**
 * How a work is shown (spec §12): text as typography, sound as a waveform over its artwork, film as a poster with play,
 * a carousel as its first slide with a count, pictures as pictures — and a quiet typed placeholder when a visual work
 * has no picture. Text-only work never becomes a stand-in photograph.
 */
export type WorkForm = "text" | "audio" | "video" | "carousel" | "image" | "placeholder";
export function workForm(w: Pick<PublicCard, "experience" | "coverUrl" | "excerpt">): WorkForm {
  if (w.experience === "read" && (!w.coverUrl || w.excerpt)) return "text";
  if (w.experience === "listen") return "audio";
  if (!w.coverUrl) return "placeholder";
  if (w.experience === "watch") return "video";
  if (w.experience === "swipe") return "carousel";
  return "image";
}

export type MomentFace = "photo" | "quote" | "link" | "note";
export function momentFaceOf(m: { body: string; imageUrl: string | null }): MomentFace {
  if (m.imageUrl) return "photo";
  if (/^\s*["“'‘][\s\S]+["”'’]/.test(m.body)) return "quote";
  if (/^https?:\/\/\S+$/i.test(m.body.trim())) return "link";
  return "note";
}
