# Wonder Creator — Compact UI & Density Specification

**Status:** Owner-approved UI direction  
**Date:** 27 September 2026  
**Audience:** Claude Code / engineering / design  
**Applies to:** all Wonder Creator responsive pages, especially mobile  
**Related specs:** UI redesign, context-aware Palette, mobile responsive guidelines

> **Amended 30 Sep 2026 (owner: "change any rules that need to be changed to achieve aesthetic excellence").** This
> spec governs **utility surfaces** (settings, rights, approvals, business, forms, lists, tools) in full. On
> **expressive surfaces** — Home, onboarding, Profile, Creator Page, published works, DejaVu, Moments/Scrapbook, empty
> states, sign-in — its numbers are ceilings on clutter, not limits on beauty: display type, painted heroes (30–45vh),
> art inside cards and generous editorial whitespace are allowed where the owner's boards show them. Accessibility
> (contrast, 44px targets, readable type, reduced motion) never bends. See CLAUDE.md → Aesthetic excellence.

---

# 1. Owner Direction

Wonder Creator currently feels too large and too airy:

- buttons are visually oversized;
- headings and body text are too large;
- cards contain too much padding;
- too many sections consume a full screen;
- decorative whitespace often pushes useful content below the fold;
- full-width controls are used where compact rows or inline actions would work;
- repeated cards/panels make simple screens feel longer than necessary.

The new direction is:

> **Compact, calm, editorial and information-rich — never cramped.**

The creator should see **more of their actual work and context per screen**, with less interface chrome.

Compactness must not damage:
- accessibility;
- touch usability;
- readability;
- the warm artistic identity;
- media focus;
- rights / approval clarity.

---

# 2. Non-Negotiable Compactness Rules

## 2.1 Touch targets remain accessible

Do **not** solve density by making tappable areas tiny.

Minimum hit target:

```text
44 × 44 CSS px
```

However the **visible control** inside that hit area may be smaller.

Example:

```text
44px hit target
└── 34–38px visible pill/button
```

Icon:

```text
18–20px visual icon
inside 44px hit target
```

This gives compact visual density without hurting touchability.

---

## 2.2 Default mobile type scale

Use this as the starting density system.

```text
Hero / rare marketing heading      26–30px
Page title                         22–24px
Creation title                     20–22px
Section title                      15–17px
Primary body                       14px
Secondary body                     13px
Metadata                           12–12.5px
Eyebrow / compact labels           11–12px
Button label                       13–14px
Chip label                         11.5–12.5px
```

Avoid routine 30–40px application headings.

Large Playfair typography should be reserved for:
- Home greeting;
- Creation hero;
- onboarding;
- special editorial moments.

Utility pages should use smaller headings.

---

## 2.3 Line height

```text
Display:          1.05–1.15
Titles:           1.15–1.2
Body:             1.35–1.45
Metadata:         1.25–1.35
```

Avoid body copy with exaggerated line-height.

---

# 3. Spacing Scale

Recommended mobile spacing tokens:

```css
--space-1: 4px;
--space-2: 6px;
--space-3: 8px;
--space-4: 10px;
--space-5: 12px;
--space-6: 16px;
--space-7: 20px;
--space-8: 24px;
```

Most application UI should use:

```text
4 / 8 / 12 / 16px
```

Use 20–24px only for meaningful section separation.

Avoid routine:

```text
32 / 40 / 48px vertical gaps
```

inside product pages.

---

# 4. Page Padding

## Mobile

```text
Horizontal page padding: 14–16px
Top content padding:     8–12px
Section gap:             12–16px
Card gap:                8–10px
```

## Large mobile

```text
16–18px
```

## Tablet

```text
18–24px
```

Do not use large decorative margins simply because the screen has room.

---

# 5. Header Density

Standard mobile app header:

```text
44–48px usable height
```

Contains only:
- back;
- title;
- one or two contextual controls.

Do not add:
- oversized logo;
- subtitle;
- large vertical margin;
- duplicated page description

unless the page is a true landing surface.

For normal subpages, use:

```text
Back     Page Title                          More
```

not a large marketing-style header block.

---

# 6. Buttons

## 6.1 Primary action

Visual height:

```text
38–40px
```

Hit area:

```text
>= 44px
```

Use full-width primary buttons only when:
- finishing a focused form;
- publish / approval / save is the clear single next step;
- mobile ergonomics materially improve.

Do not make every action a full-width 52–60px pill.

## 6.2 Secondary buttons

Prefer:

```text
32–36px visual height
44px hit target
```

Use:
- compact bordered buttons;
- text + icon actions;
- inline actions.

## 6.3 Button copy

Prefer:

```text
Share
Transform
Invite
Publish
Save
```

over:

```text
Share Your Creation Now
Transform This Creation
Invite New Collaborators
```

Use supporting copy below/near the action when explanation is needed.

---

# 7. Chips / Filters / Tabs

Visible height:

```text
28–32px
```

Keep the tap target accessible using surrounding hit area.

Use horizontal scrolling rather than:
- wrapping to 3 rows;
- enlarging chip height;
- creating large filter panels.

Tabs should be compact.

Recommended:

```text
All  Photos  Notes  Audio  Video
```

not giant segmented cards.

---

# 8. Cards

## Default card padding

```text
10–12px
```

Dense card:

```text
8–10px
```

Feature/hero card:

```text
12–16px
```

Do not use 20–28px padding in routine mobile cards.

## Card radius

Use moderate radius:

```text
12–16px
```

Reserve larger 20–24px radii for:
- hero surfaces;
- Palette;
- special brand moments.

Too many oversized rounded cards make the interface visually bulky.

---

# 9. Reduce Nested Cards

Avoid:

```text
card
  → card
      → card
```

Prefer:

```text
surface
  divider
  row
  row
  row
```

Use one parent surface and separators.

Especially important for:
- Settings;
- Rights;
- Business;
- Analytics;
- Approval Center;
- Crew;
- Campaigns.

---

# 10. Use Rows Instead of Buttons

When an action is one of many equal choices, use a compact row.

Bad:

```text
[       Upload       ]

[       Camera       ]

[       Voice        ]

[        Link        ]
```

Better:

```text
▧ Upload                 ›
◉ Camera                 ›
≋ Voice                  ›
⌁ Link                   ›
```

Each row remains a 44–48px touch target but consumes less visual weight.

---

# 11. Content Above the Fold

At approximately **390 × 844**, each page should try to show:

1. page/context identity;
2. primary content;
3. at least one meaningful next action or secondary section.

Avoid a hero area so large that nothing else is visible.

Exceptions:
- immersive Creative Studio;
- Live Huddle;
- full-screen image/video Creation.

---

# 12. Hero Media

For non-immersive detail pages:

```text
Recommended hero height: 160–220px
```

or roughly:

```text
24–30vh
```

Do not routinely use 40–50vh hero imagery.

For a Creation detail, show enough of the Creation to establish emotion, then bring metadata/context into view quickly.

---

# 13. Decorative Assets

Botanical corners and watercolour washes must not consume layout height.

Use them:
- absolutely positioned;
- partially clipped;
- low contrast;
- pointer-events none;
- behind real content.

They should **decorate existing negative space**, not create negative space.

Avoid decorative banners that add 80–160px of empty vertical height.

---

# 14. CreativeMind Density

CreativeMind insights should usually be:

```text
1 compact card
2–3 lines
1 action
```

Recommended card:

```text
CreativeMind noticed
The opening feels intimate. Hold the first shot slightly longer.
Explore →
```

Do not use:
- long AI explanations;
- chat transcript styling;
- multiple stacked insight cards.

Allow expand for details.

---

# 15. Palette Density

Contextual Palette:

```text
3–4 primary actions
```

Global Palette:

```text
maximum 6
```

Palette item visual height:

```text
36–40px
```

Hit target:

```text
>= 44px
```

Use a tighter vertical fan.

Avoid the earlier 11-item single panel.

---

# 16. Compact Metadata Pattern

Instead of separate cards for every fact, combine:

```text
Short Film · v4 · Private · 2:38
```

or:

```text
24 photos · 3 notes · 2 audio
```

Use icons sparingly.

Metadata should not each require a standalone tile.

---

# 17. Progressive Disclosure

Default screen should show:
- what matters now.

Hide secondary detail behind:
- `More`;
- accordion;
- sheet;
- tap-through detail.

Examples:
- Rights history;
- advanced publish options;
- full metadata;
- provider debug status;
- audit payload detail;
- attribution detail.

---

# 18. Page-by-Page Compactness Guidance

The following rules apply in addition to the context-aware Palette specification.

---

## 18.1 Home Canvas

### Make compact

- Greeting: 24–28px, not oversized 36–44px.
- Remove large subtitle paragraphs.
- Current Creation card: hero image around 170–190px high.
- CreativeMind insight: one compact 2–3 line strip/card.
- Recent Materials: horizontal mini-thumbnails, 72–88px.
- Show no more than 3 Home sections before scroll.
- Palette replaces action button grids.

### Recommended first viewport

```text
Greeting
Current Creation
CreativeMind insight
Recent Materials strip
Palette
```

Do not show a large action panel plus recent work plus discovery plus Huddles simultaneously.

---

## 18.2 Create Menu

### Make compact

- Use 4 compact rows or fan items:
  - New Creation
  - Bring Material
  - Capture
  - meTalk
- 44–48px row height.
- Keep descriptions to one short secondary line only where needed.
- No large illustration block above the choices.

---

## 18.3 Empty Canvas

### Make compact

- Canvas should start almost immediately under the header.
- One subtle centered hint, not a large empty-state card.
- Palette contains starting actions.
- Avoid separate oversized Photo / Voice / Note / Template buttons in the canvas.
- Show selected Materials as a small bottom filmstrip.

---

## 18.4 Materials / Inspiration Wall

### Make compact

- Header + search in one compact area.
- Filter chips directly under search; 28–30px visual height.
- Masonry/grid gap 6–8px.
- Reduce card labels; overlay type/date only when useful.
- Audio card waveform height around 52–64px.
- Avoid paragraph descriptions in grid.
- 2-column layout at ~390px, with selective larger feature cards.

---

## 18.5 Material Detail — Photo

### Make compact

- Hero photo 180–220px, not near full-screen.
- Put title/type/date in one metadata row.
- CreativeMind understanding collapsed to 2–3 lines.
- Tags use compact chips.
- Related Creations/Materials use horizontal strips.
- Provenance/technical metadata lives under Details.

---

## 18.6 Material Detail — Audio / Voice

### Make compact

- Waveform 80–110px high.
- Playback row always visible.
- Transcript preview max 4 lines, then Expand.
- Combine duration/date/source in one metadata row.
- Suggestions as compact rows, not big cards.

---

## 18.7 Material Detail — Note / Document

### Make compact

- Show first page/text content quickly.
- Metadata collapses beneath title.
- Avoid a card around the document preview unless necessary.
- Extracted ideas display as compact bullets/chips.

---

## 18.8 Material Detail — Video

### Make compact

- Player 16:9 at page width.
- Metadata immediately under player.
- Key moments horizontal strip.
- Transcript/description collapsed.
- Do not stack giant action buttons below video.

---

## 18.9 Collection View

### Make compact

- Header: title + count + overflow.
- Description max 2 lines.
- Cover should be shallow, 120–160px max.
- Material grid begins quickly.
- New Material action in Palette or compact icon control.

---

## 18.10 Explore / Creative Discovery

### Make compact

- Avoid giant “Here are possibilities…” hero text.
- Page title 22–24px.
- Categories one horizontal chip row.
- Suggestions use dense image card: image + title + 1-line reason.
- 2-column grid where useful.
- “Why this?” opens detail rather than occupying card body.
- No oversized “Surprise me” button; use compact header action.

---

## 18.11 Search

### Make compact

- Search field 40–44px.
- Entity filters 28–30px chips.
- Results as 56–72px rows for text/person entities.
- Image/Creation results can use compact cards.
- Do not repeat large entity headings if tabs already provide context.

---

## 18.12 Creation View — General

### Make compact

- Hero media 180–220px unless immersive.
- Title 20–22px.
- Combine:
  - type;
  - status;
  - version;
  - visibility
  into one row.
- Description max 3 lines.
- Materials/People/Notes as compact tabs or context entry.
- CreativeMind insight one compact card.
- Contextual Palette holds major actions.

---

## 18.13 Creation — In Progress

### Make compact

- Show “Continue Creating” as a compact prominent action.
- Keep next steps to 2–3 visible items.
- People as overlapping 28–32px avatars.
- References as 56–72px thumbnails.
- Versions hidden until requested.

---

## 18.14 Creation — Finished

### Make compact

- Status line indicates Finished.
- Share / Publish / License live in Palette rather than three large buttons.
- Keep one-line rights summary visible.
- Hide advanced rights until opened.

---

## 18.15 Creation — Published

### Make compact

- Add publication status as one metadata row.
- Analytics preview: max 3–4 metrics in a compact strip.
- Do not show a full analytics dashboard inside Creation View.

---

## 18.16 Creative Studio — Writing

### Make compact

- Writing surface uses most of screen.
- Header 44px.
- No permanent tool cards.
- Editing toolbar collapses to 4–5 icons + More.
- Scene navigation uses compact drawer/sheet.
- References/materials accessible through Palette/context sheet.
- Reduce surrounding card borders: text should feel like a page/canvas.

---

## 18.17 Creative Studio — Image

### Make compact

- Canvas dominates.
- Tool rail uses 40–44px icon hit targets.
- Labels only on selection or in bottom sheet.
- Avoid a permanent properties panel on mobile.
- Thumbnail strip 56–64px.

---

## 18.18 Creative Studio — Video

### Make compact

- Player consumes top ~35–45% depending orientation.
- Timeline directly below, not inside multiple cards.
- Toolbar icon-only where standard.
- Scene thumbnails 48–60px.
- Context/People hidden in sheets.
- CreativeMind suggestions appear one at a time.

---

## 18.19 Creative Studio — Audio / Music

### Make compact

- Waveform is primary.
- Track rows 44–52px.
- Transport controls compact and standard.
- Lyrics/notes open in sheet.
- Reference audio uses small rows, not tiles.

---

## 18.20 Context View

### Make compact

- Tabs: Materials / People / References.
- Each tab uses compact rows/thumbnails.
- No introductory paragraph.
- Material previews 64–80px.
- People rows ~52px.
- “Add” as compact header icon or Palette action.

---

## 18.21 Transform Creation

### Make compact

- Source Creation preview 72–100px, not a full hero.
- Transformation options as 56–72px rows:
  - icon/thumbnail;
  - title;
  - one-line outcome;
  - chevron.
- Avoid full-width large cards.
- Advanced settings appear after selecting a format.

---

## 18.22 Creative Quality Review

### Make compact

- Preview 140–180px.
- Checks display as compact rows with status.
- Suggestions use 56–72px rows.
- Avoid large thumbnails for every suggestion.
- Sticky Apply Selected CTA visual height 38–40px.
- Detail expands only when tapped.

---

## 18.23 Version History

### Make compact

- Version strip thumbnails 56–68px.
- Current marker as small badge.
- Change summary 1–2 lines.
- Compare mode uses full available canvas without oversized controls.
- Version metadata in compact row.

---

## 18.24 Lineage

### Make compact

- Mobile default: vertical lineage list, not a giant graph.
- Node height 56–72px.
- Use thumbnail + type + version + relation.
- Graph is optional immersive mode.

---

## 18.25 Rights & License

### Make compact

- Current rights summary as a 2-column or compact row group.
- Avoid separate large cards for Ownership, Copyright and License if values are short.
- Use 44–48px setting rows.
- Advanced legal terms collapsed.
- License choices use rows, not 100px cards.
- Keep important warnings visible but short.

---

## 18.26 Share

### Make compact

- Visibility selector as 3 compact rows/radios.
- Copy Link and Invite in a compact action row.
- Export/Embed under More.
- Avoid one large card per option.

---

## 18.27 Publish

### Make compact

- Destination icons in one compact horizontal row.
- Caption/description uses compact field.
- Schedule and visibility as 44–48px rows.
- One final Publish CTA.
- Do not show destination configuration cards expanded by default.

---

## 18.28 Approval Center

### Make compact

- Approval card padding 10px.
- Show:
  - action;
  - Creation;
  - initiator;
  - consequence badge;
  - Approve / Decline.
- Explanations max 2 lines.
- Full details on tap.
- Prefer 1 approval ≈ 90–120px, not 180–240px.

---

## 18.29 Creative Room

### Make compact

- Hero/current Creation 140–180px.
- Room summary in 1–2 lines.
- Next Steps 3 compact rows max.
- Materials horizontal strip.
- People compact avatar stack.
- One CreativeMind insight.
- Tasks/Timeline/rights live behind Palette/More.

---

## 18.30 Creative Room — No Active Creation

### Make compact

- Do not show a giant empty-state illustration.
- Small prompt + recent Materials.
- Palette actions:
  - Start Creation;
  - Bring;
  - Invite;
  - Huddle.

---

## 18.31 Crew Workspace

### Make compact

- Members in a horizontal avatar strip.
- Current Creation compact card.
- Shared Materials as thumbnails.
- Activity as 44–56px rows.
- Avoid dedicated cards for each minor statistic.

---

## 18.32 Invite Collaborators

### Make compact

- Search/invite field at top.
- Role selector inline or compact sheet.
- Pending invites use 52–64px rows.
- Member rows 48–56px.
- Remove large role cards.

---

## 18.33 Tasks & Milestones

### Make compact

- Task row 52–64px.
- Checkbox/status + title + due date + avatars.
- No giant kanban cards.
- Milestones use compact timeline rows.
- Details open in sheet/page.

---

## 18.34 Collaborative Editing

### Make compact

- Creation remains full focus.
- Comments as small anchored chips/bubbles.
- Presence avatars max 28–32px.
- Activity opens in sheet.
- No permanent comment column on mobile.

---

## 18.35 Contribution & Attribution

### Make compact

- Activity row 52–64px.
- Person avatar 28–32px.
- Contribution text max 2 lines.
- Tiny Creation thumbnail optional.
- Tabs compact.
- Avoid card per contribution.

---

## 18.36 Find Collaborators

### Make compact

- Search + filter button in header.
- Person row/card height roughly 96–120px.
- One-line discipline/availability.
- Representative work as 3–4 tiny thumbnails.
- Invite is compact button, not full-width.
- Full profile on tap.

---

## 18.37 Huddle Discovery

### Make compact

- Live cards around 120–150px high.
- Avoid huge media thumbnails.
- Participant avatars 24–28px.
- Join button compact.
- Upcoming Huddles may use list rows rather than cards.

---

## 18.38 Live Huddle

### Make compact

This is immersive rather than dense.

- Maximize participant/video space.
- Controls 44px hit areas with 20px icons.
- Keep bottom control bar shallow.
- Context Creation becomes a compact bottom strip.
- People/chat appear in sheets.

---

## 18.39 Post-Huddle

### Make compact

- Summary max 2–3 lines.
- Participants one avatar strip.
- Saved moments use compact rows.
- Next actions in Palette.
- Do not display the whole transcript by default.

---

## 18.40 Me / Living Portfolio

### Make compact

- Profile hero height 120–160px.
- Avatar 64–72px.
- Bio max 3 lines.
- Metrics condensed into one line and visually secondary.
- Themes chips compact.
- Creations in tight 2-column grid or horizontal featured strip.
- Do not allocate half screen to profile identity.

---

## 18.41 My Creations

### Make compact

- Use 2-column cards where visual.
- List option for text-heavy work.
- Card metadata limited to:
  - title;
  - type;
  - status.
- Avoid description on every card.
- New Creation lives in Palette.

---

## 18.42 Creator Autonomy

### Make compact

- Use 44–52px setting rows.
- Domain + current autonomy value.
- Tap opens selector sheet.
- Do not show 5 large autonomy cards at top.
- Brief explanatory line only.

---

## 18.43 Privacy & Security

### Make compact

- 44–52px settings rows.
- Current value/status on trailing side.
- Recent activity 48–56px rows.
- Audit details open on tap.
- Delete Account isolated at bottom, but does not need a huge red card.

---

## 18.44 Notifications

### Make compact

- Notification row 56–72px.
- Avatar/icon 28–36px.
- Text max 2 lines.
- Time inline/trailing.
- Contextual Approve/Decline compact buttons where required.
- Avoid one large card per notification.

---

## 18.45 CreatorPublish Queue

### Make compact

- Queue item 64–80px.
- Thumbnail 48–56px.
- Creation + destination + date + status.
- Use tab counts compactly.
- Avoid large cards for published history.

---

## 18.46 Publication Derivative

### Make compact

- Source Creation shown as 64–80px compact reference.
- Derivative preview medium-sized.
- Lineage/status in one metadata row.
- Palette carries major actions.

---

## 18.47 Brand Opportunities

### Make compact

- Opportunity card ~110–140px.
- Brand logo 36–44px.
- Show:
  - campaign;
  - fit/category;
  - deliverable summary;
  - rights flag;
  - status.
- Do not show long campaign copy in feed.
- Open detail for terms.

---

## 18.48 Campaign Brief

### Make compact

- Brand + status in one compact header.
- Overview max 3 lines.
- Deliverables as rows.
- Timeline and rights as compact sections.
- Avoid one card per field.
- Primary campaign action remains sticky only when needed.

---

## 18.49 Commercial Rights Setup

### Make compact

- Use form rows with label left / value right when possible.
- 44–48px rows.
- Explanatory copy under only non-obvious fields.
- Group related fields into sections with dividers, not cards.

---

## 18.50 CreatorMarket Browse

### Make compact

- 2-column visual listings on mobile where readable.
- Card shows Creation, price, license type.
- Filters compact in sheet.
- Avoid large seller/about copy in listing grid.

---

## 18.51 Market Listing Detail

### Make compact

- Hero 160–200px.
- Price/license/status one compact summary.
- “What’s included” as 3–5 bullet rows.
- Rights summary collapsed.
- Palette handles listing actions.

---

## 18.52 CreatorBusiness

### Make compact

- Top earnings value + small trend.
- Max 3 summary metrics in compact strip.
- Revenue sources as 44–52px rows.
- Transactions as dense list.
- One chart per page section; charts 140–180px high.
- Avoid dashboard-card mosaic.

---

## 18.53 Analytics

### Make compact

- 4 metrics in 2×2 compact grid or horizontal strip.
- Chart 160–190px high.
- Top Creations as list.
- Platform metrics in compact rows.
- Filters/date range in header.
- No repeated large metric cards.

---

## 18.54 Connected Apps / Integrations

### Make compact

- Provider row 52–60px.
- Logo 28–32px.
- Status + Connect/Manage button.
- Description max 1 line.
- Group by category with subtle section labels.
- No giant integration tiles.

---

## 18.55 Settings

### Make compact

- Standard 44–52px list rows.
- No card around every settings group.
- Use section headings + dividers.
- Show current status/value trailing.
- Palette may be suppressed entirely.

---

# 19. Desktop & Tablet Compactness

Compact direction also applies on larger screens.

Do not interpret desktop as permission to:
- make cards larger;
- increase text scale dramatically;
- add empty side columns;
- reintroduce a large sidebar.

Instead use additional space for:
- more Creation content;
- contextual secondary panes;
- side-by-side references;
- more grid columns.

Keep core controls approximately the same physical density.

---

# 20. Density Component Tokens

Recommended shared component variants:

```ts
<Button density="compact" />
<Card density="compact" />
<ListRow density="compact" />
<Section density="compact" />
<Chip density="compact" />
<PageHeader density="compact" />
```

Default Wonder Creator product UI should use:

```text
compact
```

Use `comfortable` only for:
- onboarding;
- marketing;
- empty emotional moments;
- special full-screen Creation presentation.

---

# 21. Implementation Rules for Claude Code

When implementing or reviewing a screen:

1. Identify the primary creative object.
2. Remove any UI that does not support that object or immediate next action.
3. Reduce visual button dimensions while preserving 44px hit targets.
4. Reduce routine typography to the compact scale.
5. Replace large action cards with rows when appropriate.
6. Reduce routine card padding to 8–12px.
7. Reduce section gaps to 12–16px.
8. Flatten nested cards.
9. Move secondary metadata into progressive disclosure.
10. Make decorative artwork absolute/background rather than layout-consuming.
11. Keep at least one meaningful secondary piece of information visible below the primary content on normal mobile screens.
12. Use contextual Palette instead of stacking more action buttons.
13. Preserve accessibility, permissions, rights and autonomy behavior.
14. Test at 320, 360, 390, 430 and 480px.
15. Compare screenshot density before/after.

---

# 22. Visual Regression Requirement

For every migrated page, capture at least:

```text
390 × 844
430 × 932
desktop representative viewport
```

Review specifically for:

```text
[ ] No oversized title
[ ] No oversized button
[ ] No unnecessary card nesting
[ ] No >24px unexplained vertical gap
[ ] No decorative empty block consuming useful space
[ ] Primary content begins quickly
[ ] At least one next/context element appears above fold where appropriate
[ ] Palette remains unobtrusive
[ ] Text remains readable
[ ] Tap targets remain >=44px
```

---

# 23. Definition of Compact

A page is **not** compact merely because fonts were reduced.

A Wonder Creator page is compact when:

- the creator sees more meaningful work/context;
- the interface consumes less attention;
- actions remain easy to hit;
- text remains comfortable to read;
- cards do not repeat information;
- metadata is grouped intelligently;
- secondary content is progressively disclosed;
- decoration does not consume layout space;
- no feature is added merely to fill empty space.

---

# 24. Final Standard

Use this design test:

> **If a utility screen can become 15–25% shorter without removing useful information or hurting touch/readability, make it shorter.** Never shorten an expressive surface by removing its art, imagery or breathing room.

And:

> **Whitespace should separate meaning—not compensate for oversized components.**

Wonder Creator should feel:

> **compact, beautiful, calm and creative**

—not:

> **large, sparse and dashboard-like.**
