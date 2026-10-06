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
| 4 | **Presentation**: current slide large + strip; Edit slide / Add slide / Present; themes from the named palettes (Editorial Paper, Cinematic Dark, Soft Gradient); speaker notes; export via web-page print | Done |
| 5 | **Video**: storyboard + script (shots with frame, line, duration); Write / Add shot / Play through (animatic); exports; Render only when a video provider is connected (honest "not connected" otherwise) | Done |

Shared across formats as they arrive: Publish as link, Download everywhere, one cover/background component, one
text-on-image component.

## Presentation (step 4)

- **The page** (`/creations/[id]/deck`, for `presentation` and `pitch_deck`): the current slide large, set in its
  theme, and the strip of slides beneath. **Edit slide** is the one primary action (Add a slide until there is one):
  the slide's title, its words (lines starting with a dash are points) and its **speaker notes** open beneath it, with
  Move earlier · Move later · Delete slide. **Add slide** and **Present** are the two secondaries; **Theme** and
  **Print or save as PDF** live under More, with Publish as link, Share, Versions and Make a carousel.
- **Themes** from the named palettes, defined once in the canvas: Editorial Paper (warm paper, its grain and a painted
  sprig), Cinematic Dark (near-black, warm light) and Soft Gradient (lavender to peach, a wash). The type scales with
  the slide, so the strip, the page and the screen all read the same.
- **Present** fills the screen: arrows, space or a tap at either side move on; **N** shows the slide's notes; Escape
  ends it, back on the slide you reached. **Print or save as PDF** prints only the slides, one to a landscape page.
- **Every change is a version**, autosaved a moment after the last edit (`saveDeck`, `POST /api/v1/artifacts/:id/deck`):
  the deck in `structured_content` (`deckOf` / `deckSchema`, `@wonder/creator-studio/deck`) and its words as text —
  a heading per slide, never the notes — for search, export and reading. A save against an older version is refused.
- **Presentations written before the page** (an outline in plain text) open as slides: every heading, "Slide N" line or
  `---` rule starts one.
- **A picture on a slide** (owner, 5 Oct 2026): *Add a picture* in the slide's editor chooses one of the creator's own
  pictures. With words, it sits on the right; with none (or on the title slide), it fills the slide behind the title
  with a scrim. A picture new to the deck must be the saver's own and gains a lineage edge.
- **Published, it reads as slides** (owner, 5 Oct 2026): the public page shows every slide in its theme — the words and
  the pictures, never the speaker notes ("Presentation · N slides"). The same slide renderer
  (`components/deck/slide-view.tsx`) draws the page, the strip, Present, print and the published page.
- Offered in *Make a new Creation* again (owner, 5 Oct 2026), with Video.

## Video (step 5)

- **The page** (`/creations/[id]/video`, for short_film · storyboard · shot_list · trailer · reel_concept): the
  storyboard. The current shot large — its frame (a picture of the creator's), or a painted card with its line until
  there is one — with its number and length, the line beneath, and the shots in a strip with the runtime
  ("12 shots, 0:48"). **Write** is the one primary action (Add a shot until there is one): the line (what's seen or
  said), the camera and staging, how long it holds (− / +, 1–60s), and **Choose a frame** from the creator's own
  pictures; Move earlier · Move later · Delete shot. **Add shot** and **Play through** are the two secondaries.
- **Play through** is the animatic: each frame held for its length with its line beneath, a progress line for the
  whole; arrows and space move and pause; Escape ends it on the shot reached.
- **Render video** (More) says plainly that video rendering isn't connected — no fake provider; the storyboard, shot
  list and animatic are the work until one is. **Export** gives the shot list as Markdown, text or a web page.
- **Every change is a version**, autosaved (`saveStoryboard`, `POST /api/v1/artifacts/:id/storyboard`): the
  storyboard in `structured_content` (`storyboardOf` / `storyboardSchema`, `@wonder/creator-studio/storyboard`) and a
  shot list as text. A frame new to the Creation must be the saver's own picture and gains a lineage edge; a save
  against an older version is refused.
- **Scripts written before the page** open as shots: scene headings (INT./EXT.), "Shot N" lines and headings each start
  one (a length named in it, "3s", is kept); otherwise each paragraph is a shot.

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
| news | news | a newspaper | bold headline, byline and date between rules, dateline "4 OCT —" on a strong lead, plain reading face |
| fiction | story, prose, narration, treatment | a fiction page | italic centred title, opening line in capitals, indented paragraphs, ⁂ between scenes |
| letter | letter | a letter | the date at the right, the greeting in italics, the sign-off set to the right |
| script | screenplay, script, dialogue | a screenplay | mono, title underlined in capitals |

## Images (step 2)

- **Canvas** (owner, 4 Oct 2026: "image should capture full canvas; pan, pinch and zoom; simple text editing on the
  picture"). The picture fills the canvas, as large as it fits. **Pinch, drag and double-tap** look closer (the view
  only — the crop lives in Edit; a wheel zooms on desktop; **Fit** returns). A strip of thumbnails when there are several
  (a photo essay); the caption beneath. Empty: "Begin with a picture" — **Take a picture** (the phone's own camera),
  **Your pictures** (picture Materials, Quick Pics included), **Make one** (contextual image generation; "Use this
  picture" keeps it as a Material).
- **Primary: Edit** (Add a picture until there is one). Six tools on a live preview: **Crop** (Free · 1:1 · 4:5 · 16:9 ·
  9:16 and zoom), **Focus** (tap the picture or a nine-spot grid), **Filter** (Original · Warm · Cool · Film · Mono ·
  Fade), **Light** (brightness, contrast), **Blur** behind the words, **Frame** (none, paper edge, fine border).
- **Secondary: Text** — adds a **text box** on the picture and starts typing in it. Boxes are real text: **drag** to
  move, **pinch** to size (or − / + in the toolbar), tap to select, tap again to type; any number of boxes. A selected
  box's toolbar (one scrolling row above the pictures): Edit words · face (Editorial · Serif · Modern · Handwritten) ·
  size · align · colour · behind it (clear, shade, band) · shadow · delete · Done. Keyboard: arrows nudge, Enter edits,
  Delete removes. Text changes **autosave** as a version after a pause; an emptied box goes. **Download** (PNG · JPEG ·
  WebP, drawn in the browser at up to 2400 px; filters applied to the pixels and every box drawn, so every browser gets
  the same picture).
- **More:** Add a picture · Arrange & captions (order with move up/down, a caption each, take out) · Publish as link ·
  Make a carousel · Share privately · Versions · What's influencing this? · Rights.
- **Non-destructive.** The pictures stay Materials, untouched. What was done to them lives in the Creation's version
  (`structured_content`: `{ kind: "images", items: [{ materialId, caption, edits, texts: [{ id, text, x, y, width,
  font, size, align, color, shadow, background }] }] }`; the older single `words` overlay is still read, as one box);
  **every Keep is a new version**, so any earlier look can be restored. A picture new to the Creation must be the creator's own and gains a
  `contains_material` lineage edge. `POST /api/v1/artifacts/[id]/images`.
- **Published** (`snapshot.pictures`): the View experience shows each picture as shaped, with its caption. A photo essay
  shaped here is viewed, pictures first; one that is words with pictures stays a Journey.
- Implementation: `packages/creator-studio/src/image-options.ts` (model, filters → CSS and pixel ops),
  `creation-images.ts` (save), `apps/web/src/components/images/edited-image.tsx` (preview + canvas export),
  `image-stage.tsx` (the canvas: view gestures, text boxes), `…/studio/images-canvas.tsx`, `…/creations/[id]/image`.
  Tests: `image-options.test.ts`, `e2e/images-page.spec.ts`.

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
- The take plays above the words (play/pause, a seek bar, times). **Listen** (the readers' page) and **Publish** (its own
  page and, if chosen, the Creator Page; owner, 6 Oct 2026) are the two secondaries, shown once there's a take. "Use the
  transcript as the words" appears while they differ. More: Download (the take, or the mix), Publish the whole song (a
  Room's part → Listen together), Save version, Export, Share, Versions, Make a carousel, Rights.
- Publishing carries the kept take — or, with background music, the mix — as the page's audio.

### Background music (owner, 6 Oct 2026)

"Give option to add bg music, specifically from the music library of the inbuilt music player … increase or reduce the
tempo, trim the music." One quiet row under the recording, **Add background music**, opens a sheet:

- **Choose** a track from the CreativeRadio library (title, artist, moods, length).
- **Shape it while hearing it under the take**: one Play runs the take and the music together, live — level, **tempo**
  75–125% with the pitch kept (the browser's own time-stretch while previewing), and **trim** (Starts at / Ends at).
  The music fades in briefly and out over 2.5 s at its end.
- **Use this music** mixes the two on the device (decode, trim, WSOLA time-stretch with the pitch kept, level and fades,
  never clipping; one WAV, a lower sample rate for long pieces to stay within the 50 MB upload limit), uploads it
  straight to storage, and keeps a **new version** carrying the take, the music as chosen and the mix (`saveAudioMusic`;
  `{ bed: null }` takes it away). The track's title, artist, license and credit come from the library on the server,
  never from the browser. A new take keeps the music chosen and asks to mix it again ("Mix it with this take").
- The mix is what plays on the page, downloads, is heard in the Room (`part_takes` prefers it, migration 092) and is
  published — on its own page and the Creator Page, and inside a Room's song. Every published page carries the track's
  credit and what was changed (`bedCredit`; the library is CC BY 4.0 / CC0, which allow this with attribution).
- Implementation: `audio-options.ts` (`AudioBed`, `AudioMix`, `bedCredit`), `creation-audio.ts` (`saveAudioMusic`),
  `/api/v1/artifacts/[id]/audio/music`, `…/studio/background-music.tsx`, `components/audio/time-stretch.ts`,
  `components/audio/bed-mix.ts`, `creator-publish.ts` (media and credits). Tests: `time-stretch.test.ts` (pitch kept),
  `audio-options.test.ts`, `tests/db/parts.test.ts` (the mix in the Room), `e2e/background-music.spec.ts`.
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
