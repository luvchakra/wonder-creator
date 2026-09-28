# Wonder Creator — CreativeStudio Working Set / Convergence Surface Specification

**Status:** Implementation-ready product/UI/architecture specification  
**Date:** 28 September 2026  
**Audience:** Claude Code / engineering / product / design  
**Scope:** Rework CreativeStudio from a Creation editor into a cohesive convergence surface where multiple creative inputs, ideas, references, fragments and collaborators can be combined effortlessly.

---

# 1. Product Direction

CreativeStudio must stop behaving like:

> **an editor attached to one Creation**

and instead become:

> **the place where all ingredients of a Creation come together.**

The creator should be able to bring in:

- Materials;
- previous Creations;
- photos;
- videos;
- voice notes;
- text;
- files/PDFs;
- URLs/YouTube;
- references;
- Collections;
- Huddle moments;
- collaborator comments;
- CreativeMind discoveries;
- ideas captured during the session;

and combine them without repeatedly leaving CreativeStudio.

The simplest mental model is:

> **Bring things in → put them on the table → combine them → shape the result.**

---

# 2. Core Product Change

Introduce a first-class temporary CreativeStudio object:

# **Studio Working Set**

The Working Set contains the contextual ingredients available to the current CreativeStudio session.

It is separate from the durable Creations object.

Conceptually:

```text
CreativeStudio
├── Canvas
├── Working Set
└── CreativeMind
```

Where:

```text
Canvas
→ what is currently being made

Working Set
→ what is available to use

CreativeMind
→ understands relationships between those ingredients
```

---

# 3. Why the Working Set Exists

The Working Set solves several current problems:

- Materials feel separate from CreativeStudio;
- references require navigation away from the work;
- previous Creations are difficult to reuse fluidly;
- CreativeMind context is not visible enough;
- transformations feel like separate workflows;
- collaborators/Huddles do not feed naturally into the current work;
- creators cannot easily experiment with several inputs before committing them;
- temporary inspiration is forced too early into permanent Creation lineage.

The Working Set should make CreativeStudio the **creative convergence layer**.

---

# 4. Durable vs Temporary State

This distinction is mandatory.

## Durable

Persisted as part of the creator's long-term creative graph:

```text
Creations
Versions
Materials
Derivatives
Rights
Attribution
Provenance
Published outputs
```

## Temporary / working

Session-level context:

```text
Working Set
Active selections
Unused ideas
Temporary references
Suggested connections
Pinned constraints
Draft combinations
Exploration state
```

Do not write every experiment into durable Creation lineage.

Only promote meaningful used inputs/actions into durable provenance when the creator commits/applies them.

---

# 5. CreativeStudio Mental Model

The creator should understand CreativeStudio as:

```text
CURRENT WORK
    +
WHAT I BROUGHT IN
    +
WHAT WONDER CREATOR UNDERSTANDS
```

Not as a collection of separate modules.

---

# 6. Primary CreativeStudio Layout

## Mobile default

```text
┌──────────────────────────────────────┐
│ ‹       Autosaved · 4 sources     ⋯ │
├──────────────────────────────────────┤
│                                      │
│                                      │
│             CREATION                 │
│               CANVAS                 │
│                                      │
│                                      │
├──────────────────────────────────────┤
│ Sources 4                         🎨 │
└──────────────────────────────────────┘
```

The canvas remains visually dominant.

Do not permanently show:

- Materials panel;
- References panel;
- CreativeMind panel;
- Versions panel;
- Transform panel;
- Collaboration panel;
- Context panel.

These are revealed only when relevant.

---

# 7. Source Tray / Working Set Access

At the bottom of CreativeStudio show one compact affordance:

```text
Sources 4
```

or:

```text
4 sources
```

Tap to open the Working Set sheet.

Do not show multiple permanent buttons such as:

```text
Materials
References
Context
People
Add
```

All converge into the Working Set.

---

# 8. Working Set Sheet

Recommended mobile sheet:

```text
Working Set

IN USE

✓ Dad railway story
  Voice · 02:14

✓ Station at dusk
  Photo

✓ चाँद अमावस
  Creation · stanza 2

AVAILABLE

  Rain photograph
  Photo

  Nocturne
  Audio reference

+ Bring in
```

Sections:

```text
In Use
Available
Pinned
```

Do not show all three if empty.

---

# 9. Source States

Every item in the Working Set has one of three simple states.

## Available

Present in CreativeStudio, not currently influencing the active work.

```text
Available
```

## In Use

Actively influencing the current output.

```text
In Use
```

## Pinned

Must be preserved/treated as a constraint.

```text
Pinned
```

Examples:

```text
📌 Keep this quote exactly
📌 Preserve this photograph
📌 Maintain this musical mood
```

Pinned should be visually clear but not heavy.

---

# 10. Universal "Bring In" Action

CreativeStudio gets one universal intake action:

# **Bring in**

The creator should not have to leave the Studio to fetch context.

Open a compact picker:

```text
Bring in

Material
Previous Creations
Photo / Video
Voice recording
Note
File / PDF
Link / YouTube
Collection
Huddle moment
Comment / feedback
Capture now
```

Search remains available at the top.

---

# 11. Unified Search Inside "Bring In"

Search should query all relevant sources.

Example query:

```text
railway
```

Possible grouped results:

```text
Materials
- Dad railway voice note
- Station photograph
- Railway research PDF

Creations
- चाँद अमावस
- Platform 3

Huddles
- Saved moment from Independent Film Huddle

References
- Wong Kar-wai station reference
```

The creator can multi-select and tap:

```text
Add to Studio
```

---

# 12. Input Sources Supported

CreativeStudio Working Set should support:

```text
Materials
Existing Creations
Creation versions
Text selections/fragments
Photos
Video
Audio
Voice notes
Documents/PDFs
URLs
YouTube
Collections
Reference Shelf items
Huddle moments
Comments
Suggested changes
People/collaborators
CreativeMind discoveries
Project/Campaign brief context
```

Only expose sources appropriate to the current user permissions/context.

---

# 13. Inputs Are Ingredients, Not Attachments

When something is added to CreativeStudio, CreativeMind should infer **how it may be useful**.

Suggested roles:

```text
Story
Visual
Mood
Reference
Fact
Voice
Style
Constraint
Character
Structure
Sound
Quote
```

Example:

```text
Dad railway story
Story · Voice

Station at dusk
Visual · Memory

Nocturne
Mood · Music

Research PDF
Fact · Reference
```

The creator can correct these roles, but should not be required to classify everything manually.

---

# 14. Role Inference Rules

CreativeMind may suggest roles using existing metadata/summaries.

It must not infer:

- legal rights;
- ownership;
- permissions;
- sensitive personal traits;
- attribution.

Those remain deterministic domain facts.

---

# 15. Working Set Item Card / Row

Compact row example:

```text
🎙 Dad railway story
   Story · Voice                       ⋯
```

Optional indicators:

```text
✓ In use
📌 Pinned
Unused
```

Avoid large cards.

---

# 16. Multi-Select + "Use Together"

When 2+ sources are selected, show exactly one primary contextual action:

# **Use together**

Example:

```text
✓ Dad railway story
✓ Station photograph
✓ चाँद अमावस

[ Use together ]
```

Do not expose:

```text
Combine
Transform
Create
Reference
Analyze
Generate
Compare
```

simultaneously.

CreativeMind decides how to interpret the selected combination.

---

# 17. "Use Together" Behavior

When invoked:

```text
selected sources
→ CreativeMind summarizes roles/context
→ proposes one concise creative possibility
```

Example:

```text
These could become a visual spoken-word piece.
```

Actions:

```text
Use idea
Something else
```

Keep it lightweight.

Do not open a full AI chat.

---

# 18. meTalk + Working Set

meTalk becomes the natural manipulation interface for CreativeStudio context.

Examples:

```text
Use these three photos.

Ignore the research document for now.

Take the mood from this image, not the composition.

Use Dad's recording, but only the part about Platform 3.

Combine this old poem with the photographs I just added.

Use version 2's ending with version 4's opening.

Make a carousel from all of this.
```

meTalk updates Working Set/intent/context rather than becoming a separate conversation destination.

---

# 19. Source Fragments

CreativeStudio must support **fragments**, not only whole-source objects.

A fragment is a usable piece extracted from a larger source.

Examples:

## Audio

```text
quote
moment
time range
tone
sound
```

## Video

```text
clip
frame
moment
scene
```

## Document

```text
quote
fact
passage
idea
section
```

## Creation

```text
stanza
scene
paragraph
image
visual style
structure
ending
opening
```

---

# 20. Fragment Example

Working Set could contain:

```text
🎙 01:42–02:03
"Every Sunday my father waited at Platform 3"

📷 Station at dusk

📝 stanza 3
"चाँद घटते-घटते…"

🎵 00:31–00:52
Nocturne reference
```

This is the expected creative-table behavior.

---

# 21. Fragment Creation UX

From any source:

```text
Open source
→ select relevant part
→ Add fragment to Studio
```

Examples:

Audio:

```text
select timeline range
→ Add moment
```

Text:

```text
select passage
→ Add selection
```

Video:

```text
select clip/frame
→ Add moment
```

Creation:

```text
select scene/stanza/block
→ Use in Studio
```

---

# 22. Reusing Previous Creations

Inside:

```text
Bring in → Creations
```

Allow selection of:

```text
Whole Creation
Text
Visual style
Scene
Structure
Idea
Opening
Ending
```

Example:

```text
Use the visual style from "Monsoon Notes"
```

This should not copy all content.

Store the selected reuse intent explicitly.

---

# 23. Source Usage Intent

For reused Creations/references, record a usage intent:

```text
content
style
structure
mood
reference
fact
quote
visual
sound
```

This helps CreativeMind understand:

> "Use the mood, not the composition."

and improves provenance.

---

# 24. Format Must Be Independent From Inputs

Do not bind Working Set to a specific output type.

Architecture:

```text
Sources
   ↓
Creative context
   ↓
Creative intent
   ↓
Output format
```

The same Working Set may become:

```text
Poem
Carousel
Short film
Song
Photo essay
Poster
Script
```

Changing output format must not destroy the Working Set.

---

# 25. Transform Inside CreativeStudio

Transform should no longer feel like a separate app/module.

Preferred:

```text
CreativeStudio
→ "Make this a carousel"
→ canvas changes to Carousel Composer
→ Working Set stays intact
```

or:

```text
CreativeStudio
→ "Turn this into lyrics"
→ canvas switches to writing/lyrics mode
→ sources remain
```

The creator should keep the same ingredients while changing the output lens.

---

# 26. Studio Modes

CreativeStudio may have different canvas renderers:

```text
Writing
Image
Carousel
Video
Audio
Presentation
Document
```

But these should all share:

```text
Working Set
CreativeMind context
Pinned constraints
meTalk
Provenance
Autosave
Versioning
```

Do not build each media mode as an isolated product.

---

# 27. CreativeMind Connection Discovery

CreativeMind should quietly find useful relationships between Working Set items.

Examples:

```text
The second stanza mentions an empty room.
Photo 4 has a similar feeling.
```

```text
Dad talks about waiting at a station at 1:42.
This photograph may fit that moment.
```

```text
Two notes describe the same memory.
```

These appear as small contextual bubbles.

---

# 28. Connection Bubble

Example:

```text
✦ Possible connection

Dad voice note · 1:42
+
Station photograph

"Both describe waiting."

Use this connection
```

Only one high-value connection should be visible at a time.

Do not stack many AI cards.

---

# 29. "Use This Connection"

When tapped:

```text
connection
→ marks relevant fragments In Use
→ updates CreativeIntent
→ optionally updates canvas/draft
```

No chat required.

---

# 30. CreativeMind Connection Ranking

Rank suggestions by:

```text
semantic relevance
current selected area
recent creator intent
unused relevant source
pinned constraints
current output format
```

Avoid:
- novelty for novelty's sake;
- random suggestions;
- repeated suggestions;
- low-confidence relationships.

---

# 31. "What's Influencing This?"

CreativeStudio must make current AI/context influence inspectable.

Compact trigger:

```text
4 sources
```

Expanded view:

```text
IN USE
✓ Dad voice note
✓ Station photograph
✓ चाँद अमावस

AVAILABLE
  Rain photograph
  Railway research
  Nocturne
```

This should answer:

> **What is CreativeMind considering right now?**

---

# 32. Unused Sources

Do not discard unused sources.

CreativeMind may surface:

```text
2 sources are still unused
```

or:

```text
The station recording may fit the ending
```

This can appear:
- in the Adaptive Context Line;
- as one subtle CreativeMind bubble;
- in Working Set.

Do not nag repeatedly.

---

# 33. Pinned Constraints

Pinning is a first-class CreativeStudio interaction.

Examples:

```text
Pin exact quote
Pin image
Pin character
Pin visual style
Pin source fact
Pin ending
```

Pinned content must be respected by CreativeMind generation/refinement.

If a requested action conflicts with a pin:

```text
show a concise conflict state
```

Example:

```text
This change would alter a pinned quote.
```

Primary options:

```text
Keep pinned
Allow change
```

---

# 34. Huddle → CreativeStudio

Huddles should feed directly into Studio.

During a Huddle support:

```text
Save to Studio
```

Possible saved items:

```text
idea
voice moment
quote
reference
shared Material
screenshot/frame
decision
```

If a CreativeStudio session is active, saved items appear in its Working Set.

---

# 35. Collaborator Comment → CreativeStudio

Comments/suggestions can become working context.

Example:

```text
Maya:
"The opening should feel emptier."

Use in Studio
```

This adds:

```text
Feedback · Constraint
```

to the Working Set.

The comment itself remains linked to its original collaboration history.

---

# 36. Project / Creative Room Context

When CreativeStudio is opened inside a Project/Creative Room, automatically make relevant context available:

```text
Project brief
Goals
Current deliverables
Pinned references
Rights constraints
Campaign constraints
```

Do not automatically mark all of them In Use.

Make them Available by default unless explicitly required.

---

# 37. Rights / Permission Boundaries

Working Set access must respect the owning domain.

Before adding a source:

```text
resolve creator
check access
check collaborator permissions
check source visibility
check rights restrictions
```

Do not expose unauthorized source content through CreativeMind summaries.

---

# 38. Provenance

When an input actually influences a committed result, persist provenance.

For each used source/fragment record:

```text
source type
source id
source version
fragment range/selection
usage intent
contributor
rights metadata reference
timestamp
```

Temporary Available items do not need to become permanent lineage.

---

# 39. "Made From" View

For a selected Creation block/slide/scene:

```text
Made from
```

may show:

```text
Dad voice note · 01:42
Station photograph
चाँद अमावस · stanza 2
```

This is hidden by default.

Use as on-demand provenance/traceability.

---

# 40. StudioSession Domain Model

Suggested conceptual model:

```ts
type StudioSession = {
  id: string;
  creatorId: string;
  creationId: string;
  creationVersionId?: string | null;

  outputMode:
    | "writing"
    | "image"
    | "carousel"
    | "video"
    | "audio"
    | "presentation"
    | "document";

  activeSelection?: StudioSelection | null;

  workingSet: StudioSourceRef[];

  creativeIntent?: StudioCreativeIntent;

  status:
    | "active"
    | "paused"
    | "committed"
    | "abandoned";

  createdAt: string;
  updatedAt: string;
};
```

---

# 41. StudioSourceRef

```ts
type StudioSourceRef = {
  id: string;

  sourceType:
    | "material"
    | "creation"
    | "creation_version"
    | "fragment"
    | "reference"
    | "huddle_moment"
    | "comment"
    | "project_context"
    | "external";

  sourceId: string;

  state:
    | "available"
    | "in_use"
    | "pinned";

  roles: Array<
    | "story"
    | "visual"
    | "mood"
    | "reference"
    | "fact"
    | "voice"
    | "style"
    | "constraint"
    | "character"
    | "structure"
    | "sound"
    | "quote"
  >;

  usageIntent?: string | null;

  fragment?: StudioFragment | null;

  addedBy: string;
  addedAt: string;
};
```

---

# 42. StudioFragment

```ts
type StudioFragment = {
  kind:
    | "text_range"
    | "audio_range"
    | "video_range"
    | "frame"
    | "scene"
    | "stanza"
    | "page"
    | "section";

  start?: number | string;
  end?: number | string;

  label?: string;
  summary?: string;
};
```

---

# 43. Creative Intent

```ts
type StudioCreativeIntent = {
  goal?: string;
  format?: string;
  mood?: string[];
  style?: string[];
  audience?: string;
  preserve?: string[];
  avoid?: string[];
};
```

CreativeMind may help infer this, but the creator remains able to edit it.

---

# 44. Persistence Strategy

Recommended:

```text
Working Set
→ persisted enough to survive navigation/session interruption

Active selection
→ ephemeral/session state

Pinned items
→ persisted with StudioSession

Committed source usage
→ promoted to durable Creation provenance
```

Do not lose a Working Set because the creator opens another page briefly.

---

# 45. Resume CreativeStudio

When returning:

```text
Resume session
```

should restore:

```text
Working Set
In Use/Available/Pinned states
Canvas draft
Current output mode
Recent CreativeIntent
```

Adaptive navbar may say:

```text
4 sources · 1 unused
```

or:

```text
You left this with 5 sources
```

---

# 46. CreativeStudio Autosave

Autosave:

```text
Working Set membership
source states
pins
creative intent
draft edits
selected fragments
canvas edits
```

Do not require manual Save for routine CreativeStudio work.

---

# 47. Version Creation

Do not create a formal Creation version for:

```text
adding a source
removing an unused source
temporary selection
pin toggle
Working Set sorting
```

Create durable versions at meaningful checkpoints:

```text
Apply CreativeMind result
Transform format
Commit major refinement
Continue/Finish checkpoint
Publish
```

Follow existing Creation version rules.

---

# 48. Working Set API

Suggested endpoints/actions:

```text
POST   /studio-sessions
GET    /studio-sessions/:id
PATCH  /studio-sessions/:id

POST   /studio-sessions/:id/sources
PATCH  /studio-sessions/:id/sources/:sourceId
DELETE /studio-sessions/:id/sources/:sourceId

POST   /studio-sessions/:id/fragments
POST   /studio-sessions/:id/use-together
POST   /studio-sessions/:id/pin
POST   /studio-sessions/:id/unpin
POST   /studio-sessions/:id/commit
```

Adapt to existing API/domain conventions.

---

# 49. CreativeMind Tooling

Possible governed tools:

```text
studio_add_source
studio_remove_source
studio_mark_in_use
studio_pin_source
studio_extract_fragment
studio_use_together
studio_find_connections
studio_change_output_mode
studio_commit_result
```

CreativeMind may propose tool actions, but permission/autonomy still applies.

---

# 50. Use Together Tool

Suggested input:

```ts
type UseTogetherInput = {
  studioSessionId: string;
  sourceRefs: string[];
  creatorInstruction?: string;
};
```

Output:

```ts
type UseTogetherResult = {
  proposedIntent: string;
  proposedFormat?: string;
  sourceRoles: Record<string, string[]>;
  connectionSummary?: string;
  draftAction?: string;
};
```

Do not directly commit changes unless autonomy permits.

---

# 51. Connection Discovery Tool

Input:

```text
current StudioSession
active selection
Working Set summaries
CreativeIntent
```

Output max:

```text
1–3 candidate connections
```

UI should show only one at a time.

---

# 52. Context Payload Rules

CreativeMind should receive:

```text
current Creation summary
current selected block/scene
In Use sources
Pinned sources
high-relevance Available sources
CreativeIntent
current output mode
```

Do not automatically send:
- full account history;
- every Material;
- every past Creation;
- all Huddle transcripts.

Retrieve only when needed.

---

# 53. Source Summaries

Prefer compact precomputed summaries.

Example:

```json
{
  "source": "audio",
  "title": "Dad railway story",
  "summary": "Father recalls waiting at Platform 3 every Sunday.",
  "state": "in_use",
  "roles": ["story", "voice"]
}
```

Avoid passing raw long transcripts when a summary is sufficient.

---

# 54. Performance

CreativeStudio must remain fast even with many sources.

Use:

```text
lazy source details
thumbnail derivatives
summary-first loading
virtualized long Working Sets
on-demand transcript/document loading
```

Do not load every raw source asset into memory.

---

# 55. Working Set Limits

Do not impose a tiny artificial source limit.

However, to maintain useful CreativeMind context:

```text
allow many Available items
limit active In Use context intelligently
```

If too many items are In Use, surface:

```text
12 sources are influencing this.
Narrowing the set may improve control.
```

Do not silently drop sources.

---

# 56. Source Ordering

Default Working Set order:

```text
Pinned
In Use
Available
```

Within sections:

```text
recently added
or relevance
```

Do not reorder constantly as AI scores change.

Stability matters.

---

# 57. "Bring In" From Page Context

Contextual shortcut:

If creator opens CreativeStudio from a Material:

```text
that Material is automatically Available/In Use
```

If opened from a Creation derivative:

```text
source Creation/version is automatically Available/In Use
```

If opened from Huddle:

```text
saved Huddle context is available
```

Keep this deterministic.

---

# 58. CreativeStudio + Carousel Composer

Carousel Composer should become a CreativeStudio output mode.

Example:

```text
Working Set
- poem
- 4 photos
- voice note

meTalk:
"Make this a carousel."

CreativeStudio
→ outputMode = carousel
→ same Working Set remains
→ Carousel canvas appears
```

Carousel slide generation uses Working Set + selected fragments.

---

# 59. CreativeStudio + Image Generation

Contextual image generation should pull from:

```text
In Use sources
Pinned visual/style references
CreativeIntent
current selected block/slide
```

Do not use all Available sources unless explicitly selected/recommended.

---

# 60. CreativeStudio + Versions

Versions become a contextual Studio capability.

Do not show a permanent Versions tab.

When relevant:

```text
v4
→ tap navbar/context
→ version sheet
```

or Palette:

```text
Versions
```

Working Set can include fragments from older versions.

---

# 61. CreativeStudio + Creative Quality

Quality Review should operate on the current canvas while keeping Working Set visible/available.

A suggestion may reference sources:

```text
The opening conflicts with the pinned voice note.
```

or:

```text
The ending no longer uses the strongest source quote.
```

This makes quality context-aware.

---

# 62. CreativeStudio + Discovery

Discovery becomes contextual input discovery.

Instead of leaving Studio to browse:

```text
CreativeMind:
"3 existing Materials may fit this scene."
```

Tap:

```text
Review
```

They appear in Working Set as suggested Available items.

User decides whether to use them.

---

# 63. CreativeStudio + People

Collaborators can contribute sources/context without taking over the canvas.

Examples:

```text
Maya added 2 references
Arjun suggested a scene
```

These appear in Working Set/activity.

Presence remains compact.

---

# 64. UI Action Hierarchy

Default CreativeStudio:

```text
Primary:
actual editing/creation

Visible secondary:
Sources
Palette
```

No visible action wall.

When Working Set is open:

```text
Primary:
Bring in

Conditional:
Use together
```

When a connection appears:

```text
Primary:
Use this connection
```

Only one dominant action per context.

---

# 65. Adaptive Navbar Examples

Default:

```text
Autosaved · 4 sources
```

Many unused:

```text
2 sources still unused
```

Pinned:

```text
3 sources · 1 pinned
```

Collaboration:

```text
Maya is editing · 4 sources
```

Processing:

```text
Creating carousel…
```

Offline:

```text
Offline · Saved locally
```

Operational truth overrides semantic AI text.

---

# 66. Context-Aware Palette — CreativeStudio

Recommended first-level Palette:

```text
Transform
People
Versions
More…
```

When relevant, replace items contextually.

Do not include:

```text
Materials
References
Context
```

because those now belong to the Working Set.

---

# 67. Minimal Transition Rules

Opening Working Set:

```text
bottom sheet
180–240ms
```

Selecting source:

```text
state update
120–160ms crossfade
```

Switching output mode:

```text
one canvas transition
150–220ms
```

Do not animate every source/card.

No:
- flying ingredients;
- bouncing sources;
- elaborate AI combination animation;
- multiple sequential transitions.

---

# 68. Empty CreativeStudio

If there is no content:

```text
Start with anything
```

Primary:

```text
Bring in
```

Secondary:

```text
meTalk
```

Do not display 8 source-type buttons.

---

# 69. Empty Working Set

```text
Nothing here yet.

Bring in a photo, note, voice, Creation or reference.
```

Primary:

```text
Bring in
```

---

# 70. Permission / Missing Source State

If source access is lost:

```text
This source is no longer available.
```

Keep provenance reference where legally/technically permitted.

Do not expose content after permission revocation.

---

# 71. Conflict State

If pinned/rights/project constraints conflict with an action:

```text
This change conflicts with a pinned source.
```

or:

```text
This source cannot be used for this commercial output.
```

Use deterministic domain rules.

Do not let CreativeMind override them.

---

# 72. Security

Every source load must respect:

```text
RLS
creator ownership
project membership
crew permissions
share scope
rights policies
signed storage access
```

CreativeStudio should never become an authorization bypass merely because multiple domains converge there.

---

# 73. Audit

Audit consequential actions such as:

```text
source permission changes
rights-sensitive use
external publication
license use
collaboration access changes
```

Do not audit every drag/reorder/temporary selection as a high-level event.

---

# 74. Analytics / Product Telemetry

Useful events:

```text
studio_session_started
studio_source_added
studio_source_removed
studio_source_marked_in_use
studio_source_pinned
studio_fragment_created
studio_use_together
studio_connection_shown
studio_connection_used
studio_output_mode_changed
studio_result_committed
```

Do not log raw private creative content.

---

# 75. Success Metrics

Measure:

```text
sources per StudioSession
% sessions using >1 source
cross-source combinations
previous Creations reused
fragments used
connections accepted
time spent navigating away from Studio
transformations completed inside Studio
unused source recovery
```

A major success metric:

> **Creators can complete more of their creative work without leaving CreativeStudio.**

---

# 76. Migration From Current CreativeStudio

## Phase A — Working Set foundation

Build:

```text
StudioSession
Working Set
Source states
Bring in picker
Persistence
```

No major AI behavior required yet.

## Phase B — Unified source intake

Add:

```text
Materials
Creations
Collections
Huddle moments
Comments
Capture
Search
```

## Phase C — Fragments

Add extraction/selection for:

```text
text
audio
video
Creations
documents
```

## Phase D — CreativeMind convergence

Add:

```text
role inference
Use together
connection discovery
unused source suggestions
```

## Phase E — Unified transformations

Move:

```text
Carousel
Writing transform
Image transform
Video transform
Audio transform
```

into shared CreativeStudio output modes.

## Phase F — provenance/quality integration

Add:

```text
Made from
quality-source awareness
pinned constraints
durable lineage promotion
```

---

# 77. Do Not Refactor Everything At Once

Preserve existing:

```text
Creation APIs
Material domain ownership
versioning
rights
RLS
provider adapters
CreativeMind governance
Huddle domain
collaboration domain
```

CreativeStudio should **compose** existing domains.

Do not move all source records into a new Studio table.

Store references.

---

# 78. Domain Ownership Rule

CreativeStudio owns:

```text
StudioSession
Working Set membership
source usage state
pins
active creative intent
temporary convergence state
```

Existing domains continue to own:

```text
Materials
Creations
Huddles
Comments
Projects
Rights
People
```

CreativeStudio references them.

---

# 79. Mobile Acceptance Criteria

```text
[ ] Canvas remains dominant
[ ] Working Set opens without leaving Studio
[ ] User can add Materials and Creations without route hopping
[ ] User can search all relevant source types
[ ] 2+ selected sources expose one clear Use together action
[ ] Sources show Available/In Use/Pinned
[ ] Source fragments can be added
[ ] meTalk can manipulate Working Set
[ ] Output mode can change without losing Working Set
[ ] Previous Creations can be reused partially
[ ] Huddle moments/comments can enter Working Set
[ ] AI connections appear one at a time
[ ] What's influencing this? is inspectable
[ ] No permanent AI/sidebar clutter
[ ] No action wall
[ ] 44px touch targets preserved
[ ] Working Set survives navigation/resume
```

---

# 80. E2E Flows

Required:

```text
Material → CreativeStudio → source appears In Use
CreativeStudio → Bring in → search → add 3 sources
Select 3 sources → Use together
Voice note → extract fragment → add to Working Set
Previous Creation → use only visual style
Previous Creation → use specific stanza
Huddle moment → Save to Studio
Comment → Use in Studio
Pin quote → refinement preserves quote
Change output from writing → carousel → Working Set persists
meTalk → "ignore the PDF" → source moves to Available
meTalk → "use these two photos" → sources move In Use
CreativeMind suggests connection → Use this connection
Commit result → durable provenance contains used sources only
Resume Studio → Working Set restored
Revoked source access → source content unavailable
```

---

# 81. Visual QA

CreativeStudio should pass:

```text
[ ] Current Creation is visually dominant
[ ] Sources affordance is compact
[ ] No permanent Materials/References/Context tabs
[ ] Working Set rows are compact
[ ] One connection suggestion max
[ ] One prominent action max per state
[ ] No duplicate Palette/page controls
[ ] Available/In Use/Pinned states are understandable
[ ] No AI-chat visual language
[ ] No unnecessary page transitions
[ ] No nested card explosion
```

---

# 82. CLAUDE.md Standing Instruction

Add this block to repository `CLAUDE.md`:

```md
## CreativeStudio convergence / Working Set (owner's standing instruction)

CreativeStudio is not merely an editor for a Creation. It is the convergence surface where the creator brings multiple inputs together and shapes them into Creations.

* Introduce a persistent `StudioSession` / `Working Set` concept containing temporary source references, fragments, current intent, pins and usage state.
* Keep the current Creations object as the durable output. Do not write every Studio experiment into permanent lineage.
* CreativeStudio default mobile UI is Canvas-first. The canvas dominates; a compact `Sources N` affordance opens the Working Set. Do not show permanent Materials/References/Context/CreativeMind panels.
* Provide one universal `Bring in` action inside CreativeStudio. It can bring in Materials, previous Creations/versions, photo/video, voice, note, file/PDF, link/YouTube, Collection, Huddle moment, collaborator comment/feedback, references or capture-now content.
* Search inside `Bring in` should span relevant source types so users do not leave CreativeStudio to find context.
* Every Working Set item has a simple state: `Available`, `In Use`, or `Pinned`.
* CreativeMind may infer source roles such as Story, Visual, Mood, Reference, Fact, Voice, Style, Constraint, Structure, Sound or Quote. Users can correct roles. AI never infers legal rights/ownership/permissions.
* When 2+ sources are selected, expose one contextual primary action: `Use together`.
* `Use together` should combine source context through CreativeMind and produce one concise proposed creative possibility, not a new AI chat flow.
* Support source fragments: text ranges, audio ranges, video clips/frames, document sections, Creation scenes/stanzas/blocks, etc.
* Previous Creations must be reusable partially: Whole Creation, Text, Visual Style, Scene, Structure, Idea, Opening, Ending. Record the reuse intent.
* Output format is independent from the Working Set. Changing from writing → carousel → image → video must not discard sources/context.
* Transformations should occur inside CreativeStudio by changing the canvas/output mode while preserving the Working Set.
* meTalk manipulates Studio context directly: e.g. `use these photos`, `ignore the PDF`, `take the mood from this image`, `use only the Platform 3 part`, `make a carousel from all of this`.
* CreativeMind should quietly discover meaningful source relationships and surface at most one high-value contextual connection at a time. Never stack AI suggestion cards.
* Provide an inspectable `What's influencing this?` view showing In Use / Available / Pinned sources so creators understand what CreativeMind is considering.
* Unused sources remain available and may be surfaced contextually later; do not discard them automatically.
* Pinned sources/quotes/styles act as explicit constraints. If an operation conflicts with a pin, ask before altering it.
* Huddle moments and collaborator comments can be sent directly into an active CreativeStudio Working Set via `Save to Studio` / `Use in Studio`.
* Projects/Creative Rooms may make briefs/goals/references/constraints available to Studio, but should not mark everything In Use automatically.
* CreativeStudio owns StudioSession/Working Set state; Materials, Creations, Huddles, Projects, Rights, People and Comments remain owned by their existing domains. Store references rather than duplicating domain truth.
* Durable Creation provenance should be updated only for sources/fragments actually used in a committed result.
* Routine Working Set changes autosave. Do not create a formal Creation version for every add/remove/select/pin operation.
* Keep page controls minimal: actual creative work is primary; `Sources` and Palette are secondary. Avoid permanent action walls.
* Preserve existing RLS, permissions, rights, governance and provider boundaries. CreativeStudio convergence must never become an authorization bypass.
```

---

# 83. Final Product Standard

CreativeStudio should feel like:

> **a creative table where everything useful can be brought together.**

The creator should be able to:

```text
bring anything
select anything
combine anything
change format
reuse earlier work
keep constraints
see what is influencing the result
commit only what matters
```

without repeatedly leaving the Studio.

The governing rule is:

> **CreativeStudio owns the temporary creative context of the work; Creations own the durable result.**
