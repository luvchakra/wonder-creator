# Home orchestration + Quick Capture — implementation contract

Owner spec: [`phases/02-home-quick-capture.md`](phases/02-home-quick-capture.md) (Phase 02 of 5). Reference board:
[`phases/boards/phases-overview-2026-09-29.png`](phases/boards/phases-overview-2026-09-29.png), boards 1–2. The board
is a reference, never a runtime asset.

## Home

Home is the orchestration layer of the creator's life. It is not a feed, a dashboard or a chat.

**Payload.** `buildHomePayload` (`apps/web/src/lib/home/payload.ts`) builds Home as structured slots. It is served to
the page directly and to `GET /api/v1/home`, and it applies every priority rule on the server:
* Always: `mode`, `contextLine` and `quickCapture`.
* Then Continue, or "Something worth starting", or the calm beginning.
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
* **Something worth starting**: with no Creation, recent Materials that share a DejaVu (or simply wait) suggest a
  start. Nothing is created until the creator acts.
* **While you were away** (`summarizeAway`): a summary, not a list.
  * It draws on comments from others, finished visuals, failed publishes, and the existing update kinds.
  * Three items or fewer are named; more are grouped ("2 new comments"). It never runs past three lines.
* **Your world is connecting / A DejaVu surfaced**: deterministic in this phase. Home never changes a DejaVu.
  * A connection is a recent Moment and one at least 30 days old of a different kind on the same DejaVu.
  * A surfaced DejaVu has new links since the last visit joining older ones.
  * A pending suggestion for something just captured is offered with Add and Not now.
* **A little spark**: an anniversary first ("A year ago today you recorded this voice note."), then a photograph never
  used in a Creation, then a gentle reminder. The pick holds through the day, and there is no call to action.
* **Worth hearing / You could help**: live Huddles, Scrapbook posts from people followed, and requests waiting on the
  creator. These are the plug points for Phase 03 Community.

**Context Line** (`homeContextLine` and the `homeLine` strip fact).
* One truth in 2–7 words: "3 things changed", "Your visuals are ready", "A new connection was found", "Railways
  surfaced again" or "Nothing urgent".
* It resolves at the semantic tier, below errors, offline, external operations, live state, approvals and
  saving/processing, and above lifecycle and metadata.
* Home doesn't request the AI line.

**Layout** (board 1).
* A one-line greeting, and the same truth under it.
* An image-backed Continue card with the round arrow; this is the one dominant action.
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
  replies since they last read or replied; the one already in Worth hearing is left out.
* **New in your Creative Rooms** (its own card, above): work room-mates shared in the last two weeks, newest three,
  read through the room's own sharing functions.
* **Explore** opens Community. Each part appears only when it's real; the section disappears when there's nothing.
* Same rules as Community: the viewer's own access, muted/blocked creators never appear, ordered by closeness then time —
  never by replies, likes or popularity. Nothing repeats a row above (Worth hearing, You could help).

## Quick Capture

**Sheet.** `components/home/quick-capture.tsx` is one "Quick Capture" sheet with Text | Voice tabs (board 2).
* **Text**: focused at once, with Cancel / "Save note →". No title, Project, tags or DejaVu are required.
* **Voice**: recording starts on open, with a timer and a live level; Stop leads to "Voice note · 0:42", Play and
  Save.
  * The upload shows its progress. A failed or offline save keeps the recording in the sheet with Try again.
  * If the microphone is refused, the sheet says so and offers a quick note.
* **After saving**: "Note saved" or "Voice note saved · 0:42 ▶".
  * DejaVu suggestions appear only when they're ready, and each can be accepted or dismissed.
  * "+ Add" opens the Add a DejaVu sheet. Done returns to Home, where a quiet line links to the Material.
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

## Telemetry

`POST /api/v1/telemetry` plus `lib/telemetry.ts` and `lib/track.ts`.
* **Events**: the spec's named outcome events only (allowlisted), logged with a few enumerated or numeric properties.
* **Never**: text, titles or transcripts; dwell time or scroll tracking.

## Not in this phase (§20)

Full Community, Open Conversations, Ask Community, AI conversation summaries, popularity metrics, follows and semantic
DejaVu generation. "You were refining slide 3" needs Studio activity tracking that doesn't exist yet, so Continue says
what it can honestly know.
