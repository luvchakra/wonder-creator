# Start small — the way into creating, connecting and collaborating

Owner, 8 Oct 2026:

> "i want to have a design which encourages user to start small and get into the ecosystem of creation, connect and
> collaborate with others … everything should be intuitive, elegant, logical and useful. avoid unnecessary features,
> buttons, pages, stick to basics and make it really useful"

## What was wrong

Every door was on Home from the first minute — capture, Scrapbook, New Creation, Communities, Testimonials — in no order,
so a new creator saw a menu, not a way in. And the doors didn't connect:

* **Catching a note and making something from it were two separate worlds.** The note sat in "My captures" and the
  begin card offered a generic *New Creation* — a different flow from the Palette's Create sheet.
* **Collaborating was never asked for.** Rooms appeared on Home only once someone else had shared into one.
* Nothing said what a small first step was.

## The shape: four small steps, one at a time

Where a creator is on the way is read **only from what they have actually done** (`lib/home/journey.ts`, pure and
unit-tested). Home asks for the first step not yet taken and nothing else.

| Step | True while… | What Home does | The action opens |
|---|---|---|---|
| **Capture** | nothing caught or made yet | The line under the greeting: "Begin with one small thing — a line is enough." The four capture buttons are the way in; no extra card | Quick Capture (a note is ten seconds) |
| **Make** | something caught, nothing made | The begin card becomes "Make something from your note", in the note's own words, with one button. Home updates by itself the moment the first note is saved. The line: "Turn something you caught into a Creation." | **Make a new Creation** sheet, the words as the first draft, the note kept as its source |
| **Connect** | made something, in no Community | Nothing new: the Communities section — "Find people who make what you make" — already is this step | Discover (Communities) |
| **Collaborate** | in a Community, no Creative Room | One quiet row under Continue: "Make something with someone — Start a Creative Room and invite a friend" | A new Creative Room |
| — | all of it done | Nothing extra; Home shows only what is happening | — |

A Community is a Creative Room opened as one, so joining one does **not** count as making something together — the
collaborate step counts only ordinary Rooms (`projects.community_privacy is null`).

## Rules

1. **One step at a time, the first one not yet taken.** Order of taking them doesn't matter; a step already taken is
   never asked for again.
2. **Never a score.** No checklist, progress bar, level, badge, streak or count — nothing to complete, tick or dismiss
   (the product has no likes, follower counts or ranking). The step simply stops appearing once it has been taken.
3. **Every step uses a door that already exists** — Quick Capture, the Make a new Creation sheet, Communities, Rooms. No
   new page, no new navigation, no tour.
4. **Nothing twice.** A step that already has a place on the page (capture = Quick Capture, connect = Communities) adds
   nothing more. The begin card and the Palette's Create are the *same* sheet — one place to start.
5. **Continue stays the one dominant action.** The collaborate row is a quiet link beneath it, not a second primary.
6. **Calm.** Quiet line under the greeting only when nothing else needs the creator's attention.

## What changed

* `journey.ts`: the steps and the greeting line. Home payload gains `journey.step` (read from facts Home already loads —
  Materials, Creations, Communities — plus one head-count of ordinary Rooms) and `beginning.latest` (the newest Material
  and a short preview, only for a creator with nothing made yet).
* **Begin card** (`home-begin.tsx`): *New Creation* now opens the Make a new Creation sheet instead of the older
  meTalk page; once something is caught it shows that Material and a single *Make something* (fetches the full words
  at the click). Hero art and the owner's heading are kept.
* **My captures** refreshes Home once, after the very first capture, so the card moves on without a reload.
* **Removed:** the generic "N recent Materials are waiting for a first Creation. Explore this idea" start card — the
  begin card now does that job better. (The DejaVu-thread suggestion, a different insight, stays.)
* Two outcome events, only for creators who turned on usage measures: `home_make_from_latest`, `home_together_opened`.

## Deliberately not built

* **A shorter onboarding.** Only name and handle are required today and the other steps skip; changing what the wizard
  collects changes what CreativeMind learns, which is the owner's call. Recommendation: after name and handle, go
  straight to Home and ask the rest (style, boundaries) where it matters, in Creative Memory.
* A "getting started" checklist, a tour, tooltips, empty-state illustrations for every page, notifications nagging
  about steps, or a share step of its own (sharing lives in Scrapbook and on the Creation).

## Tests

`apps/web/src/lib/home/journey.test.ts` (the steps), `e2e/home.spec.ts` ("start small": a line to begin → the note turned
into a Creation with its words → a way to make it with someone, gone once a Room exists).
