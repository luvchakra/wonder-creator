# Wonder Creator — Mobile-First UI Redesign Specification for Claude Code

**Status:** Product Council-aligned UI direction  
**Date:** 27 September 2026  
**Primary target:** Mobile-first responsive web/app UI  
**Implementation audience:** Claude Code / engineering team  
**Reference boards:** Six supplied UI boards packaged alongside this specification

---

# 0. Read This First

This document defines the **new UI/interaction direction** for Wonder Creator.

It is not a request to repaint the existing dashboard UI.

The implementation must move the product away from:

- permanent bottom navigation;
- generic SaaS sidebars;
- dense dashboard grids;
- a standalone AI-chat experience;
- a feature-first information architecture;
- exposing every platform module at all times.

The new product model is:

> **The creator works on a Canvas. Their current creative world is the center. Capabilities reveal themselves contextually through a corner Palette.**

The interface must feel like a creative studio, journal, gallery and workbench—not an admin console.

---

# 1. Canonical Product Terminology

Use the following **user-facing** names everywhere in the UI.

| Legacy UI term | Canonical UI term |
|---|---|
| Artifact | **Creation** |
| Artifact Studio | **Creative Studio** |
| CreatorBrain | **CreativeMind** |
| CreatorTalk | **meTalk** |
| Creator Project Workspace / Project dashboard | **Creative Room** where appropriate |
| App navigation / menu drawer | **Palette** |

## 1.1 Important engineering rule: presentation rename first

Do **not** rename database tables, package names, event names, API contracts, migrations or internal domain identifiers merely to match this UI terminology unless a separate migration is explicitly approved.

For example:

```text
internal: artifact_id
UI: Creation

internal package: creator-brain
UI: CreativeMind

internal route/service: artifact-studio
UI heading: Creative Studio
```

Create a clear presentation-language mapping.

The purpose of this UI pass is not to destabilize domain architecture.

---

# 2. Product Council Interaction Decisions

The implementation must reflect these decisions.

## 2.1 The Canvas is the center

The Canvas contains the creator's **current creative world**, not a list of product modules.

Depending on context the dominant object may be:

- idea;
- photo;
- note;
- voice recording;
- reference;
- Creation;
- active scene;
- Creative Room;
- Huddle;
- completed Creation.

The current work should visually receive approximately **70–90% of attention** on creation-focused screens.

## 2.2 CreativeMind is intelligence, not a destination

CreativeMind should not be a primary global page.

CreativeMind appears contextually through:

- insight cards;
- suggestions;
- “Wonder noticed…” moments;
- quality observations;
- next-step suggestions;
- contextual discovery;
- governed action proposals.

Example:

```text
CreativeMind insight

This opening already feels intimate.
Consider holding the first shot a few seconds longer
to let the tone settle.
```

Do not present CreativeMind as a generic chatbot.

Do not expose hidden reasoning or chain-of-thought.

## 2.3 meTalk is an interaction mode, not a chat product

meTalk should not default to a persistent chat transcript.

meTalk is invoked from the Palette, a creation context, or a press/hold voice gesture.

Examples:

- “Make this quieter.”
- “What if this became a film?”
- “Find everything connected to this memory.”
- “Bring Sofia into this.”
- “Turn this into lyrics.”

For text entry, use a temporary sheet or focused prompt surface.

For voice, use a compact listening/recording mode.

When the action is complete, return the creator to the Canvas.

## 2.4 The Palette replaces bottom navigation

There must be **no permanent bottom navigation bar** in this design system.

The Palette is the signature navigation/action interaction.

The Palette must:

- remain reachable by thumb;
- sit in a safe-area-aware lower corner;
- work with one hand;
- open with a smooth fan/paint-palette motion;
- show only relevant actions;
- never cover the entire Creation unless the user deliberately opens the full menu;
- be closable by tapping outside, swiping toward the corner or tapping the palette control again.

The Palette may appear as:
- compact painter-palette button;
- fan of curved menu leaves;
- contextual radial/fan drawer.

It should feel tactile and artistic, not gimmicky.

---

# 3. Visual Source of Truth

Use the supplied UI boards as the primary visual reference for:

- composition;
- warmth;
- density;
- corner Palette treatment;
- botanical integration;
- serif/sans typography relationship;
- use of imagery;
- card radius;
- spacing;
- Creation-first layout;
- contextual CreativeMind cards;
- utility screens that still feel part of the same world.

## 3.1 Do not use reference boards as runtime assets

The supplied board PNGs are visual references only.

Do **not**:
- place the board PNGs behind the actual app;
- crop UI elements from the boards for production;
- extract the logo from a screenshot;
- extract text from screenshots;
- use screenshot-cropped botanical elements as final assets.

Use the real supplied brand asset library.

---

# 4. Brand Rules

The established Wonder Creator brand system remains authoritative.

## 4.1 Core look

- warm cream/off-white background;
- refined editorial serif display typography;
- clean sans-serif UI typography;
- restrained lavender/purple interaction accents;
- indigo/navy text;
- peach/pink/orange secondary accents;
- soft botanical/organic decoration;
- generous breathing room;
- subtle paper/watercolor feeling;
- rounded cards;
- imagery-forward layouts;
- quiet shadows;
- minimal chrome.

## 4.2 Brand token guidance

Use existing approved tokens from the project if already defined.

If the project requires a fallback mapping, use the brand-board values as the starting point:

```css
--wc-indigo: #5B5CFE;
--wc-purple: #885CF6;
--wc-pink: #F472B6;
--wc-orange: #FF9E08;

--wc-blue: #3882F6;
--wc-teal: #14B8A6;
--wc-mint: #10B881;
--wc-peach: #FB923C;
--wc-lavender: #A788FA;

--wc-navy: #0F172A;
--wc-slate: #334155;
--wc-gray: #64748B;
--wc-light-gray: #E2E8F0;
--wc-cream: #FEF7F0;
--wc-white: #FFFFFF;
```

If existing repo tokens differ from the approved brand file, use the approved source rather than silently replacing them.

## 4.3 Typography

Preferred:

- **Playfair Display** for major editorial/display headings.
- **Inter** for UI, metadata, buttons and dense content.

Handwritten text in mockups is decorative, not mandatory UI copy.

If an approved handwriting typeface is already part of the project, it may be used sparingly for:
- decorative notes;
- scrapbook fragments;
- hero annotations.

Otherwise use Playfair italic rather than adding an arbitrary new handwriting font.

Do not ship font files generated or invented for this work.

---

# 5. Responsive Foundation

## 5.1 Breakpoints

```text
XS mobile     320–374
Mobile        375–479
Large mobile  480–767
Tablet        768–1023
Desktop       1024+
```

The design is mobile-first.

## 5.2 Safe areas

The Palette and any sticky controls must respect:

```css
env(safe-area-inset-top)
env(safe-area-inset-right)
env(safe-area-inset-bottom)
env(safe-area-inset-left)
```

## 5.3 Touch

Minimum interactive target:

```text
44 × 44 CSS px
```

Preferred primary touch target:

```text
48 × 48 CSS px
```

## 5.4 Mobile content width

Use full mobile viewport with approximately 16–20 px side padding for normal pages.

Immersive media/Creation views may intentionally go edge-to-edge.

---

# 6. App Shell

## 6.1 No permanent bottom navigation

Remove the existing bottom navigation from the redesigned experience.

Do not replace it with a persistent top tab bar containing all modules.

## 6.2 Top app bar

Use a minimal top bar containing only contextually necessary items:

```text
Back
Page / Creation title
Optional status
Search or More
Creator avatar only when useful
```

On immersive Creative Studio/Huddle screens, even this can collapse.

## 6.3 Palette anchor

Default mobile location:

```text
bottom: calc(16px + env(safe-area-inset-bottom))
right: 16px
```

Recommended collapsed size:

```text
56–64 px
```

The visual palette should not reduce the available hit area.

## 6.4 Palette z-index model

```text
page content               z: 0
sticky context              z: 20
palette trigger             z: 40
palette dim/blur layer      z: 45
palette menu                z: 50
critical modal/dialog       z: 60+
```

---

# 7. Palette System

The Palette is both navigation and contextual action access.

It is **not** a fixed list of every feature.

## 7.1 Global Palette

Shown from Home or neutral surfaces.

Primary destinations:

```text
Home
Creation
Materials
Huddles
Me
```

Quick creative actions:

```text
New Creation
Bring Material
Capture
meTalk
Explore
People
```

Use a visual separator between destinations and actions.

## 7.2 Material Palette

When a single Material is active:

```text
Create with this
Add to Collection
Find related
Explore possibilities
Edit details
Share
```

Optional More:

```text
Archive
Download original
Delete
```

## 7.3 Creation Palette

During active creative work:

```text
Refine
Transform
Bring Material
References
People
Versions
More…
```

More:

```text
Rights
Share
Publish
Export
History
Archive
```

## 7.4 Creative Room Palette

```text
Create
Bring Material
People
Huddle
Tasks
Timeline
More…
```

More:

```text
Rights
Approvals
Files
Activity
Room settings
Archive
```

## 7.5 Finished Creation Palette

```text
Create from this
Share
Publish
License
Collaborate
Export
```

Secondary:

```text
Versions
Lineage
Rights history
Analytics
Archive
```

## 7.6 Palette animation

Recommended interaction:

```text
tap palette
→ background softly dims/blurred
→ curved menu leaves fan upward/inward
→ each row follows a 20–35 ms stagger
→ total opening motion 220–320 ms
```

Use spring/ease motion with minimal overshoot.

Respect `prefers-reduced-motion`.

Do not animate every decorative element.

## 7.7 Palette accessibility

- focus is trapped while fully open;
- Escape closes on web;
- screen reader announces “Creative Palette opened”;
- menu items have standard list/menu semantics;
- collapsed palette has accessible label;
- selection closes menu unless action launches a secondary picker.

---

# 8. Home Canvas

Reference: board 01.

## Purpose

The Home Canvas answers:

> **What are you exploring or creating right now?**

It is not a dashboard.

## Layout

Top:

```text
Good morning,
Maya
```

Then one dominant continuation card:

```text
A Life in Moments
Short Film · In Progress
```

Under it:

```text
CreativeMind insight
```

Then:

```text
Recent Materials
```

Optional one additional section such as:
- recent Creations;
- something CreativeMind noticed;
- live Huddle relevant to current work.

Do not show five dashboard sections simultaneously.

## Home content order

1. greeting;
2. Scrapbook strip — the latest thoughts from everyone you can see, in the order shared (owner, 2 Oct 2026);
3. current/recent Creation;
4. CreativeMind insight;
5. recent Material;
6. optional next contextual element;
7. Palette.

## Empty state

If the creator is new:

```text
Good morning, Maya.

What would you like to begin with?

[small editorial inspiration card]

Open Palette to:
New Creation · Bring Material · Capture · meTalk
```

No AI chat box.

---

# 9. Materials / Inspiration Wall

Reference: boards 01 and 04.

## Purpose

Materials should feel like the creator's visual memory—not cloud storage.

## Layout

Use a masonry/editorial wall for image-rich collections.

Material types:

- Photos
- Notes
- Audio
- Video
- Documents
- Links
- Sketches
- References
- Ideas

Use compact horizontal filters at the top.

### Cards

Photo:
- image dominates;
- short note/tags;
- optional heart/bookmark-style “saved reference” state only if semantically correct;
- no social-like counts.

Audio:
- waveform;
- duration;
- optional transcript snippet.

Note:
- paper-like card;
- text;
- handwritten style only when approved.

Document:
- preview/cover;
- type badge.

## Long press / overflow

Actions should map to Material Palette.

## Performance

Virtualize very large libraries.

Do not decode dozens of full-resolution photos at once.

---

# 10. Material Detail

## Layout

1. edge-to-edge/large preview;
2. title/type;
3. description;
4. CreativeMind understanding;
5. provenance;
6. tags/themes;
7. related Creation(s);
8. related Materials;
9. Palette.

## CreativeMind

Example:

```text
CreativeMind noticed:
This photograph and the voice note from 12 September
share the same memory of Goa and home.
```

No conversation transcript.

---

# 11. Search / Creative Discovery

Reference: board 04.

Search across:

```text
Creations
Materials
People
Huddles
Collections
Creative Rooms
```

Use:

- large search field;
- horizontally scrollable type chips;
- visual “Curated for you” blocks only when based on genuine context;
- standard result list below.

Never label something “Trending” purely to simulate social-media engagement.

Discovery should optimize for relevance, inspiration and collaboration—not popularity.

---

# 12. Material Collections

Reference: board 04.

Collections should feel curated.

Example:

```text
Golden Hours
24 materials

Sketchbook Stories
18 materials

Quiet Spaces
```

Collection card may combine 2–4 representative thumbnails.

Collection screen:

1. title;
2. description;
3. representative imagery;
4. member Materials;
5. “Use in Creation” contextual action;
6. Palette.

---

# 13. CreatorSend / Bring Material

Reference: board 04.

User-facing heading may be:

```text
Bring Material
```

“CreatorSend” can remain an internal/system term if desired.

Primary entry choices:

```text
Upload
Camera
Voice
Link
```

Optional:

```text
Video
Document
YouTube / external reference
Existing Creation
```

After import:

```text
Understanding…
```

Then display:

- extracted metadata;
- what CreativeMind understood;
- proposed tags/themes;
- related Creation/Collection suggestions.

Do not send user to a chatbot.

---

# 14. Creation View

Reference: boards 02 and 03.

## Purpose

Treat every Creation as a meaningful object.

## Layout

1. hero preview;
2. title;
3. type/status;
4. short description;
5. key metadata;
6. relevant tabs/sections;
7. CreativeMind insight;
8. Palette.

Possible contextual sections:

```text
About
Materials
People
Notes
Versions
Lineage
Rights
```

Do not show all as always-visible navigation.

---

# 15. Creative Studio

Reference: board 01.

This is the most important immersive workspace.

## 15.1 Media-specific canvas

The Creative Studio changes by Creation type.

### Writing

- nearly full-screen writing surface;
- title/status minimal;
- typography optimized for reading;
- attachments/references accessible from Palette;
- no permanent AI panel.

### Video

- immersive player;
- scene/clip strip;
- audio waveform/timeline where needed;
- contextual tool overlay;
- Palette.

### Image / visual

- large canvas;
- minimal editing overlay;
- inspector only on demand.

### Audio

- waveform/timeline;
- track/section list;
- lyrics/notes on demand.

## 15.2 No right-side CreativeMind pane on mobile

CreativeMind suggestions appear as:
- insight card;
- suggestion chip;
- contextual “Refine” action;
- quality review surface.

---

# 16. Context View

Reference: board 01.

The Context View exposes what surrounds the Creation.

Sections:

```text
Materials
People
References
Notes / Audio
Related Creations
```

Use tabs or segmented controls only for 3–4 high-value categories.

Do not create a permanent inspector panel on narrow screens.

This view is invoked from:
- Palette;
- Creation detail;
- Creative Room.

---

# 17. Transform Creation

Reference: boards 02 and 03.

Purpose:

> One Creation can become many forms.

Options may include:

```text
Trailer
Photo Essay
Social Series
Poem
Visual Story
Podcast Script
Storyboard
Pitch Deck
Lyrics
Album Artwork
```

The options must be filtered by the actual source Creation.

Each transformation card contains:
- preview;
- format;
- one sentence;
- estimated output characteristics if useful.

Tap → focused configuration → Create.

The generated result becomes a new Creation with lineage.

---

# 18. Creative Quality Review

Reference: board 03.

## Layout

1. Creation preview;
2. Original / proposed preview switch;
3. actionable suggestions;
4. selection checkboxes;
5. Apply selected;
6. optional regenerate.

Checks may include:

```text
Story structure
Character consistency
Visual coherence
Dialogue
Pacing
Audio clarity
Originality considerations
Rights/provenance
```

Never present quality as a single universal numeric score.

Applying suggestions creates a new version.

---

# 19. Version History / Compare

Reference: board 03.

On mobile:

- versions in horizontal strip or vertical timeline;
- current clearly marked;
- compare in dedicated view.

Modes:

```text
Before / After
Single View
Swipe Compare
```

Do not force two dense side-by-side text documents at 375 px.

Restoring an older version must create an auditable new state rather than destroying history.

---

# 20. Rights & License

Reference: boards 02 and 03.

Tone must be reassuring and understandable.

Sections:

```text
Ownership
Copyright
License
Commercial Use
Attribution
History
```

Example UI:

```text
You own this Creation

Personal Use
Included

Creator License
Included

Commercial Use
Add License

Extended License
Learn More
```

Do not make legal claims beyond stored rights/agreements.

Always include appropriate language that platform records do not automatically determine legal ownership.

---

# 21. Share / Publish

Reference: boards 02 and 03.

Separate concepts:

```text
Share
Publish
Download / Export
```

## Share

- private link;
- unlisted;
- public;
- invited collaborators;
- expiration where supported.

## Publish

Select supported connected destinations.

Then:

```text
Prepare
Customize
Review
Schedule
Publish
```

Never show publish success before external provider confirmation.

---

# 22. Approval Center

Reference: board 03.

This is a utility screen, but it must retain the warm visual language.

Potential requests:

```text
Brand collaboration use
External share link
Derivative Creation
Publish action
License request
Rights change
Destructive action
```

Every approval card must answer:

```text
What will happen?
Who/what is involved?
Which Creation?
What rights/cost consequences?
Who initiated it?
When?
```

Actions:

```text
Review
Approve
Decline
Edit
```

No vague “Allow” actions without scope.

---

# 23. Creative Room

Reference: boards 01 and 05.

Creative Room replaces the feeling of a project-management dashboard.

## Top

- room/Creation title;
- hero or current Creation;
- room status;
- people.

## Content

```text
Current Creation
Next Steps
Recent Materials
People
CreativeMind insight
```

Secondary through Palette:

```text
Tasks
Timeline
Rights
Approvals
Files
Activity
```

The room should feel like “everything around this creative work”, not Jira.

---

# 24. Crew Workspace

Reference: board 05.

Sections:

```text
Space
Materials
Creations
People
Activity
```

Show:
- active Creation;
- shared Material;
- crew activity;
- Huddle entry.

Use simple avatars and roles.

No org-chart aesthetic.

---

# 25. Invite Collaborators

Reference: board 05.

Support:

```text
Invite
Pending
Members
```

Invitation fields:

- person/email;
- proposed role;
- project/Creative Room;
- permission scope;
- optional note;
- rights/compensation note where relevant.

Possible flexible roles:

```text
Creator
Editor
Viewer
Writer
Musician
Filmmaker
Designer
Producer
Custom
```

Do not hard-code only one creative industry.

---

# 26. Tasks & Milestones

Reference: board 05.

This is intentionally lightweight.

Default mobile view:

```text
In Progress
Completed
```

Alternative tabs:

```text
Tasks
Milestones
Timeline
```

Each task:

- title;
- related Creation/Material;
- assignee avatar;
- due date;
- priority only if actually used;
- status.

No dense kanban as the default mobile experience.

---

# 27. Collaborative Editing

Reference: board 05.

Keep the Creation dominant.

Collaboration UI overlays:

- comments;
- collaborator presence;
- suggested changes;
- version state.

Comments attach to a Creation location/timestamp/selection where supported.

Do not cover the canvas with chat.

---

# 28. Contribution & Attribution

Reference: board 05.

Show:

```text
All Activity
By Version
By People
```

Each contribution:

- contributor;
- action;
- Creation/version;
- time;
- preview.

Examples:

```text
Added 8 photos
Wrote narrative draft
Edited video clip
Created location notes
Designed cover image
```

Do not invent contribution percentages unless explicit data exists.

---

# 29. Find Collaborators

Reference: board 05.

Search dimensions:

- discipline;
- skills;
- location;
- interests;
- availability;
- existing relationship;
- project fit.

Cards should show:
- person;
- discipline;
- location when shared;
- availability;
- representative creations;
- invitation action.

No universal creator ranking/score.

---

# 30. Huddle Discovery

Reference: boards 02 and 04.

Tabs may include:

```text
Live Now
Upcoming
For You
My Huddles
```

Cards:
- topic;
- image;
- participants;
- start time/live indicator;
- Join/Request/Remind.

Do not rank primarily by viewer count.

---

# 31. Creator Huddle

Reference: board 01.

Huddle is immersive and intentionally darker.

The media/session should dominate.

Controls:

```text
Mute
Camera
Share
Chat
Invite
Leave
```

Chat is acceptable **inside Huddle** because it is a real live conversation feature.

It is not the product's AI interface.

Huddle should retain current Creation context when opened from Creative Room/Studio.

---

# 32. Me / Living Portfolio

Reference: boards 02 and 04.

This should answer:

> Who is this creator and what are they creating?

Use:

- creator identity;
- short creative statement;
- current themes;
- recent/featured Creations;
- collections;
- current activity/live state;
- collaboration availability.

Follower counts may exist but must be visually secondary.

Avoid social-profile mechanics becoming the story.

---

# 33. Creator Autonomy

Reference: board 04.

Prefer creator-friendly language.

Sections may include:

```text
Creative Preferences
Make It Mine
AI & CreativeMind
Data & Privacy
Notifications
Connected Apps
```

For autonomy levels, preserve the actual governed model:

```text
Observe
Suggest
Draft
Execute with Approval
Auto-Execute
```

Consequential areas such as:
- publishing;
- commerce;
- licensing;
- rights;
- destructive actions

must remain conservative by default.

---

# 34. Privacy & Security

Reference: board 04.

Use a calm, transparent screen.

Suggested sections:

```text
Activity
Access
Data
Settings
```

Surface:

- recent security/activity events;
- device/session activity;
- content sharing changes;
- data export;
- AI provider preferences;
- retention;
- audit log;
- account deletion.

Do not expose sensitive private creative content in notification previews or audit summaries.

---

# 35. CreatorPublish

Reference: board 06.

This is a utility product, but retain the same visual language.

Views:

```text
Queue
Published
Drafts
```

Cards show:
- Creation;
- derivative;
- destination;
- scheduled date/time;
- status.

Recently published items may show metrics only when real platform data exists.

---

# 36. Publication Derivatives

Reference: board 06.

Each derivative is a Creation.

Examples:

```text
Trailer
Photo Essay
Social Series
Poem
Visual Story
Teaser Assets
```

Preserve:
- source Creation;
- source version;
- lineage;
- rights;
- publication destination.

---

# 37. Brand Opportunities

Reference: board 06.

Creator-side first.

Sections:

```text
My Preferences
Opportunities
```

Preference dimensions:

- industries;
- themes;
- values;
- collaboration type;
- long-term vs one-off;
- commercial boundaries;
- exclusivity;
- usage rights.

Do not create a universal creator-commercial-value score.

---

# 38. Campaign Brief

Reference: board 06.

Show:

```text
Brand
Status
Overview
Deliverables
Timeline
Rights Requirements
Approvals
```

Do not hide usage-rights requirements.

The screen should make it clear whether terms are:
- proposed;
- in discussion;
- accepted.

---

# 39. Commercial Rights Setup

Reference: board 06.

Use a guided form.

Fields:

```text
Usage type
Territory
Duration
Exclusivity
Attribution
Derivative permission
Channels
```

Potential conflicts must be clearly surfaced before save.

Do not make automated legal conclusions.

---

# 40. CreatorMarket Listing

Reference: board 06.

Only expose when commercial path is production-ready.

Fields:

```text
Creation
Listing type
Price/currency
License
What's included
Exclusivity
Derivative permission
Listing state
```

States:

```text
Draft
Active
Paused
Sold/Unavailable
Expired
```

Do not accidentally publish a draft listing.

---

# 41. CreatorBusiness

Reference: board 06.

CreatorBusiness should be a clear economic summary, not accounting software.

Views:

```text
Earnings
Transactions
Payouts
```

Revenue sources may include:
- brand collaboration;
- content license;
- CreatorMarket sale;
- collaboration payment;
- other connected economic event.

Use real data only.

---

# 42. Analytics & Integrations

Reference: board 06.

Analytics should be Creation-first.

Show:

- selected Creation;
- date range;
- reliable metrics;
- platform source;
- trend chart;
- top destinations;
- connected integrations.

Never invent unavailable platform metrics.

Avoid one universal creator score.

---

# 43. No-Chat AI Interaction Pattern

This is a key implementation requirement.

## Do not build

```text
persistent AI chat bubble
full-height AI conversation page as primary workflow
floating “Ask AI” widget on every screen
```

## Build instead

### Insight card

```text
CreativeMind insight
Your recent travel photographs share a warmer,
quieter visual rhythm than this cut.
[Explore]
```

### Temporary meTalk sheet

```text
What do you want to change?

[ Make this scene more intimate... ]

[Speak]                         [Continue]
```

### Voice mode

```text
Listening…
“Turn this into a short trailer.”

[Cancel] [Done]
```

### Contextual suggestion

```text
Refine opening
Use your recent voice note
Explore another direction
```

---

# 44. Background Image Strategy

## 44.1 Important branding rule

Do **not** generate new Wonder Creator brand backgrounds.

Do not create replacement botanical illustrations.

Do not extract/crop decorative backgrounds from the supplied mockup screenshots for production.

Use the **official supplied high-resolution Wonder Creator brand background assets**.

If the repository does not contain the approved source files, treat this as an explicit asset dependency.

## 44.2 Backgrounds actually required

The application should not require a unique full-screen raster background for every route.

Use background imagery selectively.

Recommended asset set:

```text
brand/
  backgrounds/
    paper-cream-light
    botanical-corner-top-left
    botanical-corner-top-right
    botanical-corner-bottom-left
    botanical-corner-bottom-right
    watercolor-wash-peach
    watercolor-wash-lavender
  motifs/
    palette
    sparkle
    leaf-sprig
```

These names represent required *roles*, not permission to invent assets.

Map them to the actual supplied files.

## 44.3 Prefer composable assets

Prefer:
- base solid cream;
- separate approved botanical corner;
- separate approved watercolor wash;
- real creator media.

Avoid one giant 4K background containing all decoration.

This enables responsive repositioning and smaller payloads.

## 44.4 Desktop/tablet

Decorative botanicals can occupy larger negative-space areas.

## 44.5 Mobile

Use at most 1–2 decorative background elements visible per viewport.

Decoration must never obscure:
- text;
- touch controls;
- Creation media;
- Palette menu.

---

# 45. Background Asset Delivery & Cache Plan

This section is mandatory.

## 45.1 Asset preparation

For each approved raster decorative/background asset, generate responsive variants at build/preparation time:

```text
430w
768w
1024w
1440w
1920w only when the source supports it
```

Preferred formats:

```text
AVIF
WebP fallback
PNG only when alpha fidelity requires it
```

Do not upscale source assets.

## 45.2 File naming

Use content/version hashed filenames:

```text
paper-cream-light.v3.84bd21.avif
botanical-corner-br.v2.20ac11.webp
```

Do not overwrite the bytes behind a long-lived immutable URL.

## 45.3 HTTP caching

For versioned/hashed public brand assets:

```http
Cache-Control: public, max-age=31536000, immutable
```

For the small asset manifest:

```http
Cache-Control: public, max-age=300, stale-while-revalidate=86400
```

The manifest points to immutable asset URLs.

## 45.4 Next.js image behavior

Where applicable:

- use `next/image`;
- provide explicit `width`/`height` or `fill` + `sizes`;
- prefer static import for local approved assets;
- only use `priority` for above-the-fold imagery;
- lazy-load offscreen decorative assets;
- use `sizes` so mobile does not fetch desktop dimensions.

Example conceptual `sizes`:

```text
(max-width: 480px) 160px,
(max-width: 1024px) 260px,
360px
```

## 45.5 Preloading

Preload only:
- logo;
- Palette icon/motif;
- one above-the-fold Home decorative asset if required.

Do not preload all route backgrounds.

## 45.6 Route-level loading

Load utility-route decoration only when that route is entered.

Examples:
- CreatorBusiness does not need the Creative Studio background bundle.
- Huddle does not load floral/paper imagery if it is in immersive dark mode.

## 45.7 Browser/service-worker caching

If the app already has a service worker/PWA layer:

### Precache

Safe to precache:
- logo;
- Palette asset;
- tiny immutable brand motifs;
- base shell CSS/JS.

### Runtime cache

For public immutable brand assets:

```text
strategy: CacheFirst
maxEntries: 30–50
maxAgeSeconds: 30 days in SW cache
```

HTTP cache may retain immutable files longer.

### Do not service-worker cache private creator media

Do not put:
- private Creations;
- private Material;
- signed media URLs;
- Huddle recordings;
- BYOK/provider payloads

into a long-lived shared runtime cache.

For private media, rely on:
- signed URL expiration;
- authenticated browser/network cache semantics;
- short appropriate cache policy from storage/backend.

## 45.8 Cache invalidation

Brand asset change:

```text
new file contents
→ new content/version hash
→ manifest update
→ old immutable asset naturally ages out
```

Never invalidate by mutating an immutable file in place.

## 45.9 Memory/decode budget

On mobile:
- avoid loading full-resolution source images into list cards;
- use thumbnails;
- limit decoded offscreen media;
- virtualize long material walls;
- pause offscreen video;
- avoid autoplay;
- release object URLs after use.

Target:
- initial UI shell + essential branding should remain lightweight;
- creator media should dominate bytes only when the creator chooses to view it.

---

# 46. Suggested Brand Asset Registry

Create a typed registry rather than scattering paths through components.

Conceptual structure:

```ts
export const brandAssets = {
  logo: {
    primary: "...",
    compact: "...",
    onDark: "..."
  },
  palette: {
    trigger: "...",
    optionalTexture: "..."
  },
  backgrounds: {
    paperCream: "...",
    washPeach: "...",
    washLavender: "..."
  },
  botanicals: {
    topLeft: "...",
    topRight: "...",
    bottomLeft: "...",
    bottomRight: "..."
  }
} as const;
```

If an entry is unavailable, show a plain branded layout without it and emit a development warning.

Do not substitute generated art.

---

# 47. Suggested Component Architecture

Do not duplicate product logic merely to create the new UI.

Suggested presentation components:

```text
ui/
  wonder/
    CanvasShell
    CanvasHeader
    PaletteTrigger
    PaletteDrawer
    PaletteItem
    EditorialCard
    CreationHero
    CreationPreview
    CreativeMindInsight
    MaterialWall
    MaterialCard
    ContextSheet
    CreatorAvatarStack
    PeoplePicker
    CreationStatus
    RightsStatus
    ApprovalCard
    EmptyCanvas
    DecorativeFrame
```

Feature components remain in owning domains.

Examples:

```text
features/material/*
features/creation/*
features/huddle/*
features/rights/*
features/crew/*
features/publish/*
```

CreativeMind UI calls existing governed orchestration/domain tools.

---

# 48. Suggested Routes

Do not treat this as a forced route refactor if existing routes differ.

Preferred user-facing conceptual routes:

```text
/
 /materials
 /materials/[id]

 /creations
 /creations/[id]
 /creations/[id]/studio
 /creations/[id]/transform
 /creations/[id]/versions
 /creations/[id]/rights
 /creations/[id]/share
 /creations/[id]/publish

 /rooms/[id]
 /rooms/[id]/crew
 /rooms/[id]/tasks

 /huddles
 /huddles/[id]

 /me

 /approvals
 /settings/autonomy
 /settings/privacy
 /settings/integrations

 /publish
 /brand
 /market
 /business
```

meTalk should generally be a mode/sheet, not `/metalk` unless a deep-linkable interaction history is specifically required.

CreativeMind should not need a primary route.

---

# 49. State Design Requirements

Every screen must define:

```text
loading
empty
normal
partial
offline
error
permission denied
provider unavailable
```

Relevant screens must additionally define:

```text
uploading
processing
generating
awaiting approval
scheduled
publishing
published
failed
archived
```

Never use fake success states.

---

# 50. Motion Guidelines

Motion should be calm and tactile.

Good:
- Palette fan opens;
- image gently expands to immersive view;
- card morphs into detail;
- Creation transition preserves visual continuity;
- subtle CreativeMind insight arrival.

Avoid:
- bouncing dashboard cards;
- excessive parallax;
- constant background motion;
- decorative animation competing with artwork.

Respect reduced-motion preferences.

---

# 51. Mobile Accessibility

Mandatory:

- 44 px minimum touch targets;
- no hover-only actions;
- no drag-only task movement;
- semantic headings;
- alt text for meaningful images;
- decorative botanicals ignored by assistive tech;
- captions/transcripts where available;
- focus indicators on web;
- correct sheet/dialog focus management;
- dynamic font scaling;
- contrast preserved over background imagery.

When text overlays Creation media, use a controlled scrim/gradient.

---

# 52. Performance Budget

The redesigned UI should feel visually rich without being heavy.

## Initial Home

Target principles:
- load only visible Home media;
- one hero Creation thumbnail/video poster;
- small recent Material thumbnails;
- logo;
- Palette asset;
- limited decoration.

Do not load:
- full Material library;
- hidden Huddle thumbnails;
- all brand backgrounds;
- full-resolution Creation media.

## Images

- thumbnails sized to rendered dimensions;
- AVIF/WebP where suitable;
- blur/solid placeholders;
- lazy load offscreen.

## Video

- poster first;
- `preload="metadata"` or `none` unless actively playing;
- no background autoplay.

## Audio

- waveform data should be a compact derived representation;
- do not download full audio merely to display waveform.

---

# 53. Security / Privacy UI Requirements

Aesthetic redesign must not weaken governance.

Still enforce:

- RLS;
- tenant isolation;
- explicit share scope;
- Creator autonomy;
- approval gates;
- signed private URLs;
- provider/data controls;
- rights propagation;
- audit logging.

Do not expose private Material/Creation thumbnails in:
- public metadata;
- unauthenticated page previews;
- push notification images

unless explicitly allowed.

---

# 54. Feature Priority for UI Migration

Do not redesign every screen at once.

## Phase UI-A — Shell and foundational experience

1. CanvasShell
2. Palette
3. Home Canvas
4. Materials
5. Material Detail
6. Creation View
7. Creative Studio
8. Context View

Release behind a feature flag if necessary.

## Phase UI-B — Creative continuity

9. Transform Creation
10. Creative Quality
11. Versions
12. Rights
13. Share/Publish
14. Approval Center

## Phase UI-C — People and collaboration

15. Creative Room
16. Crew
17. Invitations
18. Tasks
19. Collaborative Editing
20. Contributions
21. Find Collaborators
22. Huddles

## Phase UI-D — Utility/commercial

23. Autonomy
24. Privacy
25. CreatorPublish
26. Brand
27. Campaign
28. Commercial Rights
29. Market
30. Business
31. Analytics/Integrations

---

# 55. Migration Rule

When converting an existing screen:

```text
1. Preserve domain behavior.
2. Preserve tests.
3. Preserve routes where practical.
4. Replace shell/layout.
5. Replace bottom nav with Palette.
6. Change UI terminology through presentation layer.
7. Remove unnecessary permanent panels.
8. Make the current creative object visually dominant.
9. Convert CreativeMind from page/chat to contextual intelligence.
10. Add mobile/responsive E2E tests.
```

Do not combine a major DB refactor with this UI migration unless independently required.

---

# 56. Per-Screen Claude Code Checklist

For each converted screen:

```text
[ ] Uses canonical UI terminology
[ ] No permanent bottom navigation
[ ] Palette present where appropriate
[ ] Palette actions are contextual
[ ] Creation/Material/current work dominates
[ ] CreativeMind appears only contextually
[ ] meTalk is transient, not persistent chat
[ ] Approved brand assets only
[ ] No screenshot-derived production assets
[ ] Responsive at 320 / 375 / 390 / 430 / 480
[ ] Tablet behavior defined
[ ] Loading state
[ ] Empty state
[ ] Error state
[ ] Offline/provider state where relevant
[ ] Touch targets >= 44 px
[ ] Reduced motion supported
[ ] RLS/permissions unchanged or improved
[ ] Rights/provenance preserved
[ ] Approval/autonomy preserved
[ ] No private-data leakage
[ ] Asset loading optimized
[ ] E2E updated
```

---

# 57. Acceptance Criteria for the Redesign

The redesign is successful when:

### A creator can move through the product without a bottom navigation bar

The Palette provides understandable navigation and context actions.

### The current work is always obvious

A creator can answer:

> “What am I working on right now?”

within one second of viewing a creative screen.

### CreativeMind no longer feels like a separate AI product

The creator receives intelligence through relevant insights and actions.

### meTalk no longer feels like ChatGPT

It behaves like a natural way to tell Wonder Creator what the creator wants.

### Utility features do not dominate creative surfaces

Rights, approvals, publishing, commerce and settings appear when relevant.

### Every Creation maintains continuity

Material → Creation → Version → Derivative → People → Rights → Publication remains traceable.

### The UI is visually rich but performant

The app does not ship giant background images on every route, does not preload hidden media, and uses immutable cached brand assets.

---

# 58. Explicit Non-Goals

Do not:

- reintroduce a bottom nav because it is easier;
- expose CreativeMind as a permanent navigation item;
- make meTalk a default chat screen;
- turn Home into a dashboard;
- turn Creative Room into Jira;
- turn Me into Instagram;
- use follower counts as the primary identity signal;
- invent brand imagery;
- generate replacement logo/background art;
- crop screenshots into production assets;
- add arbitrary global modules to the Palette;
- rename internal domain/database concepts without migration approval;
- sacrifice rights/security/autonomy for visual simplicity.

---

# 59. Final Experience Model

The intended product experience is:

```text
HOME CANVAS
   ↓
Bring / Capture / Create / meTalk
   ↓
MATERIAL
   ↓
CreativeMind quietly understands context
   ↓
Explore possibilities
   ↓
CREATIVE STUDIO
   ↓
CREATION
   ↓
Refine / Transform / Versions / Context
   ↓
Creative Room / People / Huddle / Crew
   ↓
Rights / Approval / Share / Publish / License
   ↓
Outcome
   ↓
returns to future creative context
```

The creator should feel:

> **“I am making something.”**

—not:

> “I am navigating software.”

---

# 60. Supplied Reference Board Manifest

The implementation package includes these visual references:

```text
01_Core_Canvas_Palette_Materials_Huddle.png
02_Creation_Transform_Rights_Profile_Huddles.png
03_Creation_Rights_Quality_Versions_Approvals.png
04_Search_Collections_CreatorSend_Autonomy_Privacy.png
05_CreativeRoom_Crew_Collaboration.png
06_Publish_Brand_Market_Business_Analytics.png
```

These are reference-only.

The approved high-resolution brand assets/backgrounds remain the production asset source of truth.
