# Creation pages — each format opens a page built for it

Owner request (4 Oct 2026): in **Make a new Creation**, choosing a format opens a page equipped for that format, with
minimal buttons and the best way to handle it. Plan approved the same day ("approved, start with step 1").

## Principle

- **The canvas is the work.** One primary action; at most two visible secondary actions; everything else behind
  **More** and the Palette (interaction-minimalism.md).
- **Same frame everywhere:** header (back · title · version · saved · people · More), the Working Table bar, and Save
  as version. The Working Set, sources and CreativeMind behave as in creative-studio-working-set.md.
- **One address per format.** `creationPath(id, type)` (`@wonder/creator-studio/pages`) says where a Creation is
  worked on. `/creations/[id]/studio` forwards a Creation that has its own page there (keeping `?action`, `?add`,
  `?from`), so every older link and Palette "Continue" still lands right. Formats without a page yet keep the Studio.
- Rights, RLS and governance are unchanged: a page is presentation over the same domains.

## Order (one PR each, merged before the next)

| Step | Page | Status |
| --- | --- | --- |
| 1 | **Writing** `/creations/[id]/write` + routing from the sheet | Done |
| 2 | **Images** `/creations/[id]/image` | Done |
| 3 | **Audio**: recorder (the voice-note recorder) above the words; Record / Write / Listen; Transcribe when the provider is live; export audio + text; a simple player page as the public link | Done |
| 4 | **Presentation**: current slide large + strip; Edit slide / Add slide / Present; themes from the named palettes (Editorial Paper, Cinematic Dark, Soft Gradient); speaker notes; export via web-page print | Not started |
| 5 | **Video**: storyboard + script (shots with frame, line, duration); Write / Add shot / Play through (animatic); exports; Render only when a video provider is connected (honest "not connected" otherwise) | Not started |

Shared across formats as they arrive: Publish as link, Download everywhere, one cover/background component, one
text-on-image component.

## Writing (step 1)

- **Canvas.** The words set one of three ways, chosen in Cover and kept with the Creation (`artifacts.presentation.look`,
  migration 082): **Over the cover** (as before), **Blurred behind** (the cover softly blurred, the words on a
  translucent paper panel), **Paper** (the reading page's paper; the default when there's no cover). Verse is centred in
  Playfair with generous leading; screenplays keep their mono layout. While the page is empty the kind can be chosen —
  **Passage · Poem · Screenplay** — changing the type within writing only (the words stay).
- **Primary: Write** (pen). Writing happens on paper; **Done** sets the words back on their cover or paper.
- **Secondary: Cover** — the creator's pictures (Quick Pics and brought-in pictures are Materials), or **Let CreativeMind
  make one** through contextual image generation (the same cached visual directions as the Creation page; nothing
  regenerates by itself; "Image generation isn't connected" when it isn't); "Use as cover" keeps it as a Material first.
  No cover → paper. **Read** — `/creations/[id]/read`.
- **More:** Publish as link · Refine with CreativeMind · Export (Markdown, text, web page; Fountain for scripts) · Share
  privately · Save version · Versions · What's influencing this? · Ask Pulse · Change format · Rights.
- **Publish as link** uses CreatorPublish (docs/creator-publish.md): the latest saved version, frozen, at
  `/p/<handle>/<slug>` with the cover, the chosen look, the paper and the creator's name — no counts. "Anyone with the
  link" by default; **Show on my Creator Page** (public) is off by default. Unsaved words are pointed out with Save a
  version; newer versions offer "Publish the latest version"; Take it down unpublishes. The published page keeps the
  look (`snapshot.look`). Rights and RLS are unchanged; "More publishing choices" opens the full Publish page.

### Writing kinds (owner, 4 Oct 2026)

"Allow option to choose if it's a poem, essay, article, prose, news… based on writing type, change layout a bit to suit
that writing style, take cue from international literature publications." The kind is the small line above the title
(tap it, any time; the words stay): Poem · Prose · Essay · Article · News · Story · Review · Letter · Lyrics · Spoken
word · Screenplay · Blog post (Prose, News, Review and Letter are new types). `writingStyleOf(type)` picks how it's set,
the same on the canvas, the Read page and the published page (`components/writing/written-piece.tsx`):

| Style | Kinds | Set like | On the page |
| --- | --- | --- | --- |
| verse | poem, lyrics, spoken word | a poetry journal | centred, generous leading, stanzas kept, wrapped lines balanced |
| essay | essay, review, statement, biography | a literary review | drop cap, book paragraphs (indented, no gaps), byline in small capitals |
| feature | article, blog post, newsletter… | a magazine feature | large headline, first paragraph as an italic standfirst, byline, airy paragraphs |
| news | news | a newspaper | bold headline, byline and date between rules, a strong lead paragraph (no invented dateline), plain reading face |
| fiction | story, prose, narration, treatment | a fiction page | italic centred title, opening line in capitals, indented paragraphs, ⁂ between scenes |
| letter | letter | a letter | the date at the right, the greeting in italics, the sign-off set to the right |
| script | screenplay, script, dialogue | a screenplay | mono, title underlined in capitals |

## Images (step 2)

- **Canvas.** The picture is the work, on paper, with its caption beneath; a strip of thumbnails when there are several
  (a photo essay). Empty: "Begin with a picture" — **Take a picture** (the phone's own camera), **Your pictures** (picture
  Materials, Quick Pics included), **Make one** (contextual image generation; "Use this picture" keeps it as a Material).
- **Primary: Edit** (Add a picture until there is one). Six tools on a live preview: **Crop** (Free · 1:1 · 4:5 · 16:9 ·
  9:16 and zoom), **Focus** (tap the picture or a nine-spot grid), **Filter** (Original · Warm · Cool · Film · Mono ·
  Fade), **Light** (brightness, contrast), **Blur** behind the words, **Frame** (none, paper edge, fine border).
- **Secondary: Words** (real text on the picture — the Carousel slide's overlay model: place, align, face, size, colour,
  shade/band/clear, shadow) and **Download** (PNG · JPEG · WebP, drawn in the browser at up to 2400 px; filters are
  applied to the pixels so every browser gets the same picture).
- **More:** Add a picture · Arrange & captions (order with move up/down, a caption each, take out) · Publish as link ·
  Make a carousel · Share privately · Versions · What's influencing this? · Rights.
- **Non-destructive.** The pictures stay Materials, untouched. What was done to them lives in the Creation's version
  (`structured_content`: `{ kind: "images", items: [{ materialId, caption, edits, words }] }`); **every Keep is a new
  version**, so any earlier look can be restored. A picture new to the Creation must be the creator's own and gains a
  `contains_material` lineage edge. `POST /api/v1/artifacts/[id]/images`.
- **Published** (`snapshot.pictures`): the View experience shows each picture as shaped, with its caption. A photo essay
  shaped here is viewed, pictures first; one that is words with pictures stays a Journey.
- Implementation: `packages/creator-studio/src/image-options.ts` (model, filters → CSS and pixel ops),
  `creation-images.ts` (save), `apps/web/src/components/images/edited-image.tsx` (preview + canvas export),
  `…/studio/images-canvas.tsx`, `…/creations/[id]/image`. Tests: `image-options.test.ts`, `e2e/images-page.spec.ts`.

### Preview, and what's next (owner, 4 Oct 2026)

"After writing… there are no options on the screen where I can go next" and "when I publish this as a link, it looks
good… show the same to user as a prominent preview option so they understand what can happen next."

- **Preview** is the Writing page's second secondary (Read moved to More). `/creations/[id]/preview` renders the
  Creation through the public page's own renderer — the same snapshot, manifest, rights and provenance a publish would
  freeze (`previewPublication`, built as the creator under RLS; nothing written) — with one bar beneath: **Publish as
  link** (anyone with the link; the Creator Page stays opt-in), or, once published, the live link with **Copy link** and
  **Open**, and **Publish the latest version** when the words moved on. Views aren't counted on a preview.
- **The link stays in sight:** a published Creation shows "Published · its address · Copy" under the title on the
  Writing page, with "newer words here — Preview to publish them" when they differ.
- **The Palette supports the kind of writing** (owner, 4 Oct 2026: "the palette options are not useful, make it less
  about AI, more about supporting the writing type"): the kind's own tool leads — **Lines & stanzas** (verse: each
  line with its syllables, or words in other scripts; the stanza shape), **Headline & lede** (news), **Scenes &
  runtime** (script: INT./EXT. headings, about a minute a page), **Scenes & length** (fiction), **Length & reading
  time** (essay, feature, letter) — then **Hear it read** (the device's own voice; a poem's line breaks become pauses)
  and **Publish as link** once there are words. Counted on the device, never sent, never a score
  (`packages/creator-studio/src/writing-craft.ts`, `…/studio/writing-tools.tsx`). Preview and Cover are on the page,
  so the Palette doesn't repeat them; Share, Versions, People and Change format are under More….

## Audio (step 3)

`/creations/[id]/audio` — a recording and its words (a script, lyrics, notes, or the transcript).

- **Record** is the one primary action (**Record again** once there's a take). Recording starts at once in a sheet
  (the voice-note recorder, shared with Quick Capture: `useAudioRecorder`); Stop, Listen, then **Keep this take**.
- Keeping uploads the take as a voice Material (Quick Capture's exactly-once endpoint; transcribed when the provider is
  live, honest when not) and makes a version naming it (`saveAudioTake`: the creator's own voice/audio Material only,
  stale saves refused, lineage recorded). Earlier takes stay Materials and come back by restoring a version.
- The take plays above the words (play/pause, a seek bar, times). **Listen** (the readers' page) and **Download** (the
  take) are the two secondaries, shown once there's a take. "Use the transcript as the words" appears while they
  differ. More: Publish as link, Save version, Export, Share, Versions, Make a carousel, Rights.
- Publishing carries the kept take as the page's audio.
- Implementation: `packages/creator-studio/src/audio-options.ts`, `creation-audio.ts`, `/api/v1/artifacts/[id]/audio`,
  `…/studio/audio-canvas.tsx`, `apps/web/src/components/audio/use-recorder.ts`. Tests: `audio-options.test.ts`,
  `e2e/audio-page.spec.ts`.

### Ornaments (owner, 4 Oct 2026)

"Beautiful separator options for header and footer, simple but elegant, inspired from roman architecture… these header
and footer are for writing creations only." Each written Creation has an ornament that heads it (under the title) and
closes it (after the last line): Hairline · Dentil · Arcade · Egg & dart · Meander · Keystone (default) · Laurel. It is
chosen in Cover beside the look, kept in `artifacts.presentation.ornament`, frozen into the published snapshot, and drawn
by `Ornament` (packages/ui) as hairline SVG in the ink — decorative only.

Implementation: `packages/creator-studio/src/creation-pages.ts`, `apps/web/src/app/(studio)/creations/[id]/write`,
`…/studio/screen.tsx` (shared loader + forwarding), `…/studio/writing-sheets.tsx`, `studio.tsx` (`page="writing"`),
`components/publish/work-page.tsx` (looks). Tests: `creation-pages.test.ts`, `tests/db/artifacts.test.ts`
(presentation), `e2e/writing-page.spec.ts`.
