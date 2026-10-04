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
| 2 | **Images**: the picture is the canvas. Primary **Edit** (Crop free/1:1/4:5/16:9/9:16, Focus, Filter — Warm, Cool, Film, Mono, Fade, none — Light, Blur behind words, Frame). Secondary **Words** (text on image, the slide editor's controls lifted into `packages/ui`) and **Download** (PNG/JPEG/WebP). More: Variations, Make a carousel, Publish as link, Share, Versions, Rights. Non-destructive: each keep is a new version; the original stays. Photo essay = sequence with captions, reusing Arrange | Next |
| 3 | **Audio**: recorder (the voice-note recorder) above the words; Record / Write / Listen; Transcribe when the provider is live; export audio + text; a simple player page as the public link | Not started |
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

Implementation: `packages/creator-studio/src/creation-pages.ts`, `apps/web/src/app/(studio)/creations/[id]/write`,
`…/studio/screen.tsx` (shared loader + forwarding), `…/studio/writing-sheets.tsx`, `studio.tsx` (`page="writing"`),
`components/publish/work-page.tsx` (looks). Tests: `creation-pages.test.ts`, `tests/db/artifacts.test.ts`
(presentation), `e2e/writing-page.spec.ts`.
