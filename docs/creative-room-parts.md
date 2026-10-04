# Creative Room parts — making one thing together

Owner brief, 4 Oct 2026: three creators make a song — one writes the lyrics, one the tune, one sings it. Lyrics and
tune work on each other, so nothing is a pipeline. Decisions: shares are equal by default; two or more people may share
a part; someone outside the Room may be invited to a single part. Layout: the owner's option B (the work first, parts
as rows) with option C's timeline beneath.

## The idea

A Room can say what the joint Creation is **made of**: its **parts** — Lyrics · Tune · Voice for a song. Each part is a
Creation of its own, by whoever is on it, made on that format's own page (Writing, Audio, Images…). Parts are
**peers**: none waits on another and none is locked. A part is **final** only when its people say so, and it can go
back into rounds. What holds the parts together across rounds is recorded on every version — *which versions of the
other parts it was made with* — so "the lyrics moved on since this take" is a comparison, never a guess (step 2).

## Who is on a part

* **Crew members claim parts** (the owner too). Two or more may share one; each becomes an editor of the part's
  Creation (`artifact_contributors`, access `edit`), so a version carries who wrote it.
* **Anyone may be invited to a single part** without joining the Room — a session singer. People on the part, and the
  Room's owner or admins, may invite. The invitee sees the Room's name and brief and its parts (and reads the parts'
  Creations); not its items, tasks, chat or crew. Invitations show on *My Creative Rooms*.
* **Shares are equal per person**, proposed at the end (step 5) — three people, thirds; four, quarters — and edited or
  signed off there.

## What the Room shows (option B + C)

1. **The work**: a hero with the first lines of a writing part, how many parts are started and final, and **one
   primary action** — *Open my part* (its page), *Start my part* (makes the Creation), or *Claim a part*.
2. **Where it stands**: one row per part — a status dot (open · in rounds · final), its people ("you", "this part
   only" for outsiders), version and when; the row opens the part. A row menu holds the rest: Join · Start · Open ·
   Mark final / Back into rounds · Invite to this part… · Leave · (owner/admins) Rename · Remove part · Take someone
   off. *Add a part* sits under the rows for the owner or admins.
3. **What happened**: the timeline — part events (added, claimed, invited, joined, declined, left, removed, started,
   final, reopened) and every saved version of a part's Creation the viewer may read. Plain sentences; nothing inferred.

Templates on *New Creative Room* ("Making it together?"): **Song** (Lyrics · Tune · Voice), **Podcast episode**
(Script · Host · Edit), **Illustrated story** (Words · Pictures), or *Just a Room*. Each part knows the Creation type it
starts (lyrics, song_concept, narration, podcast_concept, sound_design, story, photo_essay), and so which page.

The Palette on a Room with parts leads with *Open my part* / *Claim a part*; the Context Line says "1 of 3 parts
final".

## Rules

* A part's Creation is the member's **own** (they own it; others on the part edit it). Starting is `part_attach`: the
  caller must be on the part and own the Creation; a part has one Creation; the crew sees it as shared work
  (`project_items`, shared).
* **Final needs a Creation.** Final blocks claiming; the Room's owner or admins may mark or unmark final too.
* Leaving or being taken off takes the edit access back; a part with no one left is open again.
* Membership moves only through `part_claim`, `part_invite`, `part_respond`, `part_leave`, `part_remove`,
  `part_set_final`, `part_attach` (security definer); `project_part_members` and `project_part_events` are read-only
  to clients. Everything is logged to the audit trail as `part.<kind>`.
* Reading: `projects_read` now admits anyone invited to or on a part (`app.can_see_project`); `project_parts`,
  `project_part_members` and `project_part_events` follow it. `app.can_read_artifact` admits the Room's owner and crew
  and anyone **active** on one of its parts to a part's Creation. Nothing else about who reads a Creation changed.
* No AI in any of this: no suggested melodies, lyrics or arrangements; the drift notice (step 2) is a version
  comparison.

## Steps (one PR each)

| Step | What | Status |
| --- | --- | --- |
| 1 | Parts: peers, many people per part, part-only invites, templates; the Room's hero, Where it stands, timeline; Palette | Done |
| 2 | *Made with*: versions and takes record the other parts' versions; "changed since this take" with the changed lines; Suggest to the lyricist (a proposal from the Audio page) | Not started |
| 3 | Play-along both ways: the tune on the Writing page; words and tune on the Audio page; record over a track | Not started |
| 4 | The Song page: the mix (tracks, offsets, levels), Where it stands, browser-rendered download, publishing; comments on a moment | Not started |
| 5 | Completion: credits (Lyrics → writing, Tune → sound, Voice → performance), equal shares, sign-off, publish together | Not started |

Implementation: `supabase/migrations/20261004000083_project_parts.sql`, `packages/creator-projects/src/parts.ts`
(+ `parts-options.ts`), `/api/v1/projects/[id]/parts/**`, `apps/web/src/app/(studio)/rooms/[id]/parts-panel.tsx`.
Tests: `tests/db/parts.test.ts`, `parts-options.test.ts`, `e2e/parts.spec.ts`. Mockups: the owner's canvas
(4 Oct 2026).
