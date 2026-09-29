# Wonder Creator — Phase 04
## CreativeStudio Integration: Working Table + Community + DejaVu

**Sequence:** 4 of 5  
**Depends on:** Phases 01–03  
**Blocks:** Final CreativeMind orchestration and optimization

---

## 1. Goal

Connect Moments, DejaVu, Community, and Open Conversations directly to CreativeStudio without cluttering the Canvas.

The CreativeStudio principle remains:

> Canvas = what is being made  
> Working Table = ingredients available  
> CreativeMind = understands relationships

The Studio should feel like a sturdy creative work surface, not a file manager.

Sources can come into view when needed, be used, and slide back down naturally after use.

---

## 2. Preserve the Working Table model

Source states:

```text
Available
In Use
Pinned
```

### Available
Present in the Studio session but not currently influencing the active selection/output.

### In Use
Actively influencing the selected slide/scene/block/Creation.

### Pinned
Must be respected across transformations/regeneration unless user explicitly allows change.

Do not create a fourth state just for Community.

Community, DejaVu, external sources, Materials, and previous Creations all use the same Working Table model.

---

## 3. Universal `Bring in`

Inside CreativeStudio provide one doorway:

```text
Bring in
```

Sources:

```text
Material
Previous Creations
Photo / Video
Voice recording
Note
File / PDF
Link / YouTube
Collection
Huddle moment
Person / Comment
Capture now
Community
DejaVu
Royalty-free images
```

Do not send the user to another page to complete common intake.

Use sheets/drawers over Studio.

---

## 4. DejaVu intake

`Bring in → DejaVu`

Example:

```text
Railways
23 Moments
```

Inside:

```text
[ All ] [ Photos ] [ Voice ] [ Notes ] [ Creations ] [ Conversations ]
```

User can multi-select:

- voice note
- Material photo
- Scrapbook entry
- Open Conversation reply
- previous Creation fragment

Action:

```text
Add to Studio
```

Do not dump the entire DejaVu on Canvas.

Selected items become **Available** on the Working Table.

---

## 5. Explore whole DejaVu in Studio

From a DejaVu page:

```text
Explore in Studio
```

Behavior:

- opens existing or new StudioSession;
- makes DejaVu context available;
- does not import every Moment as active;
- CreativeMind may highlight 3–5 likely relevant Moments later;
- Canvas remains unchanged until user acts.

Example:

```text
Railways
23 Moments available
```

---

## 6. Community → Studio actions

Contextual actions by source type.

### Public photograph

```text
Save as reference
Bring to Studio
Ask creator
```

### Poem / Scrapbook text

```text
Save to Materials
Use as inspiration
Invite to Huddle
```

### Open Conversation reply

```text
Save thought
Use in Studio
Reply
```

### Open Conversation

```text
Join conversation
Save idea
Bring to Studio
Start Huddle
```

Use max one visible primary action; secondary actions go into fan/preview menu or More.

---

## 7. Community item representation on Working Table

Example:

```text
Community thought
Maya · Open Conversation

“Treat each image like a pause
rather than an illustration.”

Role: Creative direction

[ Use ]  [...]
```

The source retains:

- creator;
- conversation;
- date;
- visibility;
- provenance;
- attribution;
- rights state.

---

## 8. Rights and provenance gate

Before using an external/public source in a consequential way, check rights.

Distinguish:

```text
Reference only
Reuse permitted
Attribution required
Unknown
Restricted
```

### Reference only
Allowed to influence style/idea semantically, but not copied into export.

### Reuse permitted
Can be inserted into output under source terms.

### Attribution required
Can be inserted if attribution is preserved.

### Unknown
Do not silently insert into final exported artifact.

### Restricted
Block incompatible action.

CreativeMind must never infer legal rights.

---

## 9. Royalty-free image sources

Add external royalty-free image discovery inside Working Table / Bring in.

Examples may include providers such as Pixabay and other approved providers, but implement provider-neutral adapters.

UI:

```text
Royalty-free images

Search: moonlit railway station

[ image ] [ image ] [ image ]
Pixabay   Provider B  Provider C
```

Each result should show:

- preview;
- provider;
- creator/photographer when available;
- license/reuse metadata;
- attribution requirements;
- source URL;
- save/reference/use action.

Do not hardcode one provider into the domain model.

Suggested adapter:

```ts
interface ExternalImageProvider {
  id: string;
  search(query: string, options?: SearchOptions): Promise<ExternalImageResult[]>;
  getAsset(id: string): Promise<ExternalImageResult>;
}
```

Store provenance when selected.

---

## 10. Natural source behavior

The Working Table must not become a scrolling wall.

### Default

Collapsed source rail/table.

Show:

```text
Sources 7
```

Tap to reveal compact rows/cards.

### When source is used

- mark In Use;
- move/animate into a compact influencing position if needed;
- after action completes, let it settle back into the Working Table;
- keep state indicator;
- do not leave expanded panels covering Canvas.

### Last-opened behavior

For accordion-like source rows:

- all chevrons can collapse;
- when one opens, previously open rows may collapse;
- user can intentionally leave none open;
- last opened source may remain open when the sheet is revisited;
- new sources use the same interaction.

Avoid permanent source panels.

---

## 11. Contextual actions inside source chevrons

Each source row exposes actions based on type and current Creation format.

### Image

```text
Add as new slide
Use on current slide
Use as background
Use as visual reference
Pin visual
```

### Text note

```text
Add as new slide
Use as caption
Refine current text with this
Use as writing reference
Pin quote
```

### Voice note

```text
Use transcript
Use selected fragment
Add as audio
Create slide from this
Use tone as reference
```

### Previous Creation

```text
Use text
Use visual style
Use structure
Use opening
Use ending
Use as reference
```

### Conversation reply

```text
Use as creative direction
Save as note
Refine current slide with this
Pin as constraint
```

### External royalty-free image

```text
Add as new slide
Use on current slide
Save as Material
Use as visual reference
```

The action list should be generated from source capability + current canvas mode, not hardcoded globally.

---

## 12. Carousel actions

Preserve explicit actions:

### Generate one more

```text
Generate one more
```

Meaning: add one additional slide/image.

Do not confuse with:

```text
Show more styles
```

Meaning: show alternate visual treatments.

New slide generation must preserve current Working Set and DejaVu context.

### Arrange / reorder

```text
Arrange
```

Behavior:

- show slide thumbnails/rows;
- drag handles;
- minimal editor chrome;
- save order immediately or on Done according to repo convention.

Navbar Context Line:

```text
Arrange 5 slides
```

### Refine text

On selected text:

```text
Refine text
```

Options may include:

```text
Shorter
Clearer
More poetic
More direct
Keep meaning
Custom…
```

A source can offer:

```text
Refine with this
```

Refinement must preserve lineage:

```text
original text
→ refinement operation
→ source references used
→ resulting text
```

---

## 13. Ask Community from CreativeStudio

Add action on selected Creation fragment:

```text
Ask Community
```

Examples of selectable fragments:

- slide;
- paragraph;
- image;
- opening;
- ending;
- audio fragment.

Flow:

```text
Selected: Slide 3

Question:
Does this line feel too literal?

Visibility:
Community

[ Ask ]
```

Only the selected excerpt and required context are shared.

Do not publish the full private Creation.

Create:

- Open Conversation;
- source link back to selected Creation fragment;
- Moment reference.

---

## 14. Community replies returning to Studio

Studio can surface:

```text
7 community responses
2 new
```

Open as a source group.

Each reply can:

```text
Use in Studio
Save thought
Reply
Dismiss
```

If `Use in Studio`:

- add reply Moment to Working Table;
- default role `feedback` or `creative direction`;
- allow role change.

---

## 15. Source roles

CreativeMind may suggest roles, but user controls them.

Possible roles:

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
Feedback
Creative direction
```

Never infer:

```text
Owned
Licensed
Safe to publish
Permission granted
```

Those are deterministic rights fields.

---

## 16. Fragments

Support partial use.

### Audio
- time range
- transcript quote
- tone
- sound

### Video
- clip
- frame
- scene

### Document
- quote
- fact
- passage
- section

### Creation
- whole
- text
- visual style
- scene
- structure
- opening
- ending

### Conversation
- reply
- quote
- selected idea
- summary later

A fragment should become a lightweight source reference without duplicating the canonical entity.

---

## 17. `What's influencing this?`

For selected slide/scene/block:

```text
What's influencing this?
```

or compact:

```text
Made from
```

Show:

- active source fragments;
- pinned constraints;
- generated-image source/model metadata when relevant;
- Community/public references;
- DejaVu context only if materially relevant.

Navbar can show:

```text
Slide 2 · 3 sources
```

---

## 18. Canvas clutter rules

The Canvas must remain visually dominant.

Rules:

- no permanent sidebars on mobile;
- source tray collapsed by default;
- one open source detail at a time;
- no giant tag clouds;
- no stacked banners;
- Huddle/community replies open in sheets;
- source actions disappear after use;
- working context remains retrievable from `Sources N`;
- avoid scrolling for primary canvas manipulation where possible.

---

## 19. StudioSession persistence

Persist enough to survive navigation:

```ts
interface StudioSession {
  id: string;
  creatorId: string;
  creationId?: string;
  outputFormat: string;
  sourceRefs: StudioSourceRef[];
  pinnedSourceRefs: string[];
  lastOpenedSourceId?: string;
  createdAt: string;
  updatedAt: string;
}
```

Do not create a formal Creation version for every source add/remove.

Formal versions remain meaningful checkpoints.

---

## 20. Suggested APIs

```text
POST /studio-sessions/:id/sources
DELETE /studio-sessions/:id/sources/:sourceId
PATCH /studio-sessions/:id/sources/:sourceId

POST /studio-sessions/:id/sources/from-dejavu
POST /studio-sessions/:id/sources/from-community
POST /studio-sessions/:id/sources/from-external-image

POST /creations/:id/fragments/:fragmentId/ask-community

GET /studio-sessions/:id/community-responses
POST /studio-sessions/:id/community-responses/:replyId/use
```

---

## 21. Tests

### Working Table

- all collapsed
- open one
- collapse all
- preserve last opened
- add new source
- source state Available → In Use → Available
- pin/unpin
- rights-restricted source

### DejaVu

- bring selected Moments
- whole DejaVu explore
- filters
- mixed types

### Community

- bring reply to Studio
- ask Community from private Creation fragment
- verify only selected excerpt shared
- reply appears in Studio
- source attribution remains

### Carousel

- add as new slide
- add one more
- reorder
- refine text
- use external royalty-free image
- provenance preserved

---

## 22. Acceptance criteria

- [ ] `Bring in → DejaVu` works.
- [ ] Community items can enter Working Table.
- [ ] External royalty-free image provider adapter exists.
- [ ] Source rows support contextual actions.
- [ ] All source chevrons can collapse.
- [ ] Last-opened source can be restored.
- [ ] New sources behave identically.
- [ ] Carousel supports Arrange/reorder.
- [ ] Carousel supports Refine text.
- [ ] Carousel supports Generate one more.
- [ ] Ask Community works from a selected fragment.
- [ ] Community replies can return as Studio sources.
- [ ] Rights/provenance gates prevent unsafe reuse.
- [ ] Canvas remains uncluttered.

---

## 23. Handoff to Phase 05

Phase 05 adds semantic Moment relationships, DejaVu suggestions, Community relevance, conversation summaries, Home orchestration, help-opportunity matching, contextual navbar phrasing, quality controls, and rollout safeguards.
