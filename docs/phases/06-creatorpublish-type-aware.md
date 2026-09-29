# Wonder Creator — CreatorPublish
## Public Home + Type-Aware Published Work

**Status:** Product / UX / implementation specification  
**Scope:** CreatorPublish maturation  
**Primary principle:** Publish beautifully to the web first; social platforms become optional distribution channels later.

---

# 1. Product direction

CreatorPublish should mature from a social-platform connector into a first-class Wonder Creator publishing surface.

The core idea:

> **Do not publish out first. Publish into your own beautiful space, then share the link anywhere.**

CreatorPublish should give every creator:

1. a curated public home;
2. beautiful standalone pages for individual Creations;
3. type-aware presentation for different kinds of work;
4. optional public DejaVu, Moments, Projects, and Conversations;
5. stable shareable URLs;
6. visibility, rights, attribution, and revision controls;
7. lightweight analytics;
8. rich link previews for sharing elsewhere.

CreatorPublish is **not** a generic website builder.

The creator chooses what to show and how prominently. Wonder Creator handles most layout, typography, responsiveness, and presentation quality.

---

# 2. Public publishing model

There are two major public surfaces.

## 2.1 Creator Page

Internal/product architecture term:

`Creator Page`

Meaning:

> The creator's curated public home.

It may contain:

- profile / short bio;
- featured Creations;
- selected Creations;
- public DejaVus;
- selected public Moments;
- current Projects;
- Open Conversations;
- `Open to…`;
- links.

The Creator Page is about **the person and their creative world**.

It should not expose everything from the in-app Profile automatically.

The creator explicitly curates what the outside world sees.

---

## 2.2 Creation Page

Internal/product architecture term:

`Creation Page`

Meaning:

> A dedicated public experience for one published Creation.

The Creation Page is about **one work**.

The actual public UI should not repeatedly label itself "Creation Page". It should primarily show:

- the Creation title;
- creator;
- the work itself;
- optional context;
- related Moments / DejaVu;
- provenance / credits;
- conversation;
- more from the creator.

This helps avoid the Creator Page / Creation Page naming confusion in the user-facing experience.

---

# 3. One publishing shell, many Creation experiences

Do not design one generic Creation template.

A poem, carousel, short film, photograph, audio piece, photo essay, and mixed-media work should not all be shown as:

```text
large cover
title
description
metadata
```

Instead use a shared outer shell with a type-specific Creation renderer.

Conceptually:

```text
PublishedWorkPage
├── PublicationHeader
├── CreationRenderer          ← type-aware
├── OptionalContext
├── DejaVu / RelatedMoments
├── Rights / Credits / Provenance
├── OptionalConversation
└── MoreFromCreator
```

The rule:

> **The public page should feel designed specifically for the work, even though Wonder Creator generated the experience automatically.**

---

# 4. Experience modes

Creation publishing should be based primarily on **how the audience experiences the work**, not only its file type.

Use six primary experience modes:

| Experience | Typical Creation types |
|---|---|
| **Read** | essay, story, article, poem, lyrics, script |
| **View** | photograph, artwork, illustration, poster |
| **Swipe** | carousel, comic, slide story, visual sequence |
| **Watch** | short film, video, animation |
| **Listen** | song, spoken word, podcast, soundscape |
| **Journey** | photo essay, documentary narrative, mixed-media story |

The Creation still retains its specific domain type.

The experience mode controls the public renderer.

---

# 5. Publication manifest

Avoid large frontend chains of type-specific conditionals.

Each published Creation should expose a publication manifest.

Example:

```ts
type PublicationExperience =
  | "read"
  | "view"
  | "swipe"
  | "watch"
  | "listen"
  | "journey";

interface PublicationManifest {
  experience: PublicationExperience;

  creationType: string;

  aspectRatio?: string;
  preferredTheme?: "light" | "dark" | "paper" | "cinematic";

  allowFullscreen?: boolean;
  allowZoom?: boolean;

  hasText?: boolean;
  hasAudio?: boolean;
  hasVideo?: boolean;
  hasSequence?: boolean;
  hasTranscript?: boolean;
  hasChapters?: boolean;
  hasFragments?: boolean;

  durationSeconds?: number;

  coverAssetId?: string;
  posterAssetId?: string;

  rendererVariant?: string;
}
```

CreatorPublish reads this manifest and selects the correct public renderer.

---

# 6. Creation type: Writing / Story / Essay

## Experience

Primary mode:

`Read`

This should feel like an editorial reading experience, not a document preview.

### Layout principles

- narrow readable measure;
- beautiful typography;
- generous vertical rhythm;
- restrained header;
- optional cover image;
- optional inline media;
- no editor chrome;
- no giant cards around the text.

Example:

```text
Kunal Chakraborty

The Last Platform
A story about waiting.

[ optional cover ]

Sometimes a place remains
inside you long after...

[ beautifully typeset story ]

──────── ◇ ────────

About this
Railways
Waiting
```

### Creator publishing controls

Offer only a few choices:

- cover;
- editorial style;
- light / dark / paper;
- show/hide context;
- optional image placement.

Do not expose:

- arbitrary margins;
- CSS-like font controls;
- column builders;
- complex page layout editing.

---

# 7. Creation type: Poetry

## Experience

Primary mode:

`Read`

Poetry should use a dedicated renderer rather than sharing the standard essay renderer.

The renderer must preserve:

- line breaks;
- stanza spacing;
- intentional indentation where possible;
- alignment;
- title placement.

Example:

```text
चाँद अमावस

चाँद घटते-घटते
अमावस की जेब में जा छुपा है।

आईने के सामने खड़े हो
तो बस एक बेपरवाह दाढ़ी है...

                ◇
```

### Optional voice

If a creator recorded a reading:

```text
▶ Listen · 1:42
```

Playback may subtly follow the poem, but the reading experience should remain dominant.

The page should never look like an audio-player-first page unless the Creation itself is primarily audio.

---

# 8. Creation type: Carousel

## Experience

Primary mode:

`Swipe`

A public carousel should behave like a native visual story.

### Mobile

Near full-screen:

```text
A Life in Moments                  1 / 5

┌────────────────────────────────┐
│                                │
│          current slide         │
│                                │
└────────────────────────────────┘

              ● ○ ○ ○ ○
```

Rules:

- swipe horizontally;
- preserve text overlays;
- preserve crop/focal point;
- preserve slide order;
- preserve typography;
- preserve aspect ratio;
- no editor controls;
- no permanently visible thumbnail rail.

### Desktop

Do not stretch portrait slides across a widescreen browser.

Use an elegant stage:

```text
             A Life in Moments

      ‹    ┌───────────────┐    ›
           │               │
           │    Slide 2    │
           │               │
           └───────────────┘

                   2 / 5
```

Thumbnail navigation may appear only when useful.

### Important

The public renderer should use the composed Creation model where possible.

Do not flatten everything into screenshots if the content can remain:

- selectable;
- accessible;
- responsive;
- searchable;
- semantically structured.

---

# 9. Creation type: Single Photograph / Artwork

## Experience

Primary mode:

`View`

The artwork should dominate the page.

Example:

```text
             [ photograph ]

            Monsoon Window

                 Kunal

             Mumbai · 2026
```

Rules:

- no white content card around the image;
- preserve intended aspect ratio;
- optional fullscreen;
- optional zoom;
- optional dark/light surround;
- minimal metadata;
- context below the work.

If the work belongs to a series, next/previous navigation can be available.

---

# 10. Creation type: Photo Essay

## Experience

Primary mode:

`Journey`

Do **not** default to Carousel.

A photo essay should be a vertical authored narrative.

Example:

```text
Mumbai, Waiting

[ opening photograph ]

introductory passage

[ large photograph ]

short piece of writing

[ photograph ]

[ photo ]           [ photo ]

closing paragraph
```

The mobile version should naturally become a beautiful vertical reading journey.

A photo essay is one Creation, not a generic gallery of source Materials.

---

# 11. Creation type: Short Film / Video

## Experience

Primary mode:

`Watch`

The page should become cinematic.

Example:

```text
────────────────────────────────
             video
             16:9
────────────────────────────────

A Life Between Trains

Kunal Chakraborty
Short film · 4:32

[ Play ]
```

Once playback begins:

- reduce page chrome;
- keep controls minimal;
- preserve aspect ratio;
- support landscape and vertical work;
- avoid forcing vertical video into landscape framing.

Optional supporting sections:

- About
- Chapters
- Transcript
- Credits
- Conversation

### Vertical video

On desktop, place vertical video inside a restrained cinematic stage rather than stretching or cropping it.

---

# 12. Creation type: Audio / Song / Spoken Word

## Experience

Primary mode:

`Listen`

Audio should have its own listening experience.

Example:

```text
            [ artwork ]

             Platform 3

               Kunal

             ▶ 02:14
       ━━━━━━━●━━━━━━━━

            ◀   ▶   ▶▶
```

Type-aware additions:

### Song

Optional lyrics.

### Spoken word

Optional transcript / synchronized reading.

### Podcast / discussion

Optional:

- chapters;
- speakers;
- transcript.

### Soundscape

Minimal context, artwork, and playback.

Do not force transcript UI where it is not relevant.

---

# 13. Creation type: Mixed Media

## Experience

Primary mode:

`Journey`

This is important for Wonder Creator because many Creations may combine:

- photographs;
- voice;
- text;
- video;
- poem fragments;
- references;
- generated media.

Do not force the creator to choose whether the work is "an article" or "a video".

Use a Journey renderer.

Example authored sequence:

```text
Scene 1
  image

Scene 2
  text

Scene 3
  audio fragment

Scene 4
  image + text

Scene 5
  video

Scene 6
  closing text
```

Public rendering turns this into a continuous experience.

This can become one of CreatorPublish's strongest differentiators.

---

# 14. Primary Creation identity vs embedded media

A Creation may contain media without changing its primary identity.

Examples:

### Poem

May contain:

- cover photo;
- creator reading.

It is still primarily a poem.

### Carousel

May contain:

- image;
- text;
- video slide;
- audio.

It is still primarily a Swipe experience.

### Photo essay

May contain:

- prose;
- voice note;
- video fragment.

It remains a Journey.

Rule:

> **Primary Creation type determines the audience experience. Embedded media enriches it.**

---

# 15. Curated presentation variants

Do not offer dozens of website templates.

Offer 2–3 publishing treatments per experience.

Suggested initial set:

### Writing

- Editorial
- Immersive
- Minimal

### Poetry

- Page
- Centered
- Reading + Voice

### Carousel

- Classic
- Full-screen

### Photography

- Gallery
- Museum

### Photo Essay

- Journal
- Cinematic

### Video

- Cinema
- Minimal

### Audio

- Artwork
- Listening Room

### Mixed Media

- Journey
- Chaptered

These are **publishing treatments**, not full website themes.

---

# 16. Creator Page

The Creator Page is the person's public home.

It should support a limited set of reorderable sections.

Recommended sections:

- Featured
- Creations
- DejaVu
- Public Moments
- Current Project
- Open Conversations
- About
- Open to
- Links

The creator can:

- enable/disable sections;
- reorder sections;
- choose featured items;
- select cover imagery;
- preview public page.

Do not provide a freeform drag-and-drop website builder.

---

# 17. Creator Page public card contract

The Creator Page does not need to render every Creation deeply.

It needs a consistent preview contract.

Example:

```ts
interface PublishedCreationCard {
  creationId: string;
  title: string;
  creatorName: string;

  coverAssetId?: string;

  creationType: string;
  experience: PublicationExperience;

  shortDescriptor?: string;
  durationSeconds?: number;
  itemCount?: number;

  href: string;
}
```

Examples:

```text
A Life in Moments
Visual story · 5 slides
```

```text
Platform 3
Spoken word · 2:14
```

```text
Mumbai, Waiting
Photo essay · 7 min
```

```text
चाँद अमावस
Poem
```

Tap → open the appropriate type-aware public renderer.

---

# 18. Public DejaVu page

A DejaVu can optionally become public.

Example:

```text
Railways

A thread running through my work since 2019.

2019
Empty Platform
Photograph

2024
Dad's Railway
Voice excerpt

2026
A Life in Moments
Carousel

2026
Waiting Rooms
Essay
```

This is not a tag-results page.

It should feel editorial.

### Privacy rule

A public DejaVu contains only Moments the creator explicitly allows to be public.

Private Moments remain private even if they share the same DejaVu internally.

---

# 19. Public Moments

Not every public item needs to become a formal Creation.

The Creator Page may optionally contain:

## Moments

Examples:

- photograph from yesterday;
- short voice thought;
- tiny text note;
- public Scrapbook entry;
- small reflection.

This creates two rhythms:

> **Creations = deliberate works**

> **Moments = glimpses into the creative life**

Moments should not become an infinite feed.

Keep the public presentation curated and restrained.

---

# 20. Open Conversations on published work

Do not put generic comments under every published Creation by default.

Instead allow the creator to explicitly enable:

```text
Open a conversation about this
```

Example:

```text
Conversation

What does this bring back for you?

12 responses
```

This creates the lifecycle:

```text
Published Creation
→ Open Conversation
→ Huddle
→ collaboration
```

The creator controls whether a Creation has a conversation.

---

# 21. Visitor actions

Keep public pages work-first.

Primary visitor behavior is:

> experience the Creation.

Possible secondary actions:

- Share
- Save reference
- View creator
- Join conversation

For authenticated Wonder Creator users, additional actions may appear when rights permit:

- Bring to Studio
- Save to Materials

Avoid:

- cluttered engagement counters;
- prominent follower mechanics;
- multiple CTA rows around the Creation.

---

# 22. Rights, attribution, and provenance

CreatorPublish is a strong place to preserve context that social exports often lose.

Possible public information:

- photography credit;
- music credit;
- collaborator credit;
- license;
- attribution;
- AI-assisted imagery disclosure;
- source provenance;
- original Creation information.

Display only what is required or creator-approved.

### Deterministic rule

CreativeMind must never decide legal rights.

Rights / attribution come from deterministic source data.

---

# 23. Publishing revisions

Publishing must create a stable public revision.

Do not directly expose the mutable working Creation.

Concept:

```text
Creation v7
    ↓
Published Revision 3
    ↓
stable public URL
```

The creator may continue editing privately.

The public page continues showing Published Revision 3.

When changes exist:

```text
Changes since publishing

3 slides changed.

[ Update published version ]
```

Updating publication creates the next published revision.

---

# 24. Stable URLs

A published work should have a stable slug/URL.

Conceptual:

```text
wonder.app/kunal/a-life-in-moments
```

Updating the published revision must not change the URL.

Historical revisions can remain internally stored.

A future feature may allow:

```text
View earlier version
```

but this is not required initially.

---

# 25. Visibility

Recommended publication states:

### Private

Only creator/collaborators.

### Unlisted

Anyone with the URL.

### Public

Appears on the Creator Page and may be discoverable.

Potential later state:

### Password protected

Do not conflate visibility with reuse rights.

A work can be public and still have restricted reuse.

---

# 26. Publish flow

Inside a Creation:

```text
Publish
```

Suggested sheet:

```text
Publish A Life in Moments

Visibility
○ Private
○ Anyone with link
● Public on my page

Placement
[ Featured ]
[ Selected Creations ]
[ Railways DejaVu ]

Experience
Swipe · Classic

Preview →

                           Publish
```

The creator should not need to configure web design details.

---

# 27. Publish settings

The publish settings mockup direction includes:

- public URL;
- cover selection;
- primary experience mode;
- optional context;
- rights & attribution;
- sharing;
- remix permission;
- visibility.

Example:

```text
Publish Your Creation

Public URL
[ /between-stations ]

Cover
[ image ] [ image ] [ image ] [+]

Primary experience
Read  View  Swipe
Watch Listen Journey

Show or hide additional context
[on] description
[on] transcript
[on] chapters
[off] location

Rights & attribution
[on] allow sharing
[on] require attribution
[off] allow remixing with credit

[ Publish update ]
```

Experience mode should usually be inferred correctly from the Creation type.

The creator changes it only when multiple valid experiences exist.

---

# 28. Share previews

CreatorPublish should generate type-aware Open Graph/social share previews.

### Carousel

- cover;
- title;
- `5-slide visual story`.

### Film

- poster;
- duration;
- `Short film`.

### Audio

- artwork;
- duration;
- `Spoken word`, `Song`, etc.

### Essay

- title;
- cover;
- short excerpt.

### Photograph

- artwork itself.

### DejaVu

- mosaic;
- DejaVu name;
- Moment/Creation count.

Sharing the web link should look polished anywhere it is pasted.

---

# 29. Responsive behavior

CreatorPublish is a web publishing system.

Every renderer must work across:

- mobile browser;
- tablet;
- desktop;
- embedded share preview where applicable.

General rule:

> Do not make desktop merely a wider mobile page.

Examples:

- carousel → centered stage on desktop;
- poem → controlled reading width;
- vertical video → cinematic frame;
- photograph → museum-like surround;
- photo essay → wider editorial compositions when useful;
- mixed media → responsive authored sequence.

---

# 30. Public page visual philosophy

The mockups establish a calm, editorial visual direction.

Use:

- cream/off-white surfaces where appropriate;
- dark immersive mode for video/audio/cinematic works;
- restrained lavender/purple accents;
- high-quality serif for editorial titles;
- clean sans-serif for UI;
- generous whitespace;
- minimal chrome;
- image-forward composition;
- subtle floral/botanical decoration only where it supports the brand, not inside every work.

Most importantly:

> The Creation should visually dominate its public page.

The surrounding CreatorPublish brand should recede.

---

# 31. Public page chrome should adapt to immersion

The more immersive the Creation, the less page UI should remain visible.

### Essay

Moderate page structure is appropriate.

### Carousel

Minimal page structure.

### Video

Almost no chrome during playback.

### Photograph

Artwork dominates.

### Journey

Navigation becomes part of the narrative.

Rule:

> **CreatorPublish provides consistency around the work without forcing the work into a uniform card.**

---

# 32. Suggested architecture

```text
CreatorPublish
│
├── Creator Public Home
│   ├── Featured
│   ├── Creations
│   ├── DejaVu
│   ├── Public Moments
│   ├── Current Project
│   ├── Open Conversations
│   ├── About
│   └── Open To
│
├── Published Work
│   ├── Read Renderer
│   ├── View Renderer
│   ├── Swipe Renderer
│   ├── Watch Renderer
│   ├── Listen Renderer
│   └── Journey Renderer
│
├── Published DejaVu
│
├── Published Project
│
├── Conversation
│
└── Publishing Infrastructure
    ├── Publication Manifest
    ├── Published Revision
    ├── Visibility
    ├── Rights
    ├── Attribution
    ├── Provenance
    ├── Analytics
    ├── Share Preview
    └── Stable URLs
```

---

# 33. Suggested data model

Adapt to current repo conventions.

## Published revision

```ts
interface PublishedRevision {
  id: string;
  creationId: string;
  creatorId: string;

  creationVersionId?: string;
  revisionNumber: number;

  manifest: PublicationManifest;
  snapshot: unknown;

  visibility: "private" | "unlisted" | "public";

  slug: string;

  publishedAt: string;
  unpublishedAt?: string | null;

  rightsSnapshot?: unknown;
  provenanceSnapshot?: unknown;
}
```

## Creator public page

```ts
interface CreatorPublicPage {
  creatorId: string;

  slug: string;
  isPublished: boolean;

  headline?: string;
  intro?: string;

  sectionOrder: string[];

  featuredCreationIds: string[];
  publicDejaVuIds: string[];
  publicMomentIds: string[];
  publicProjectIds: string[];

  updatedAt: string;
}
```

## Section settings

```ts
interface CreatorPageSectionSettings {
  section:
    | "featured"
    | "creations"
    | "dejavu"
    | "moments"
    | "project"
    | "conversations"
    | "about"
    | "open_to"
    | "links";

  enabled: boolean;
  order: number;
}
```

---

# 34. Renderer contract

All renderers should conform to a common interface.

Conceptually:

```ts
interface PublishedCreationRendererProps {
  revision: PublishedRevision;
  manifest: PublicationManifest;

  creator: PublicCreatorSummary;

  rights: PublicRightsSummary;
  provenance?: PublicProvenanceSummary;

  relatedMoments?: PublicMomentSummary[];
  relatedCreations?: PublishedCreationCard[];

  conversation?: PublicConversationSummary;
}
```

Renderers should not directly fetch unrelated private data.

The public API must deliver only publication-safe fields.

---

# 35. API surface

Suggested shape:

```text
GET  /public/creators/:creatorSlug
GET  /public/creators/:creatorSlug/creations
GET  /public/creators/:creatorSlug/dejavu/:dejavuSlug
GET  /public/creators/:creatorSlug/moments

GET  /public/:creatorSlug/:creationSlug

POST /creations/:creationId/publish
POST /creations/:creationId/publish/update
POST /creations/:creationId/unpublish

GET   /creations/:creationId/publication
PATCH /creations/:creationId/publication/settings

GET   /creator-page
PATCH /creator-page
POST  /creator-page/publish
```

Public endpoints should never depend on authenticated app state.

---

# 36. Caching and performance

Published pages should be optimized like public web pages, not app screens.

Recommended:

- CDN/cache public revisions;
- image transformation/caching;
- poster generation;
- share-image generation;
- responsive images;
- pre-render critical metadata;
- stable canonical URLs;
- lazy-load non-critical related sections;
- video/audio streaming appropriate to asset type.

Publication update should invalidate the relevant public cache.

---

# 37. Accessibility

Each renderer must remain accessible.

Examples:

### Carousel

- keyboard next/previous;
- screen-reader slide count;
- meaningful alt text where available;
- text should remain real text where possible.

### Video

- captions;
- transcript when available;
- keyboard controls.

### Audio

- labeled controls;
- transcript when available.

### Poetry

- preserve semantic reading order.

### Photo essay

- headings;
- alt text;
- sensible sequence.

Do not sacrifice accessibility for visual immersion.

---

# 38. Analytics

Keep analytics creator-useful and restrained.

Possible metrics:

- page views;
- unique visitors;
- average completion for carousel/video/audio;
- outbound share actions;
- conversation starts;
- Creator Page → Creation opens.

Avoid turning publishing into vanity-score optimization.

Do not make public popularity metrics central to the experience.

---

# 39. Creator Page vs in-app Profile

Keep the distinction explicit.

## In-app Profile

May contain:

- collaboration preferences;
- Community activity;
- Huddles;
- DejaVus;
- internal identity/context;
- Open to;
- relationships.

## Creator Page

Contains:

> only what the creator intentionally wants the public internet to see.

Never automatically mirror the entire Profile.

---

# 40. Social platforms

Social integrations become secondary.

Primary publishing flow:

```text
Create
→ Publish beautifully
→ Get stable URL
→ Share anywhere
```

Later integrations may offer:

```text
Share published link to Instagram
Share published link to LinkedIn
Share published link to X
Share published link to WhatsApp
```

The Wonder Creator public URL remains the canonical experience.

---

# 41. Implementation sequence

Recommended implementation order:

## Phase A — Foundation

- Public Creator Page
- PublishedRevision
- stable URLs
- visibility
- publication manifest
- public API
- Read / View / Swipe

## Phase B — Rich media

- Watch
- Listen
- Journey
- responsive behavior
- cover/poster generation

## Phase C — Context

- DejaVu pages
- Public Moments
- related Creations
- rights/provenance/credits

## Phase D — Participation

- Open Conversation on published work
- Huddle handoff
- authenticated Wonder Creator actions

## Phase E — Distribution

- share previews
- analytics
- optional social sharing connectors
- custom domains later

---

# 42. Acceptance criteria

CreatorPublish is ready when:

- [ ] every published Creation has a stable URL;
- [ ] publishing snapshots a revision instead of exposing mutable working state;
- [ ] Creator Page is independently curated from in-app Profile;
- [ ] at least Read, View, Swipe, Watch, Listen, and Journey renderers exist;
- [ ] Carousel behaves natively on mobile and elegantly on desktop;
- [ ] poetry preserves line structure;
- [ ] photography is not trapped inside generic cards;
- [ ] photo essay supports authored vertical narrative;
- [ ] video supports horizontal and vertical media;
- [ ] audio has a true listening experience;
- [ ] mixed-media work can use Journey;
- [ ] public DejaVu contains only explicitly publishable Moments;
- [ ] rights/provenance remain attached;
- [ ] visibility supports Private / Unlisted / Public;
- [ ] public pages are responsive and accessible;
- [ ] link previews reflect Creation type;
- [ ] public page chrome recedes for immersive work;
- [ ] CreatorPublish remains a curated publishing system, not a website builder.

---

# 43. Final product principle

CreatorPublish should not make every Creation look consistent.

It should make every Creation feel **appropriately presented**.

The consistency comes from:

- quality;
- navigation;
- rights;
- publishing controls;
- typography;
- provenance;
- creator identity;
- sharing infrastructure.

The work itself is allowed to behave differently.

> **One public home. Many ways to experience a Creation.**

And the long-term CreatorPublish lifecycle becomes:

> **Create → Publish beautifully → Share link → Conversation → Community → Collaboration → New work**
