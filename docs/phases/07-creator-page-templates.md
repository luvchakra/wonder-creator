# Wonder Creator — Creator Page Template System
## Full Implementation Specification with Supplied High-Resolution SVG Assets

**Status:** Ready for Claude Code implementation  
**Scope:** Full Creator Page template feature  
**Primary surfaces:** In-app Profile → Creator Page management → Public Creator Page  
**Template count:** 5  
**Asset assumption:** The high-resolution SVG assets derived from the approved template/mockup boards have already been supplied to Claude and are available in the repository/workspace.  
**Critical rule:** Treat those supplied SVG assets as authoritative design assets. Reuse them. Do not redraw, regenerate, approximate, or replace them with generic CSS illustrations unless an asset is genuinely missing.

---

# 1. Objective

Implement a complete **Creator Page template system** that lets each creator choose one of five curated public-page styles while preserving one shared canonical Creator Page data model.

The five templates are:

1. **Immersive Artistic Hero**
2. **Minimal Editorial Paper**
3. **Cinematic Dark**
4. **Creative Collage**
5. **Soft Gradient & Minimal**

The creator should be able to:

- preview all five templates using their own public content;
- choose one template;
- switch templates without losing content;
- keep template-specific presentation settings;
- curate which Creator Page sections are visible;
- preview mobile and desktop;
- publish/update the public page;
- use the supplied SVG asset library throughout the templates;
- render mixed content types correctly;
- keep the public page distinct from Home and in-app Profile.

The core principle is:

> **One creative identity. Five visual lenses.**

The feature must remain curated and opinionated.

Do **not** turn Creator Page into a website builder.

---

# 2. Product boundaries

## Creator Page

Creator Page is:

> The creator’s intentionally curated public home.

It may show:

- identity;
- public bio;
- selected Creations;
- featured Creation;
- public DejaVu;
- public Moments;
- selected Scrapbook content;
- About;
- Open to;
- optional Community/public collaboration context.

It should answer:

> **What does this creator want the outside world to see?**

## Profile

In-app Profile is:

> The creator’s identity inside Wonder Creator.

It may contain private/internal information that should not automatically appear publicly.

## Home

Home is:

> What matters to the creator right now.

It is dynamic and context-aware.

Creator Page must not copy Home behavior.

---

# 3. Design philosophy

The Creator Page template system must follow these rules:

1. **Public work first.**
2. **No likes/follower-driven design.**
3. **No infinite social feed.**
4. **No dashboard feel.**
5. **Mixed media must look native to its actual type.**
6. **DejaVu should feel like recurring creative threads, not tags.**
7. **Moments should look different from Creations.**
8. **Templates should be visually distinct but structurally compatible.**
9. **Supplied SVG assets should create the personality of each template.**
10. **Template switching must never alter the underlying public content.**

---

# 4. Required template IDs

Use stable machine IDs.

```ts
export type CreatorPageTemplateId =
  | "immersive_artistic"
  | "minimal_editorial"
  | "cinematic_dark"
  | "creative_collage"
  | "soft_gradient";
```

Never persist human-readable labels as IDs.

---

# 5. Asset strategy

The implementation assumes Claude already has access to the supplied high-resolution SVG assets created from the approved asset boards.

These assets include visual families such as:

- watercolor washes;
- botanical corner arrangements;
- slim botanical branches;
- artist palette motif;
- gradient blobs;
- watercolor blobs;
- paper textures;
- torn paper strips;
- tape pieces;
- handwritten note graphics;
- ink scribbles;
- grain overlays;
- shadow backdrops;
- light-leak overlays;
- cloud/mist overlays;
- immersive scenic hero backgrounds;
- dark cinematic backgrounds;
- collage boards;
- soft gradient backgrounds;
- decorative flourishes.

## 5.1 Do not hardcode filenames throughout components

Create a central asset registry.

Example:

```ts
export type CreatorPageAssetKey =
  | "immersive.hero.primary"
  | "immersive.hero.overlay"
  | "editorial.paper.background"
  | "editorial.botanical.corner"
  | "cinematic.background"
  | "cinematic.lightLeak"
  | "collage.paperBoard"
  | "collage.tape.light"
  | "collage.tape.dark"
  | "collage.tornPaper"
  | "collage.handwrittenNote"
  | "gradient.background"
  | "gradient.blob"
  | "shared.watercolor.lavender"
  | "shared.watercolor.peach"
  | "shared.botanical.cornerA"
  | "shared.botanical.cornerB"
  | "shared.botanical.branch"
  | "shared.paletteMotif"
  | "shared.inkScribble"
  | "shared.grain"
  | "shared.cloudMist"
  | "shared.shadowBackdrop";
```

Then map actual supplied SVG files once:

```ts
export const creatorPageAssets: Record<CreatorPageAssetKey, string> = {
  "immersive.hero.primary": "/assets/creator-page/...",
  ...
};
```

### Claude Code instruction

Before wiring templates:

1. inspect the supplied SVG asset directory;
2. identify the actual filenames;
3. build the registry from those real files;
4. do not invent placeholder paths if the asset exists;
5. if one asset cannot be found, log it clearly as a missing dependency and use a neutral non-decorative fallback only for that asset.

---

# 6. SVG rendering rules

Use SVGs as actual scalable assets.

Prefer:

```tsx
<img src={assetUrl} alt="" aria-hidden />
```

or framework equivalent for decorative SVGs.

Use inline SVG only if runtime color/theme manipulation is required.

Rules:

- decorative SVGs must use `aria-hidden="true"`;
- important content must not exist only inside decorative SVG text;
- avoid rasterizing supplied SVGs;
- preserve vector fidelity;
- do not mutate source SVG files at runtime;
- allow cropping/positioning through wrappers;
- use `object-fit`, masks, gradients, and CSS composition rather than redrawing.

For large hero SVGs:

- lazy-load below-fold variants;
- preload only current template hero;
- use responsive sizing;
- prevent layout shift with explicit aspect ratio or container height.

---

# 7. Shared Creator Page domain model

All five templates consume the same canonical data.

Suggested contract:

```ts
export interface PublicCreatorPageData {
  creator: {
    id: string;
    displayName: string;
    handle?: string;

    avatarUrl?: string;
    coverUrl?: string;

    roles?: string[];
    shortBio?: string;
    longBio?: string;

    location?: string;
    websiteUrl?: string;

    openTo?: string[];
    collaborationStyle?: string;

    publicLinks?: PublicLink[];
  };

  featuredCreation?: PublishedCreationCard | null;

  selectedCreations: PublishedCreationCard[];

  publicMoments: PublicMomentCard[];

  publicDejaVus: PublicDejaVuCard[];

  scrapbookHighlights?: PublicScrapbookCard[];

  communityPresence?: PublicCommunitySummary | null;

  currentFocus?: {
    title?: string;
    body?: string;
  };

  creatorPage: {
    activeTemplateId: CreatorPageTemplateId;
    sectionVisibility: CreatorPageSectionVisibility;
    sectionOrder: CreatorPageSectionKey[];
    templateSettings: CreatorPageTemplateSettings;
    published: boolean;
    publicSlug?: string;
  };
}
```

---

# 8. Creator Page section model

Use a constrained section set.

```ts
export type CreatorPageSectionKey =
  | "identity"
  | "dejavu"
  | "featured"
  | "creations"
  | "moments"
  | "scrapbook"
  | "about"
  | "open_to"
  | "community";
```

Recommended default order:

```text
identity
dejavu
featured
creations
moments
about
open_to
```

Optional:

```text
scrapbook
community
```

Do not render empty sections.

Do not show:

```text
0 pieces
0 creations
0 moments
```

on the public page unless there is a strong product reason.

Empty public DejaVus should be hidden by default.

---

# 9. Template registry

Do not scatter template branching through the app.

Create a registry.

```ts
export interface CreatorPageTemplateDefinition {
  id: CreatorPageTemplateId;

  name: string;
  description: string;

  previewAsset?: string;

  supportedSections: CreatorPageSectionKey[];

  defaultSectionOrder: CreatorPageSectionKey[];

  defaultSettings: Record<string, unknown>;

  Renderer: React.ComponentType<CreatorPageTemplateProps>;
}
```

Example:

```ts
export const creatorPageTemplates: Record<
  CreatorPageTemplateId,
  CreatorPageTemplateDefinition
> = {
  immersive_artistic: immersiveArtisticTemplate,
  minimal_editorial: minimalEditorialTemplate,
  cinematic_dark: cinematicDarkTemplate,
  creative_collage: creativeCollageTemplate,
  soft_gradient: softGradientTemplate,
};
```

---

# 10. Shared renderer contract

Every template receives the same high-level props.

```ts
export interface CreatorPageTemplateProps {
  data: PublicCreatorPageData;

  mode: "public" | "preview";

  viewport: "mobile" | "desktop";

  isOwner?: boolean;

  onOpenCreation?: (creationId: string) => void;
  onOpenMoment?: (momentId: string) => void;
  onOpenDejaVu?: (dejavuId: string) => void;
}
```

Templates own presentation.

They do not own:

- fetching;
- permissions;
- rights;
- publication state;
- data mutations;
- analytics schema.

---

# 11. Shared content components

Build reusable content primitives.

Suggested:

```text
CreatorIdentity
CreatorShortBio
CreatorOpenTo
CreatorAbout
CreatorCurrentFocus

DejaVuCard
DejaVuRow
DejaVuMosaic

CreationCard
CreationHero
CreationMiniCard

MomentCard
MomentTextCard
MomentVoiceCard
MomentPhotoCard
MomentQuoteCard
MomentLinkCard
MomentPlaceCard

ScrapbookPreview
CommunityPresenceCard
PublicLinkList
```

Templates may style these differently but should not duplicate data logic.

---

# 12. Mixed Creation rendering

Critical requirement:

> Most things should not be forced into photograph cards.

Supported Creation representations:

```text
Poem
Essay
Story
Carousel
Poster
Video
Audio
Spoken word
Photo essay
Mixed media
Visual story
Illustration
```

## 12.1 Poem / text work

Use:

- typography;
- paper/text treatment;
- short excerpt;
- optional cover art.

If no cover exists, generate a **typographic card**, not a fake photograph.

## 12.2 Audio

Use:

- waveform;
- artwork if available;
- duration;
- play icon.

## 12.3 Video

Use:

- poster frame;
- duration;
- play cue.

## 12.4 Carousel

Use:

- first slide or intentional cover;
- slide count.

## 12.5 Essay / Story

Use:

- cover if available;
- otherwise typographic/editorial card.

## 12.6 Mixed media

Use:

- representative cover;
- subtle multi-source cue if available.

---

# 13. Moment rendering

Moment cards must be type-aware.

Supported examples:

### Text note

```text
“Something I wrote today…”
Text Moment · 27 Sep
```

### Voice note

```text
[ waveform ]
Morning thought · 1:32
```

### Photo

```text
[ image ]
Morning light in my garden
```

### Quote

```text
“Same sky, different chapter.”
```

### Link

```text
The Art of Slowness
Link
```

### Place

```text
Prinsep Ghat
Kolkata
```

### Sketch

Use the sketch preview if available.

Do not fabricate visual artwork for text-only content.

---

# 14. DejaVu rendering

DejaVu is a recurring creative thread.

Each public DejaVu should show:

- name;
- representative preview;
- public Moment count;
- optional short description.

Possible visual treatments:

- image preview;
- gradient card;
- paper tile;
- collage;
- icon + label.

Template-specific presentation is encouraged.

---

# 15. Template 1 — Immersive Artistic Hero

## Design goal

Emotional, painterly, personality-first.

Use the supplied immersive scenic SVG assets prominently.

## Recommended assets

Map actual supplied files into:

```text
immersive.hero.primary
shared.cloudMist
shared.watercolor.peach
shared.watercolor.lavender
shared.botanical.cornerA
shared.botanical.branch
shared.inkScribble
```

## Layout

```text
full immersive hero
↓
avatar + identity overlay
↓
short creator statement
↓
DejaVu
↓
Featured Creation
↓
Moments
↓
About
↓
Open to
```

## Visual rules

- hero may use 32–40vh on mobile;
- identity may overlap lower hero edge;
- use handwriting only as accent;
- keep body text in primary UI/editorial fonts;
- allow translucent surfaces over artwork;
- avoid excessive cards;
- featured Creation should feel prominent.

## Template settings

```ts
interface ImmersiveArtisticSettings {
  heroSource: "creator_cover" | "template_art";
  heroContrast: "soft" | "balanced";
  handwrittenAccent: boolean;
  contentDensity: "compact" | "comfortable";
}
```

---

# 16. Template 2 — Minimal Editorial Paper

## Design goal

Quiet, literary, timeless.

Use supplied paper SVG assets and botanical edge accents.

## Recommended assets

```text
editorial.paper.background
editorial.botanical.corner
shared.botanical.branch
shared.inkScribble
shared.grain
```

## Layout

```text
name + identity
↓
short statement
↓
DejaVu
↓
Featured
↓
Creations
↓
Moments
↓
About
↓
Open to
```

## Visual rules

- editorial serif title;
- flat sections;
- very few pills;
- thin separators;
- restrained botanical SVGs;
- paper texture should remain subtle;
- avoid rounded-card overload.

## Settings

```ts
interface MinimalEditorialSettings {
  paperTone: "warm" | "neutral";
  headingStyle: "serif" | "mixed";
  showCoverImage: boolean;
  botanicalAccent: "none" | "subtle";
}
```

---

# 17. Template 3 — Cinematic Dark

## Design goal

Moody, immersive, dramatic.

Best for film, photography, music, spoken word, night work.

## Recommended assets

```text
cinematic.background
cinematic.lightLeak
shared.grain
shared.shadowBackdrop
```

## Layout

```text
dark hero / cover
↓
creator identity
↓
compact creator summary
↓
DejaVu
↓
Featured
↓
Moments
↓
About
↓
Open to
```

## Visual rules

- near-black/charcoal page base;
- large visual media;
- amber/warm highlights;
- cards should be darker surfaces, not white cards;
- fewer decorative assets;
- text density low;
- video/audio can feel native.

## Settings

```ts
interface CinematicDarkSettings {
  accentMode: "warm" | "cool";
  heroContrast: "soft" | "strong";
  mediaDensity: "large" | "balanced";
}
```

---

# 18. Template 4 — Creative Collage

## Design goal

Handmade, mixed-media, layered, expressive.

## Recommended assets

```text
collage.paperBoard
collage.tape.light
collage.tape.dark
collage.tornPaper
collage.handwrittenNote
shared.botanical.branch
shared.inkScribble
shared.watercolor.peach
```

## Layout

```text
collage identity hero
↓
DejaVu mosaic
↓
Featured
↓
Creations collage
↓
Moments
↓
About
↓
Open to
```

## Visual rules

- controlled overlap only;
- small rotations only;
- tape/paper assets used sparingly;
- text notes may render as paper slips;
- voice notes may render as waveform slips;
- mixed content should visually coexist;
- preserve readability.

## Settings

```ts
interface CreativeCollageSettings {
  collageIntensity: "light" | "medium";
  handwritingAccent: boolean;
  paperTexture: boolean;
}
```

---

# 19. Template 5 — Soft Gradient & Minimal

## Design goal

Modern, airy, flexible, broadly usable.

## Recommended assets

```text
gradient.background
gradient.blob
shared.botanical.branch
shared.watercolor.lavender
shared.watercolor.peach
```

## Layout

```text
compact identity
↓
DejaVu
↓
Featured
↓
Moments
↓
About
↓
Open to
```

## Visual rules

- most compact option;
- clean whitespace;
- pastel gradient background;
- minimal decoration;
- rounded cards;
- excellent default for mixed media;
- simple scanning hierarchy.

## Settings

```ts
interface SoftGradientSettings {
  gradientPreset: "lavender" | "peach" | "sky";
  compactness: "compact" | "standard";
  cardStyle: "soft" | "minimal";
}
```

---

# 20. Template selector

Entry point from own Profile:

```text
Profile
→ Creator Page
```

Do not place Creator Page as a top navigation tab.

Recommended management screen:

```text
Creator Page

[ Preview page ]

Appearance
Current: Minimal Editorial Paper

[ Choose template ]

Public content
Featured Creation
Selected Creations
DejaVu
Moments
About
Open to

Visibility
Public

[ Preview ]
[ Publish changes ]
```

---

# 21. Template picker UI

Show all five templates with visual thumbnails.

```text
Choose your Creator Page style

Immersive Artistic
Expressive and image-led.

Minimal Editorial
Calm and literary.

Cinematic Dark
Moody and atmospheric.

Creative Collage
Handmade and mixed-media.

Soft Gradient
Modern and airy.
```

Each card must include:

- preview image;
- template name;
- one-line character description;
- Preview action;
- selected state.

Do not show technical template IDs.

---

# 22. Live preview

Preview should use the creator’s actual public data.

Controls:

```text
[ Mobile ] [ Desktop ]

Template: Creative Collage

[ Use this template ]
```

Rules:

- preview selection is temporary;
- `Use this template` persists;
- preview must not publish automatically;
- switching templates must preserve content;
- show sparse state correctly.

---

# 23. Template-specific settings UI

Only expose settings supported by current template.

Example:

```text
Appearance

Creative Collage

Collage style
[ Light ] [ Medium ]

Handwritten accents
[ On ]

Paper texture
[ On ]
```

Do not show advanced design tokens.

No arbitrary:

- colors;
- CSS;
- margins;
- font sizes;
- absolute element positions.

---

# 24. Section visibility

Creator may control:

```text
Featured
Creations
DejaVu
Moments
Scrapbook
About
Open to
Community
```

Use simple toggles.

Do not allow hiding identity.

`identity` is mandatory.

---

# 25. Section ordering

Allow only limited reorder.

Suggested:

```text
Featured
DejaVu
Creations
Moments
Scrapbook
About
Open to
Community
```

Use drag handle or move up/down.

However:

- identity always first;
- About/Open to should not appear above identity;
- prevent structurally broken combinations.

---

# 26. Public Creator Page routing

Use stable Creator Page URLs.

Conceptual:

```text
/creator/:creatorSlug
```

Example:

```text
wondercreator.com/kunal
```

Do not encode template ID in public URL.

Template switching must not change URL.

---

# 27. Public rendering architecture

Suggested:

```tsx
function PublicCreatorPage({ data }: Props) {
  const template = creatorPageTemplates[data.creatorPage.activeTemplateId];

  return (
    <CreatorPagePublicShell>
      <template.Renderer
        data={data}
        mode="public"
        viewport={resolvedViewport}
      />
    </CreatorPagePublicShell>
  );
}
```

Public shell owns:

- metadata;
- canonical URL;
- analytics;
- error boundary;
- accessibility baseline;
- public permissions;
- page-level loading.

Template owns the visual composition.

---

# 28. Owner preview architecture

Do not use a separate fake preview implementation.

Use the same renderer:

```tsx
<template.Renderer
  data={previewData}
  mode="preview"
  viewport="mobile"
/>
```

This ensures public and preview remain identical.

---

# 29. Persistence model

Suggested:

```ts
export interface CreatorPageAppearance {
  creatorId: string;

  activeTemplateId: CreatorPageTemplateId;

  settingsByTemplate: {
    immersive_artistic?: ImmersiveArtisticSettings;
    minimal_editorial?: MinimalEditorialSettings;
    cinematic_dark?: CinematicDarkSettings;
    creative_collage?: CreativeCollageSettings;
    soft_gradient?: SoftGradientSettings;
  };

  sectionVisibility: CreatorPageSectionVisibility;

  sectionOrder: CreatorPageSectionKey[];

  updatedAt: string;
}
```

Keep settings per template so users can switch away and back without losing previous preferences.

---

# 30. Suggested API

Adapt naming to repository patterns.

```text
GET   /creator-page
PATCH /creator-page

GET   /creator-page/appearance
PATCH /creator-page/appearance

POST  /creator-page/template/:templateId/activate

GET   /creator-page/preview
POST  /creator-page/publish

GET   /public/creator/:creatorSlug
```

The public endpoint returns only publication-safe data.

---

# 31. Publication-safe data

Do not expose private Profile fields.

Public Creator Page DTO must be assembled server-side.

Examples of private/internal fields that should not leak automatically:

- internal collaboration notes;
- private DejaVus;
- private Moments;
- unpublished Creations;
- drafts;
- email;
- phone;
- connected-source metadata;
- sync status;
- private Projects;
- internal analytics.

The Creator Page is explicitly curated.

---

# 32. Creator Page action placement

In own Profile:

```text
Edit Profile
Creator Page
```

or:

```text
...
Creator Page
Share Profile
Settings
```

Preferred:

- Creator Page appears near identity actions;
- it is not a topmost navigation tab;
- it is secondary to the in-app Profile itself.

On public pages, do not show management controls to non-owners.

Owner may get:

```text
Previewing your page
[ Edit Creator Page ]
```

in a subtle owner-only overlay.

---

# 33. Responsive behavior

All five templates must have intentional desktop versions.

Do not simply stretch mobile cards.

## Immersive Artistic

Desktop:

- wide hero;
- creator identity may sit over lower hero edge;
- sections may use 2-column compositions.

## Minimal Editorial

Desktop:

- centered editorial reading column;
- wide whitespace;
- stronger typographic hierarchy.

## Cinematic Dark

Desktop:

- wide visual stage;
- large media;
- dark atmospheric background.

## Creative Collage

Desktop:

- controlled asymmetric collage;
- more horizontal composition;
- no chaotic absolute positioning.

## Soft Gradient

Desktop:

- clean centered grid;
- 2–3 column content where appropriate.

---

# 34. Asset composition rules by template

## Immersive Artistic

Maximum recommended decorative layers above base:

```text
hero SVG
+ one watercolor wash
+ one botanical accent
+ optional cloud/mist overlay
```

## Minimal Editorial

```text
paper background
+ one botanical corner
+ optional ink accent
```

## Cinematic Dark

```text
dark background
+ grain
+ optional light leak
```

## Creative Collage

```text
paper board
+ 2–4 tape/paper accents
+ one note/ink element
```

## Soft Gradient

```text
gradient background
+ one translucent blob
+ optional small botanical branch
```

Do not stack every supplied asset onto every template.

The asset library exists to support restraint, not decoration overload.

---

# 35. Brand asset rules

The supplied Wonder Creator logo/brand assets are authoritative.

Do not redraw them.

If current production branding assets already exist in the repository, use those.

The template system should never replace the main brand identity with generated typography.

Template assets are decorative/presentational only.

---

# 36. Typography

Use current Wonder Creator typography stack.

Recommended:

- **Inter** for UI/body;
- **Playfair Display** or current editorial serif for large public headings where already approved.

Template-specific emphasis:

```text
Immersive Artistic → mixed serif + subtle handwritten SVG accent
Minimal Editorial → serif-forward
Cinematic Dark → elegant high-contrast heading + clean sans
Creative Collage → editorial serif + handwritten SVG accents
Soft Gradient → clean modern sans + restrained serif headings
```

Do not use handwritten text for important accessibility-critical content.

---

# 37. Motion

Keep motion restrained.

Recommended:

- page transition: <= 280ms;
- content fade: 120–160ms;
- no parallax by default;
- no continuous floating decorations;
- no bounce;
- no decorative animation loops.

Support reduced motion.

---

# 38. Accessibility

All templates must meet a shared accessibility baseline.

Required:

- semantic heading hierarchy;
- sufficient contrast;
- keyboard focus states;
- accessible links/buttons;
- alt text for meaningful images;
- decorative SVGs hidden from screen readers;
- no text embedded only in SVG where it carries meaning;
- no information communicated only by color;
- dark template tested for contrast;
- collage reading order must remain logical in DOM;
- text remains selectable.

---

# 39. Performance

Public pages should be fast.

Requirements:

- only load assets for active template;
- dynamically import template bundles if useful;
- do not preload all five template asset sets on public page;
- responsive images;
- lazy-load below-the-fold thumbnails;
- cache public Creator Page payload;
- CDN-cache supplied SVG assets;
- avoid JS-based decorative effects;
- prefer CSS composition;
- keep DOM reasonable;
- no giant SVG sprite containing all unused artwork.

Suggested:

```ts
const TemplateRenderer = lazy(() =>
  import(`./templates/${templateId}/Renderer`)
);
```

Use a safer explicit import map if bundler requires it.

---

# 40. Template preview performance

Template picker should not mount five full public pages at once.

Use:

- static preview thumbnails for picker cards;
- mount only the selected live preview;
- reuse shared public data;
- lazy-load selected template assets.

---

# 41. Sparse-state behavior

A new creator may have:

- no DejaVu;
- one Creation;
- one Moment;
- no Scrapbook;
- no Community presence.

Each template must collapse gracefully.

Example:

```text
Identity

Featured Creation

About

Open to
```

Do not show empty section headings.

Do not substitute fake demo content.

---

# 42. Data loading states

Use subtle skeletons.

Avoid replacing SVG-decorated layouts with giant generic grey blocks.

Suggested:

- identity skeleton;
- creation-card skeleton;
- moment-row skeleton.

Decorative background can load immediately if locally cached.

---

# 43. Error behavior

If one decorative SVG fails:

- continue rendering;
- omit that decorative layer;
- do not break page.

If a content image fails:

- show type-aware neutral fallback.

Examples:

- poem → text card;
- audio → waveform placeholder;
- Creation → type label + title;
- Moment → type icon.

---

# 44. Testing matrix

Test each template with these content profiles:

## A. Visual-heavy creator

- photographs;
- visual stories;
- carousel;
- DejaVu with images.

## B. Writer/poet

- no cover images;
- poems;
- essays;
- text Moments.

## C. Audio creator

- spoken word;
- audio;
- voice Moments.

## D. Mixed creator

- writing;
- illustration;
- video;
- carousel;
- audio;
- notes.

## E. Sparse creator

- one Creation;
- no DejaVu;
- no public Moments.

## F. Rich creator

- 20+ public Creations;
- multiple DejaVus;
- many Moments.

---

# 45. Unit tests

At minimum:

- template registry resolves all IDs;
- unknown template safely falls back;
- settings validation;
- section visibility;
- section ordering constraints;
- empty sections suppressed;
- mixed content card selection;
- asset registry resolves expected keys;
- per-template settings persist.

---

# 46. Integration tests

Test:

```text
Profile → Creator Page
Creator Page → Choose template
Choose template → Preview
Preview → Use template
Use template → Publish
Public URL → correct renderer
Switch template → same content, new presentation
Switch back → previous settings restored
```

Also:

- private data not exposed;
- unpublished Creation not visible;
- public Moment filtering works;
- DejaVu only shows public Moments.

---

# 47. Visual regression tests

Create screenshots for:

```text
5 templates
× mobile
× desktop
× rich content
× sparse content
```

Minimum 20 baseline screenshots.

Additionally test:

- dark mode template contrast;
- long creator name;
- long Creation titles;
- no avatar;
- no cover;
- non-Latin titles;
- image-less poem;
- audio-only Creation.

---

# 48. Recommended repository structure

Adapt to current repo conventions.

Conceptually:

```text
creator-page/
  components/
    CreatorIdentity.tsx
    CreatorOpenTo.tsx
    DejaVuCard.tsx
    CreationCard.tsx
    MomentCard.tsx
    ...

  templates/
    immersive-artistic/
      Renderer.tsx
      styles.ts
      config.ts

    minimal-editorial/
      Renderer.tsx
      styles.ts
      config.ts

    cinematic-dark/
      Renderer.tsx
      styles.ts
      config.ts

    creative-collage/
      Renderer.tsx
      styles.ts
      config.ts

    soft-gradient/
      Renderer.tsx
      styles.ts
      config.ts

  assets/
    registry.ts

  templateRegistry.ts
  types.ts
  validation.ts

  management/
    CreatorPageSettings.tsx
    TemplatePicker.tsx
    TemplatePreview.tsx
    SectionVisibility.tsx
```

Do not duplicate content-fetch logic under each template.

---

# 49. Implementation sequence

## Phase 1 — Asset audit

- inspect supplied SVG artifacts;
- create asset registry;
- map approved files;
- verify mobile/desktop suitability;
- identify missing dependencies.

## Phase 2 — Template foundation

- types;
- registry;
- shared public DTO;
- public shell;
- appearance persistence;
- section visibility/order.

## Phase 3 — Template picker

- five preview cards;
- live preview;
- mobile/desktop toggle;
- temporary preview state;
- activate template.

## Phase 4 — Implement simple templates

First:

1. Minimal Editorial Paper
2. Soft Gradient & Minimal

Validate:

- mixed Creation types;
- Moments;
- DejaVu;
- sparse state.

## Phase 5 — Implement expressive templates

3. Immersive Artistic Hero  
4. Cinematic Dark  
5. Creative Collage

Use supplied SVG assets.

## Phase 6 — Management

- Creator Page settings screen;
- section visibility;
- limited ordering;
- per-template settings;
- publish/update flow.

## Phase 7 — Responsive + accessibility

- desktop compositions;
- keyboard navigation;
- contrast;
- alt behavior;
- motion reduction.

## Phase 8 — performance + regression

- lazy load;
- asset caching;
- visual regression suite;
- public-page performance audit.

---

# 50. Acceptance criteria

The implementation is complete when:

- [ ] all five approved templates are selectable;
- [ ] supplied high-resolution SVG assets are integrated through a central registry;
- [ ] Claude has not redrawn/recreated supplied production assets;
- [ ] template switching does not alter public content;
- [ ] template-specific settings persist independently;
- [ ] live preview uses actual creator content;
- [ ] mobile and desktop previews work;
- [ ] public Creator Page URL remains stable across template changes;
- [ ] identity remains mandatory;
- [ ] empty sections are omitted;
- [ ] mixed Creation types render appropriately;
- [ ] text-only work does not become fake photography;
- [ ] audio uses waveform/artwork treatment;
- [ ] video uses poster/play treatment;
- [ ] carousel shows slide-count-aware preview;
- [ ] Moments are type-aware;
- [ ] DejaVu is compact and expressive;
- [ ] no likes/follower emphasis exists;
- [ ] no infinite feed exists;
- [ ] no drag-and-drop website builder exists;
- [ ] private Profile data does not leak publicly;
- [ ] public page is responsive;
- [ ] public page is accessible;
- [ ] public page loads only the active template asset bundle;
- [ ] visual regression coverage exists for all templates.

---

# 51. Claude Code implementation instruction block

Use this as the execution instruction:

```text
Implement the Wonder Creator Creator Page template feature according to this specification.

Important:
1. The approved high-resolution SVG artifacts are already available in the repository/workspace.
2. Inspect those SVG assets first and build a central asset registry using their real filenames.
3. Reuse supplied production assets. Do not redraw, regenerate, or substitute them unless a required asset is genuinely missing.
4. Preserve existing domain ownership and public Creator Page data.
5. Do not duplicate Creator Page content per template.
6. Implement the five templates as visual renderers over one shared data contract.
7. Mixed content must remain type-aware: text, audio, video, carousel, illustration, photo, mixed media, and Moments must not all become photo cards.
8. Do not introduce likes, follower counts, engagement feeds, or a website-builder experience.
9. Creator Page must remain distinct from Home and in-app Profile.
10. Use the current Wonder Creator design system, existing routing, auth, persistence, publishing, accessibility, and testing conventions wherever available.
11. If the repository implementation differs from assumptions in this document, adapt to existing architecture rather than creating parallel systems.
12. Record any missing SVG assets or unsupported data dependencies clearly instead of silently inventing replacements.
13. Complete the work in the phased order described in this spec.
14. Add automated tests and visual regression coverage before declaring the feature complete.
```

---

# 52. Final design principle

The Creator Page template feature should feel like choosing how a creative identity is **expressed**, not building a website.

The underlying creator remains the same.

The Creations remain the same.

The Moments remain the same.

The DejaVus remain the same.

Only the presentation changes.

> **One Creator Page. Five distinct artistic expressions.**
