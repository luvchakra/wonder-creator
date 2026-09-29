# CreativeStudio integration — Working Table + Community + DejaVu (Phase 04)

Owner spec: [`docs/phases/04-creativestudio-community-dejavu.md`](phases/04-creativestudio-community-dejavu.md) (29 Sep 2026).
Builds on the Working Set (`docs/ui-redesign/creative-studio-working-set.md`), Moments + DejaVu (`docs/moments-dejavu.md`)
and Community (`docs/community.md`).

> Canvas = what is being made · Working Table = ingredients available · CreativeMind = understands relationships

## One model for everything

Community, DejaVu, royalty-free pictures, Materials and previous Creations all use the same Working Table: **Available /
In use / Pinned**. There's no fourth state for Community. A source is a *reference* (`studio_sources`), never a copy;
the owning domain keeps its truth and its read rules (`app.can_see_studio_source`, security invoker).

New source types (migration `…062_studio_community.sql`): `conversation`, `conversation_reply`, `scrapbook_entry` —
only what the creator can already read (removed conversations, deleted/removed replies, Limited conversations they
weren't added to, private Scrapbook entries and anything across a block are refused by the database). New roles:
`feedback`, `creative_direction`. Roles describe use; they never describe rights.

## Rights and provenance gate (§8)

`@wonder/creator-library/source-rights` — deterministic, client-safe, never inferred by CreativeMind:

| State | Where it comes from | What it allows |
| --- | --- | --- |
| Reuse permitted | your own things; CC0 / PDM; Pixabay and Pexels licences | into the piece |
| Attribution required | CC BY, CC BY-SA (credit kept on the source: “By … · licence · provider”) | into the piece, credited |
| Reference only | someone else's Community words, Creations, Materials; saved thoughts; web links; CC BY-ND | steer only |
| Rights unknown | no licence on record | steer only — never silently inserted |
| Restricted | an incompatible use | blocked |

`workingSetView` computes `rights` (and `attribution`, `author`) per row. `materialActionsFor` offers inserting actions
(`INSERTING_ACTIONS`: new slide, slide image, cover, words on slide, split, add to draft, use a part) only when
`canInsert(rights)`; otherwise it offers steering actions (Use as creative direction / visual reference, Refine with this,
Pin as constraint). The apply route checks again and answers **403** — the UI is not the boundary. The External route
refuses “Use as slide” for a picture whose licence doesn't allow reuse.

## Bring in (§3)

One doorway, eleven kinds: Materials, My Creations, Capture, Link / YouTube, Collection, Huddle moment, Person / Comment,
**DejaVu**, **Community**, **Royalty-free images**, Browse. Everything happens in sheets over the Studio.

- **DejaVu** (§4): pick a DejaVu (“Railways · 23 Moments”), filter All / Photos / Voice / Notes / Creations /
  Conversations, multi-select, **Add to Studio** → `POST /studio-sessions/:id/sources/from-dejavu`. Chosen Moments become
  Available; never the whole DejaVu, never on the Canvas. Moment kinds the table can't hold yet are shown, disabled.
- **Community**: search conversations, replies and Scrapbook entries the creator can see (`?only=community`). Recent
  stays the creator's own things.
- **Royalty-free images** (§9): the Working Table's External tab. Provider-neutral adapters —
  `ExternalImageProvider { id, label, connected, search, getAsset }` in `external-images.ts` (Openverse, Pixabay,
  Pexels). Each result shows provider, creator, licence, rights state and source link; the licence is looked up again on
  the server, and it's kept in the Material's provenance.

## Explore a whole DejaVu (§5)

DejaVu page → **Explore in Studio** → “In the Studio you were last in” or “In a new Creation”
(`POST /api/v1/dejavus/:id/explore`). The session records `dejavu_id`; the Working Table shows
“Railways · 23 Moments available ›”, which opens the DejaVu intake. Nothing is imported; the Canvas is unchanged.

## Community → Studio (§6–7)

- Open Conversation (More): **Bring to Studio**.
- A reply (its ⋯): **Use in Studio**, **Save thought** (a credited note in Materials — still reference only).
- Scrapbook entry: **Use as inspiration** (others') / **Bring to Studio** (yours).

They land on the Working Table of the Studio the creator was last in, Available, as “Community thought · Maya”, with
creator, conversation, date and rights kept. With no Studio open, the note says where to start one.

## Ask Community (§13)

Studio → More → **Ask Community** about one part: the slide on screen (“Slide 3”), the selected passage, or the opening.
`POST /api/v1/artifacts/:id/ask-community` creates an Open Conversation with `source_entity` = the Creation and
`source_fragment` = `{label, text ≤ 1200, slideId?}`. Readers see the excerpt (“From a Creation … keeps private — only
this part is shared”), never the Creation. The excerpt is insert-only (no update grant) and only allowed on a
conversation about the owner's own work. A Moment of the conversation is made by the Phase 01 trigger.

## Replies come back (§14)

`GET /studio-sessions/:id/community-responses` → “7 community responses · 2 new” (new = since the creator last read that
conversation). The Working Table shows the line; the bottom bar adds “· 2 new replies”. Each response: **Use in Studio**
(`…/:replyId/use` → Available, role Feedback), Save thought, Reply, Dismiss (`DELETE …/:replyId`, stored in
`studio_sessions.dismissed_replies`; the reply is untouched).

## Natural source behaviour (§10, §19)

Rows stay collapsed; any one can open; all can be closed. The last opened row is kept in
`studio_sessions.last_opened_source_id` (so it comes back on another device) and mirrored on the device for an instant
answer. New sources behave the same. Rights appear on a row only when they limit what can be done.

## Carousel (§12, §17)

Generate one more, Show more styles, Arrange and Refine text are unchanged (`docs/ui-redesign/carousel-composer.md`).
The navbar says **Arrange N slides** while arranging and **Slide N · M sources** otherwise (sources used in that slide —
derived by `slideUsage` — plus pinned ones). “What's influencing this?” lists each source with its rights and credit.

## Tests

`tests/db/studio-community.test.ts`, `packages/creator-library/src/source-rights.test.ts`,
`packages/creator-studio/src/working-set.test.ts`, `e2e/studio-integration.spec.ts`, plus the Arrange / Slide line in
`e2e/carousel.spec.ts`.
