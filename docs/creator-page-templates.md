# Creator Page templates — implementation contract

Owner spec: [`phases/07-creator-page-templates.md`](phases/07-creator-page-templates.md) (30 Sep 2026). Reference board:
[`ui-redesign/boards/creator-page-templates-2026-09-30.png`](ui-redesign/boards/creator-page-templates-2026-09-30.png).
Builds on CreatorPublish ([`creator-publish.md`](creator-publish.md)): the same curated Creator Page, now drawn through one
of five templates. **One creative identity. Five visual lenses.**

## Model

* `creator_pages.template_id` (`immersive_artistic` · `minimal_editorial` · `cinematic_dark` · `creative_collage` ·
  `soft_gradient`, default `soft_gradient`) and `creator_pages.template_settings` (per template:
  `{ "cinematic_dark": { … }, … }`), migration `…066`. Presentation only: switching never changes content or the address
  (`/p/<handle>`).
* `@wonder/creator-studio/creator-page` (client-safe): ids, names, the settings each template offers
  (`TEMPLATE_SETTINGS` — choices and toggles only; no colours, fonts, margins or positions), `settingsFor` (defaults +
  valid stored values), `validateSettings`, `mergeTemplateSettings` (other templates' settings untouched),
  `resolveTemplateId` (unknown → default), `normalizeSections` (spec default order: DejaVu, Featured, Creations, Moments,
  About, Open to; then Links, Community off), `visibleSections` (on and non-empty only).
* Saved through the existing `PATCH /api/v1/creator-page` (`templateId`, `templateSettings: { template, settings }`).

## Data

* `app.creator_page_payload(creator)` builds the publication-safe payload once. `public_creator_page(handle)` returns
  it when the page is published; `creator_page_preview()` returns the signed-in owner's own, published or not — so
  preview and public can't differ. Cards carry an `excerpt` (text work) and `poem`; DejaVus carry a representative
  `coverObjectId` from public items only; the creator carries up to four `roles` (their crafts). Private Profile fields,
  private Moments and unpublished work never enter the payload.

## Rendering (`apps/web/src/components/creator-page/`)

* `assets.tsx` — the asset registry: keys (`immersive.hero.primary`, `editorial.paper.background`,
  `cinematic.lightLeak`, `collage.tape`, `gradient.blob`, `shared.botanical.branch`, …) map to the Creator Page background
  library (`brand/creator-page.ts`) and the owner-supplied Kit/watercolour art. Full backgrounds use their AVIF/WebP
  renders; decorations are vector. Templates never name files.
* `model.ts` — `pageModel` (order, empty sections dropped, empty DejaVus hidden, Links folded into About, featured =
  starred work, counts only when > 0) and `workForm` (text → typography, audio → waveform, video → poster + play,
  carousel → first slide + count, image, else a typed placeholder — never a stand-in photograph).
* `parts.tsx` — shared primitives (`WorkVisual`, `WorkTile`, `FeaturedWork`, `DejaVuTile`, `MomentRow`, `MomentSlip`,
  `AboutBlock`, `OpenToChips`, `Identity`, `Counts`, `Sections`) with four tones (light, paper, dark, glass).
* `templates/*` — five renderers over the same props; each keeps to its layer budget (spec §34).
* `registry.tsx` — `TEMPLATE_RENDERERS` and `CreatorPageView`, used by both the public page and the owner's preview.
  Layout follows the container's width (container queries), so the preview's phone and desktop frames are exact. Only
  the active template renders, so only its art loads.

## Management

`/creator-page` (Profile → Creator Page) opens with **Appearance**: five style cards (thumbnail, name, one line, In use),
a live preview of the owner's real content in a phone or desktop frame (the preview is inert; picking a card never
publishes), **Use this template**, and only the chosen template's settings (autosaved). Sections, featured work,
DejaVus, Moments and links are edited below as before. The owner sees "Previewing your page · Edit Creator Page" on
their public page; nobody else does.

## Not yet

Scrapbook as a separate section (public Moments are Scrapbook entries today), Place and voice Moments on the public page
(the payload carries words and pictures only), a creator-uploaded cover for the Immersive hero ("Your featured work" is
used), and pixel-diff visual baselines (screenshots are attached to every run instead — see Tests).

## Tests

`creator-page-templates.test.ts` (ids, fallback, settings, per-template retention, sections), `model.test.ts`
(type-aware forms, sparse collapse, empty DejaVus, links), `assets.test.ts` (every key resolves to real files),
`tests/db/creator-publish.test.ts` (template persistence, public payload has no private fields, owner-only preview),
`e2e/creator-page-templates.spec.ts` (Profile → Creator Page → preview → use → publish → same URL → switch back restores
settings; and 5 templates × phone/desktop × rich/sparse with invariants — no sideways scroll, no empty sections, no zero
counts, no popularity — and a screenshot attached per combination).
