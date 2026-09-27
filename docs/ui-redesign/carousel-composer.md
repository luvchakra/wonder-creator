# Wonder Creator — Carousel Composer + Compact UI Specification

**Status:** Implementation-ready  
**Date:** 27 September 2026  
**Audience:** Claude Code / engineering / design  
**Scope:** Carousel Creation experience, slide generation, text-on-image editing, slide reordering, per-image regeneration, add-one-more generation, and UI minimization

---

# 1. Product Intent

The Carousel feature turns a source such as a song, poem, spoken-word piece, note, Material, or Creation into a polished sequence of visual slides.

A slide is not just an image. Each slide contains:

- one image;
- one associated text chunk;
- optional text overlay on the image;
- editable overlay placement and style;
- explicit slide order;
- optional per-slide generation history.

The feature should feel like:

> Wonder Creator helps me turn my words into a visual sequence while keeping me in control of the images, text, order, and composition.

It should not feel like a generic AI image generator followed by a manual design tool.

---

# 2. Core UX Principle

Use one clear next step at a time.

For normal mobile screens:

```text
1 dominant action
0–2 visible secondary actions
everything else contextual / deferred
```

Avoid:

- action-button walls;
- persistent edit toolbars outside edit mode;
- duplicate actions on page and Palette;
- multiple equally prominent purple buttons;
- large empty setup cards;
- unnecessary intermediate screens.

---

# 3. Compactness Standard

Use Wonder Creator's compact UI rules.

## Mobile typography

```text
Page title              22–24px
Creation title          20–22px
Section title           15–17px
Body                    14px
Secondary text          13px
Metadata                12–12.5px
Button label            13–14px
Chip label              11.5–12.5px
```

## Spacing

```text
Horizontal page padding     14–16px
Section gap                 12–16px
Card gap                     8–10px
Card padding                 8–12px
```

## Controls

```text
Primary visual height       38–40px
Secondary visual height     32–36px
Chip / segmented option     28–32px
Minimum hit target          44×44 CSS px
```

---

# 4. Minimal Button Rule

Normal Carousel screens should have:

```text
Primary prominent button: maximum 1
Secondary visible actions: maximum 2
```

Everything else belongs in:

- contextual Palette;
- More menu;
- slide-level overflow;
- bottom sheet;
- edit mode.

If more than three prominent actions are visible, redesign the screen.

---

# 5. Main Feature Flow

```text
Source Creation / Material
        ↓
Create as Carousel
        ↓
Choose initial image count + optional visual style
        ↓
Generate initial slides
        ↓
Carousel Overview
        ↓
Select / open slide
        ↓
Slide Editor
        ↓
Text / Image / Regenerate / Arrange
        ↓
Continue Creating
        ↓
Finished Carousel
```

---

# 6. Initial Carousel Setup

Before the first image is created, the creator must be able to choose the number of images/slides to generate.

Recommended quick choices:

```text
3
4
5
6
```

Optional:

```text
Custom
```

Recommended default:

```text
5
```

Use compact chips or segmented controls, not large cards.

Optional visual style:

```text
Auto
Editorial
Atmospheric
Minimal
```

Optional aspect ratio:

```text
1:1
4:5
16:9
```

Primary CTA should be dynamic:

```text
Generate 5 images
```

Only one prominent CTA.

---

# 7. Generation State

Show:

```text
Creating your carousel…
Generating 5 images and matching text
```

Optional real progress:

```text
3 of 5 ready
```

Use compact skeletons and a simple progress indicator.

Do not use:

- animated assistant characters;
- theatrical loading sequences;
- rotating AI slogans;
- fake multi-stage progress;
- multiple buttons.

If cancellation is genuinely supported, show one quiet `Cancel` action.

---

# 8. Automatic Text Chunking

Wonder Creator should automatically split the source text into slide-sized chunks.

Each generated slide receives one suggested chunk by default.

Example:

```text
Slide 1
चाँद घटते-घटते
अमावस की जेब में जा छुपा है,

Slide 2
और आईने के सामने देखो तो—
बस एक तन्हाई है
```

The creator must not manually add text to every slide from scratch.

Chunking should respect:

- sentence/stanza boundaries;
- poetic line breaks;
- semantic completeness;
- visual readability;
- requested number of slides.

---

# 9. Carousel Overview

The Overview is a compact sequence-management surface.

Recommended layout:

```text
Navbar

Slides
5 slides · text matched automatically

1  [thumbnail]  text chunk preview     ⋯
2  [thumbnail]  text chunk preview     ⋯
3  [thumbnail]  text chunk preview     ⋯
4  [thumbnail]  text chunk preview     ⋯
5  [thumbnail]  text chunk preview     ⋯

+ Generate one more              Arrange

[        Continue Creating        ]

Details ›
```

Each slide row shows:

- slide number;
- image thumbnail;
- 2–4 lines of text;
- optional indicator when text is placed on image;
- overflow menu.

Do not use giant slide cards on mobile unless the user explicitly enters visual preview mode.

---

# 10. Overview Button Hierarchy

Primary:

```text
Continue Creating
```

Visible secondary actions:

```text
Generate one more
Arrange
```

Move these off the main surface:

```text
Transform
Share
Context
Download
Rights
Versions
People
Advanced style controls
Regenerate all
```

These belong in the Palette, Details, More, or slide overflow.

---

# 11. Generate One More

After the initial Carousel exists, the creator must be able to add exactly one more image/slide at a time.

Action:

```text
Generate one more
```

This must not regenerate the existing Carousel.

Open a compact sheet:

```text
Add one more slide

Optional instruction
[________________________]

Generate
```

Optional chips:

```text
More cinematic
Warmer
Closer shot
Minimal
Night scene
More emotional
```

If no instruction is entered, use the current Carousel context and visual style.

The new slide:

- appends to the end by default;
- receives a suggested text chunk;
- remains reorderable.

---

# 12. Initial Count Is Not a Hard Limit

The number selected before generation is only the starting slide count.

Afterward the creator may:

- add one;
- remove one;
- reorder;
- regenerate an individual image.

---

# 13. Full-Screen Slide Editor

Tapping a slide opens a focused editor.

Recommended layout:

```text
‹            2 of 5             ⋯

┌───────────────────────────────┐
│                               │
│             IMAGE             │
│                               │
│  editable text overlay        │
│                               │
└───────────────────────────────┘

Text     Image     Regenerate     More

‹   [1] [2] [3] [4] [5]   ›

Done
```

The image should dominate the screen.

Advanced controls appear only after the relevant tool is selected.

---

# 14. Read Mode vs Edit Mode

Separate these modes on mobile.

## Read mode

The creator can:

- select/copy text;
- swipe between slides;
- inspect the image;
- read the associated text.

## Edit mode

The creator can:

- drag text;
- resize text;
- edit text;
- change styling;
- crop/reposition image.

Text selection and drag gestures must not compete in the same state.

---

# 15. Text Is Real Text

The readable/selectable copy must remain real text in the UI.

Do not flatten the only copy into image pixels.

Conceptually each slide includes:

```text
sourceText
displayText
overlayText
```

The source/display text and visual image overlay can initially match, but must remain independently editable.

---

# 16. Edit Text

When `Text` is selected, open a compact editor.

Supported actions:

```text
Edit text
Suggest another chunk
Split into two slides
Use different text
Place text on image
```

Primary completion action:

```text
Done
```

Text should be natively selectable/copyable.

---

# 17. Suggest Another Chunk

This proposes another source-text chunk for the selected slide.

It changes only the Carousel slide assignment.

It must not modify the source Creation.

---

# 18. Split Into Two Slides

If a text chunk is too long, offer:

```text
Split into two slides
```

Behavior:

```text
current text chunk
↓
semantic split
↓
current slide gets first portion
new slide gets second portion
```

If the new slide requires a newly generated image, ask before incurring generation cost.

---

# 19. Place Text on Image

Each slide supports:

```text
Place text on image
```

If overlay is disabled:

```text
Text → Place on image
```

If enabled:

```text
Text → Edit overlay
```

Text remains separately editable outside the image.

---

# 20. Drag Text

In overlay edit mode, the user can drag text freely.

Provide subtle snapping/safe zones:

```text
Top Left
Top Center
Top Right
Center
Bottom Left
Bottom Center
Bottom Right
```

While dragging, show:

- safe margins;
- center guide;
- edge guides.

Keep these guides visually subtle.

---

# 21. Resize Text

Allow:

- direct resize handles where reliable;
- text-size slider;
- text box width;
- alignment.

Recommended primary controls:

```text
Size
Width
Alignment
```

More detailed typography can live under More.

---

# 22. Text Style

Compact style controls may include:

```text
Font preset
Size
Color
Alignment
Shadow
Background overlay / gradient
```

Keep presets limited, for example:

```text
Editorial
Serif
Modern
Handwritten
```

Do not expose dozens of fonts.

---

# 23. Image Full-Screen / Enlargement

Tapping the image can enter a near-full-screen image-editing state.

The user can:

- inspect at larger scale;
- edit overlay;
- zoom;
- crop;
- reposition focal point.

Do not add a separate complicated route if a focused editor state works.

---

# 24. Image Editing

Image tool mode may contain:

```text
Zoom
Crop
Move focal point
Reset
```

These controls remain hidden until Image mode is active.

---

# 25. Regenerate One Image

Each slide supports:

```text
Regenerate this image
```

This affects only the selected slide.

The rest of the Carousel remains unchanged.

---

# 26. Regeneration With Custom Instruction

Open a compact sheet:

```text
Regenerate this image

Tell Wonder Creator what to change

[ Make it moodier with warmer light... ]

More cinematic
Warmer
Closer shot
Minimal
More emotional
Add negative space

[ Regenerate ]

Cancel
```

The regeneration request should use:

- current slide image;
- current text chunk;
- source Creation context;
- Carousel visual style;
- user instruction;
- selected references where applicable.

---

# 27. Non-Destructive Regeneration

Do not immediately destroy the previous image.

Preferred flow:

```text
Current image
New variation
```

Then:

```text
Use new
Keep current
```

Generation history may retain both according to lineage/version rules.

---

# 28. Arrange / Reorder Slides

Tap:

```text
Arrange
```

Use a dedicated compact reorder mode:

```text
≡  1  [thumb]  text preview
≡  2  [thumb]  text preview
≡  3  [thumb]  text preview
≡  4  [thumb]  text preview
≡  5  [thumb]  text preview
```

User drags rows.

Primary:

```text
Done
```

Optional secondary:

```text
Reset order
```

No other editing actions should be visible while reordering.

Reordering must not trigger image generation.

---

# 29. "Generate One More" vs "Show More Styles"

Keep these conceptually separate.

## Generate one more

```text
adds one new slide/image
```

## Show more styles

```text
explores alternative visual treatments
```

Do not use vague language like `Try another direction`.

Prefer:

```text
Choose a visual style
Show more styles
Generate more options
```

---

# 30. Details Instead of Persistent Tabs

Do not permanently show:

```text
About
Materials
Versions
Rights
People
```

as a tab row on the working Carousel screen.

Use:

```text
Details ›
```

Inside Details:

```text
About
Materials
Versions
Rights
People
```

The working surface should remain focused on the Carousel itself.

---

# 31. Compact Metadata

Prefer one line:

```text
Carousel · v2 · In progress · Private
```

and:

```text
Created from “चाँद अमावस”
```

Avoid multiple large metadata cards.

---

# 32. Adaptive Navbar Text

Use the navbar center intelligently.

Suggested states:

Initial setup:

```text
Carousel · Setup
```

Generating:

```text
3 of 5 images ready
```

Overview:

```text
5 slides · v2
```

Selected slide:

```text
Slide 2 of 5
```

Saving:

```text
Autosaved
```

Regenerating:

```text
Regenerating slide 2…
```

Arrange mode:

```text
Arrange 5 slides
```

Operational truth always overrides AI-generated navbar context.

---

# 33. Context-Aware Palette

Carousel Overview Palette:

```text
Share
Transform
Add Material
More…
```

Slide Editor Palette:

```text
Save to Materials
Duplicate Slide
Replace Image
More…
```

Finished Carousel Palette:

```text
Share
Publish
Create from this
License
```

Keep first level to 3–4 contextual actions.

---

# 34. Autosave

Autosave lightweight edits:

```text
text edits
overlay movement
overlay resize
style changes
slide order
crop/focal position
```

Navbar may briefly show:

```text
Saving…
Saved
```

Then return to normal context.

Do not require a Save button for every routine edit.

---

# 35. Slide Data Model

Suggested conceptual model:

```ts
type CarouselSlide = {
  id: string;
  carouselCreationId: string;

  orderIndex: number;

  imageAssetId: string | null;

  sourceChunkId?: string | null;
  sourceText: string;
  displayText: string;

  overlay: {
    enabled: boolean;
    text: string;
    position: {
      x: number;
      y: number;
    };
    width?: number;
    fontPreset?: string;
    fontSize?: number;
    lineHeight?: number;
    alignment?: "left" | "center" | "right";
    color?: string;
    shadow?: boolean;
    backgroundOverlay?: string | null;
  };

  imageTransform?: {
    crop?: unknown;
    zoom?: number;
    focalX?: number;
    focalY?: number;
  };

  activeGenerationId?: string | null;
};
```

Use existing domain/version/asset conventions rather than duplicating them.

---

# 36. Carousel Creation State

```ts
type CarouselCreation = {
  id: string;
  sourceCreationId?: string;
  initialRequestedSlideCount: number;
  currentSlideCount: number;
  aspectRatio: string;
  visualStyle: string;
  status:
    | "setup"
    | "generating"
    | "editing"
    | "review"
    | "finished";
};
```

---

# 37. Image Generation Request Types

Initial generation:

```text
purpose = carousel-initial
count = selected image count
```

Add one:

```text
purpose = carousel-add-slide
count = 1
```

Regenerate one:

```text
purpose = carousel-regenerate-slide
count = 1
slide_id = selected slide
instruction = optional custom instruction
```

---

# 38. Generation Cache Behavior

Initial Carousel generation follows the contextual image-generation cache system.

However:

```text
Generate one more
Regenerate this image
```

are explicit creator requests for new output and should use a new variation/generation nonce rather than simply returning the previous cached image.

---

# 39. Source / Text / Image Lineage

For every slide record:

```text
source Creation
source version
source text chunk
source Materials
generation ID
image asset
overlay text
overlay configuration
order
```

This enables:

- version comparison;
- attribution;
- regeneration;
- future transformation.

---

# 40. Minimal Transitions

Allowed:

```text
sheet open/close        180–240ms
page/editor transition  150–220ms
state crossfade         120–160ms
Palette reveal          200–280ms
```

Avoid:

- staggered card entrances;
- bounce;
- animated text controls;
- elaborate AI-loading choreography;
- several transitions after one tap.

A normal action should cause at most one major transition.

---

# 41. Empty and Failure States

Too little source content:

```text
Add more text or Material to build the Carousel.
```

Primary:

```text
Add Material
```

Initial generation failure:

```text
Couldn’t create the images.
```

Primary:

```text
Try again
```

Per-slide regeneration failure:

```text
Couldn’t regenerate this slide.
```

Primary:

```text
Try again
```

Never show raw provider errors.

---

# 42. Accessibility

- all interactive controls have >=44px hit targets;
- text remains natively selectable;
- provide keyboard/alternative positioning on web;
- provide position presets for users who cannot drag precisely;
- overlay selection has clear focus;
- text contrast cannot rely on color alone;
- screen readers receive slide number and text;
- reorder mode has Move Up / Move Down alternatives.

---

# 43. Mobile Gesture Safety

Do not overload gestures.

Recommended:

```text
Swipe in read mode
→ navigate slides

Drag selected overlay in edit mode
→ move text

Pinch in explicit image-edit mode
→ zoom

Native text selection in read/text mode
→ select/copy text
```

One gesture should not have two possible meanings in the same state.

---

# 44. Desktop / Tablet

Larger screens may use:

- persistent slide thumbnail rail;
- larger canvas;
- contextual properties panel.

Still preserve one dominant action.

Do not expose every panel simultaneously just because space exists.

---

# 45. Visual QA — Setup

```text
[ ] Image count selection is immediately clear
[ ] Count is selected before generation
[ ] One primary Generate CTA
[ ] Style controls are compact
[ ] No oversized setup cards
[ ] No decorative empty space consuming the screen
```

---

# 46. Visual QA — Overview

```text
[ ] Slides are easy to scan
[ ] Text chunk appears on each slide by default
[ ] No action wall above slides
[ ] One prominent Continue CTA
[ ] Generate one more is findable but not dominant
[ ] Arrange is available but quiet
[ ] Rare actions are hidden
[ ] No permanent About/Materials/Versions/Rights/People tab row
```

---

# 47. Visual QA — Slide Editor

```text
[ ] Image dominates
[ ] Text overlay is easy to select
[ ] Text can be dragged
[ ] Text can be resized
[ ] Text remains editable/selectable
[ ] Tool rail contains only core categories
[ ] Advanced controls appear only in selected mode
[ ] Regenerate is contextual, not permanently dominant
```

---

# 48. Required E2E Flows

```text
Source → Create Carousel → choose 5 → generate
Generation → Overview → Continue
Overview → Generate one more
Overview → Arrange → reorder → Done
Overview → Slide → edit text → Done
Slide → Place text → drag → resize
Slide → Regenerate → custom instruction → choose variation
Slide → Full-screen view → return
Slide → Use different text chunk
Slide → Split text into two slides
Refresh → edits remain
Second device → same slide order/content
```

---

# 49. Button Audit Requirement

For every Carousel screen, count visible high-level actions.

Target:

```text
Primary actions: 1
Secondary visible actions: <=2
```

If exceeded:

- move action into Palette;
- move into More;
- reveal only after selection;
- combine equivalent actions;
- remove duplicates.

---

# 50. Example — Final Compact Carousel Overview

```text
‹            5 slides · v2              ⋯

Slides
Your words are matched to each image.

1  [image]  चाँद घटते-घटते…
2  [image]  और आईने के सामने…
3  [image]  धुंधली रोशनी में…
4  [image]  कुछ बातें हैं…
5  [image]  फिर भी भीतर कहीं…

+ Generate one more                 Arrange

[          Continue Creating          ]

Details ›                              🎨
```

This is preferred over:

```text
Continue Creating
Transform
Share
Context
Download
More
Show more styles
About
Materials
Versions
Rights
People
```

---

# 51. Example — Final Compact Slide Editor

```text
‹                 2 of 5                ⋯

┌───────────────────────────────────────┐
│                                       │
│                 IMAGE                 │
│                                       │
│    और आईने के सामने देखो तो—          │
│    बस एक तन्हाई है                    │
│                                       │
└───────────────────────────────────────┘

Text     Image     Regenerate     More

‹    [1] [2] [3] [4] [5]    ›

Done
```

When `Text` is tapped, reveal text controls.

When `Image` is tapped, reveal crop/focal controls.

When `Regenerate` is tapped, open the custom instruction sheet.

Do not show all controls simultaneously.

---

# 52. CLAUDE.md Standing Instruction

Add this block to repository `CLAUDE.md`:

```md
## Carousel Composer UI (owner's standing instruction)

The Wonder Creator Carousel experience is a compact composition workflow, not a generic image gallery or AI prompt UI.

* Before initial generation, always allow the creator to choose the initial number of images/slides. Use compact options such as 3/4/5/6 + optional Custom; default 5 unless product context specifies otherwise.
* Every initially generated slide receives a suggested source-text chunk by default. The creator must not manually add text to every image from scratch.
* Slide text remains real selectable/editable text. Do not flatten the only copy of text into image pixels.
* Each slide is an editable composition: image + source text chunk + display text + optional image-overlay text + overlay style/position + slide order.
* After initial generation, provide `Generate one more` to create exactly one additional slide/image at a time without regenerating the rest of the Carousel.
* `Generate one more` and `Show more styles` are different actions: one adds a slide; the other explores alternative visual treatments.
* Each individual slide supports `Regenerate this image` with an optional natural-language instruction. Regeneration affects only that slide and preserves the rest of the Carousel.
* Do not destructively replace the existing image immediately after regeneration. Prefer old/new variation selection (`Use new` / `Keep current`).
* Provide an `Arrange`/`Reorder slides` mode using compact draggable thumbnail/text rows. Reordering must not trigger regeneration.
* Tapping a slide opens a focused full-screen Slide Editor. Advanced editing does not live permanently on the Overview.
* In Slide Editor, support placing text on image, dragging the overlay, resizing it, changing position, alignment, style, colour, shadow/background treatment, and editing/replacing the underlying text chunk.
* Separate text Read/Selection mode from overlay Drag/Edit mode so mobile gestures do not conflict.
* Support full-screen image viewing/editing and compact image crop/zoom/focal controls.
* Overview screen: one prominent `Continue Creating` action; maximum two visible secondary actions (normally `Generate one more` and `Arrange`). Everything else is contextual.
* Do not show permanent button walls such as Continue + Transform + Share + Context + Download + More above the Carousel.
* Move Transform/Share/Context/Download/Rights/Versions/People and other less-frequent actions into the contextual Palette, `Details`, More, or slide overflow.
* Replace persistent About/Materials/Versions/Rights/People tab rows on the working Carousel screen with a compact `Details ›` entry.
* Use one high-emphasis action at a time. Normal mobile screens have max 1 primary + 2 secondary high-level actions.
* Keep buttons visually compact while preserving >=44×44 CSS px hit targets.
* Use minimal transitions: simple sheets/page transitions and 120–160ms content crossfades. No staggered card entrances, bounce, or elaborate AI-loading choreography.
* Generation state uses compact skeletons/status only; no assistant chat, fake progress or full-screen AI animation.
* All routine text/layout/order edits autosave. Do not require a Save button for every composition change.
* Preserve source text, source Creation/version, Material lineage, generation ID, image asset, overlay configuration and order for every slide.
* Ensure all slide edit and reorder operations are accessible without precision drag gestures alone.
```

---

# 53. Final Product Standard

The Carousel feature should make the next step obvious.

Before generation:

> **How many images should this Carousel have?**

After generation:

> **Does this sequence look right?**

Inside a slide:

> **How should this image and text be composed?**

Final interaction rule:

> **Show only the controls needed for the current creative decision. Reveal the rest when the creator asks for them.**
