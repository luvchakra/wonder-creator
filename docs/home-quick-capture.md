# Home orchestration + Quick Capture — implementation contract

Owner spec: [`phases/02-home-quick-capture.md`](phases/02-home-quick-capture.md) (Phase 02 of 5). Reference board:
[`phases/boards/phases-overview-2026-09-29.png`](phases/boards/phases-overview-2026-09-29.png), boards 1–2. The board
is a reference, never a runtime asset.

## Home

Home is the orchestration layer of the creator's life. It is not a feed, a dashboard or a chat.

**Payload.** `buildHomePayload` (`apps/web/src/lib/home/payload.ts`) builds Home as structured slots. It is served to
the page directly and to `GET /api/v1/home`, and it applies every priority rule on the server:
* Always: `mode`, `contextLine` and `quickCapture`.
* Fixed sections (owner, 3 Oct 2026), always present and never repeated below: **My Scrapbook** (compose, the creator's
  own last three scraps as rows that open in place — one at a time, with Collapse — then All scraps), **Continue** (or
  "Something worth starting", or the begin card — which, once something is caught, turns it into a Creation; see
  `docs/ui-redesign/start-small.md`), then after the dynamic rows **My Communities** and **My
  Testimonials** (the latest shown, the ones waiting, All testimonials). From Pulse never shows the viewer's own scrap.
* Then these optional slots: `whileAway`, `worldConnecting`, `dejavu`, `spark`, `worthHearing` and `couldHelp`.

**Loading and failure.**
* Each slot loads on its own, and a slot that fails is left out.
* If the whole aggregation fails, Home falls back to Continue, Quick Capture and Recent Creations.
* Home never waits on CreativeMind.

**Rules** (`apps/web/src/lib/home/ranking.ts`, pure and unit-tested). Phases 03 and 05 add candidates and slots to
these rules rather than changing the page.
* **Ranking** (§13): candidate kinds follow the base priority order. There is no score and nothing numeric is shown.
* **Modes** (`homeMode`):
  * Quiet when nothing needs attention. A memory, or someone else's post, doesn't count as needing attention.
  * Return after 48 hours or more away when there is something to show.
  * Active otherwise, including on the first visit.
* **Selection** (`selectSlots`), always rendered in page order so placement stays stable:
  * Active: the update, one discovery and one human signal.
  * Return: the most significant slots, up to 5.
  * Quiet: at most one memory.
  * Empty modules never render.
* **Continue** (`pickContinue`): prefers unsaved Studio work, then output being generated, then new comments from
  others, then work in progress over finished work, then recency. It shows a plain hint and "N sources · M unused".
* **Something worth starting**: with no Creation, recent Materials that share a DejaVu suggest a start. Nothing is
  created until the creator acts. (Materials that merely wait are the begin card's job: "Make something from your
  note", 8 Oct 2026.)
* **While you were away** (`summarizeAway`): a summary, not a list.
  * It draws on comments from others, finished visuals, failed publishes, and the existing update kinds.
  * Three items or fewer are named; more are grouped ("2 new comments"). It never runs past three lines.
* **Your world is connecting / A DejaVu surfaced**: deterministic in this phase. Home never changes a DejaVu.
  * A connection is a recent Moment and one at least 30 days old of a different kind on the same DejaVu.
  * A surfaced DejaVu has new links since the last visit joining older ones.
  * A pending suggestion for something just captured is offered with Add and Not now.
* **A little spark**: an anniversary first ("A year ago today you recorded this voice note."), then a photograph never
  used in a Creation, then a gentle reminder. The pick holds through the day, and there is no call to action.
* **Communities (formerly Worth hearing) / You could help**: a lively topic in one of your communities first, live Huddles, Scrapbook posts from people followed, and requests waiting on the
  creator. These are the plug points for Phase 03 Community.

**Context Line** (`homeContextLine` and the `homeLine` strip fact).
* One truth in 2–7 words: "3 things changed", "Your visuals are ready", "A new connection was found", "Railways
  surfaced again" or "Nothing urgent".
* It resolves at the semantic tier, below errors, offline, external operations, live state, approvals and
  saving/processing, and above lifecycle and metadata.
* Home doesn't request the AI line.

**Layout** (board 1).
* A one-line greeting, and the same truth under it.
* **Continue rows** (owner, 3 Oct 2026, replacing the image-backed card): up to three thin rows for the last edited
  Creations in progress (draft or in review), newest first, each with a small cover, its type and "Edited …" or a
  plain hint (Unsaved changes, Visuals are being created, new comments), opening in the Creative Studio; then **All my
  creations** (`/creations` → Materials › Creations). The newest row is the one dominant action.
* The Quick note and Voice note pills.
* The modules as compact rows. "While you were away" and "You could help" open in place.

### From the community (owner, 1 Oct 2026)

"Home page seems quite empty, think of ways to show meaningful info from the community." Below the creator's own rows,
Home shows one calm glance — never a feed (`homeCommunityGlance`, `components/home/community-glance.tsx`):

* **Live now**: one public Huddle the creator isn't in, with who's there and Join.
* **New work**: up to four public, finished Creations from others, in their own pictures (covers; text work shows its
  opening lines on a painted wash), with the author and why it's here ("You follow Maya", "You've worked with Jo").
* **A thought**: one public Scrapbook entry, people the creator follows or has worked with first.
* **An ask**: one open request (ask, critique, looking for) not already shown in "You could help", with Offer a thought.
* **Someone to meet**: one creator the viewer doesn't follow yet (people they know first), with why or what they're open to.
* **This week** (owner, 2 Oct 2026): one line in words — kinds of new public work, the open asks — never numbers
  (`weekLine`).
* **A conversation you joined has moved on**: conversations the creator replied to (not their own) with others'
  replies since they last read or replied; the one already in the Communities row is left out.
* **New in your Creative Rooms** (its own card, above): work room-mates shared in the last two weeks, newest three,
  read through the room's own sharing functions.
* **Explore** opens Community. Each part appears only when it's real; the section disappears when there's nothing.
* Same rules as Community: the viewer's own access, muted/blocked creators never appear, ordered by closeness then time —
  never by replies, likes or popularity. Nothing repeats a row above (Communities, You could help).

## Quick Capture

**Sheet.** `components/home/quick-capture.tsx` is one "Quick Capture" sheet with Text | Voice tabs (board 2).
* **Text**: focused at once, with Cancel / "Save note →". No title, Project, tags or DejaVu are required.
* **Voice**: recording starts on open, with a timer and a live level; Stop leads to "Voice note · 0:42", Play and
  Save.
  * The upload shows its progress. A failed or offline save keeps the recording in the sheet with Try again.
  * If the microphone is refused, the sheet says so and offers a quick note.
* **After saving**: "Note saved" or "Voice note saved · 0:42 ▶".
  * DejaVu suggestions appear only when they're ready, and each can be accepted or dismissed.
  * "+ Add" opens the Add a DejaVu sheet. **Make something** (primary) opens the Make a new Creation sheet with the
    capture (start-small.md); Done returns to Home, where a quiet line offers the same next step.
* **Offline**: a quick note is kept on the device (`localStorage`) and the navbar says "Offline · saved locally". It
  syncs on reconnect.

**Server.** `POST /api/v1/capture` takes a JSON note, or a multipart voice note with `seconds`.
* **Exactly once**: the device-made `clientId` claims a row in `capture_receipts` (migration 060: server-written,
  owner-read). A retry returns the same Material and Moment.
* **Intake**: the note or recording goes through the existing intake (`receiveText` / `receiveFile`: inspected,
  scanned, provenance). The Moment comes from the Phase 01 trigger.
* **After the response**: processing continues via `processIntake`. For voice this includes transcription, which is
  best effort; a failure keeps the audio and reads "Transcription unavailable".
* **Suggestions**: `suggestDejaVusFromText` (`@wonder/creator-moments`) matches the words against the creator's
  existing DejaVus.
  * It matches whole words, ignoring possessives and plurals.
  * It writes suggestions only, with the service client, at most 3.
  * Nothing is attached without the creator.
* `GET /api/v1/capture/:id` reports settled / transcription / suggestions for the quiet status line.

## Looking back: My captures (owner, 7 Oct 2026)

> "give me an option to look back on quick notes, voice notes etc from home page itself"

* **On Home**, right under the four ways in: **My captures ›**, one quiet row of the last 10 captures, newest first.
  * Notes show two lines in Playfair; voice notes play right there (one at a time); pictures and videos are small frames.
  * Each tile opens its Material. A new capture appears at once (Quick Capture announces `wc:captured`), no reload.
  * Nothing shows until something has been caught. The title is the link (no "See all").
* **`/captures`**: all of them, by day in the viewer's own time zone ("Today", "Yesterday", "Monday 5 October").
  * One row of filters: All · Notes · Voice · Pictures · Videos (`?kind=`). Pictures and videos caught together sit
    together as frames; notes and voice notes are rows. "Show earlier" pages back 30 at a time.
  * **Delete** (owner, 7 Oct 2026: "allow deleting a capture from the captures page"): a quiet bin on each capture (in a
    44px target, named "Delete note: …"). It asks first — it can't be undone — then the capture leaves the list at once,
    with its Material, file and Moment (`DELETE /api/v1/materials/:id?confirm=true`, RLS decides). Home's row stays
    calm: no bins there.
  * Back returns to where the creator came from (Home by default). Nothing else to press.
* **What counts as a capture**: a Material the creator caught in the moment — a typed note or idea, a voice note, a
  camera picture or video (`source_type` typed / voice / voice_transcript / camera). Uploads, links and imports aren't.
* **Server**: `recentCaptures` (`apps/web/src/lib/captures.ts`) reads through the creator's own RLS-scoped client and
  mints media addresses only for what that read returned; `GET /api/v1/captures?kind=&before=&limit=`.
* Test: `e2e/home-capture.spec.ts` ("looking back").

## Telemetry

`POST /api/v1/telemetry` plus `lib/telemetry.ts` and `lib/track.ts`.
* **Events**: the spec's named outcome events only (allowlisted), logged with a few enumerated or numeric properties.
* **Never**: text, titles or transcripts; dwell time or scroll tracking.

## Not in this phase (§20)

Full Community, Open Conversations, Ask Community, AI conversation summaries, popularity metrics, follows and semantic
DejaVu generation. "You were refining slide 3" needs Studio activity tracking that doesn't exist yet, so Continue says
what it can honestly know.
