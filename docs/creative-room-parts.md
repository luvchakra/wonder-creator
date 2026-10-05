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

## Made with (step 2)

* **Every version of a part's Creation records what it was made with**: the current version of each other part at
  that moment (`project_part_version_context`, written by a trigger on `artifact_versions`, immutable, readable by
  whoever can open the Room). Takes, picture sets, restores and Writing-page saves all count, because they are all
  versions.
* **A part's own page says where it stands**, in one quiet line under the title: *"Lyrics moved on since this take
  (v2 → v3) — what changed"*, or *"made with Lyrics v2 and Tune v1"*, or the parts as they are before the first
  version. *What changed* opens the lines that changed since (the same comparison the collaborators' Compare uses).
  Nothing is inferred; it is two version numbers and a diff.
* **The Room says it too**: each row adds "· with Lyrics v2" or "· Lyrics moved on"; the timeline's version entries
  end "…, with Lyrics v2 · Tune v1".
* **Suggest to another part** (*More › Suggest to Lyrics*, and the Palette): anyone making the work — on a part or in
  the crew — proposes new words for a writing part's current version (`part_suggest`). It is an ordinary
  change proposal: the part's owner accepts or declines it on *People* (with the line-by-line review), and nothing
  changes until then. The timeline says "Mira suggested a change to Lyrics — “…”". Your own words aren't suggested to;
  you write them.
* The people making the work read each part's versions (`versions_read` admits `app.reads_part_artifact`), and a
  proposer reads their own proposal even without access to the Creation.

## Play-along (step 3)

* **Both ways.** On a writing part's page, a compact *Play along* row plays the other parts' kept takes ("Tune · v2
  0:42"); one plays at a time, and CreativeRadio pauses, as for any sound on the page. On an audio part's page the same
  row sits with the recording, the words of the writing part show beneath ("Lyrics · v3", with *Use these words*), and
  *Play Tune while I record — with headphones* is on by default.
* **Record over a track.** With it on, the record sheet says "Recording over Tune v2", plays the track from the start
  when recording starts and stops it with the recording; the words to sing stay readable in the sheet. Only the
  microphone is recorded. The take is an ordinary version, so it records what it was made with (step 2).
* **Who hears what.** A part's take is its owner's private Material. `part_takes(project)` (security definer) returns,
  for each part whose current version is a kept take of its owner's own checked recording, the storage object — only
  where the caller reads that part's Creation (`app.reads_part_artifact`). The server mints a short-lived media link for
  exactly those objects. Outsiders get nothing; a recording held for safety, or a take naming someone else's Material,
  is never offered.

## Listen together (step 4)

* **The parts heard as one.** *Listen together* (`/rooms/<id>/song`, from the Room's hero once a part has a kept take)
  plays every take the viewer may hear (`part_takes`) at once, in the browser: each from its **start** (an offset, so a
  voice can come in after the intro, or a take can start part-way in) at its **level**, or muted. One primary action —
  Play — and one secondary, *Download the mix*.
* **Where it stands** in one line under the title: each part, its version, whether its people call it final.
  The words of the writing part sit beneath, set as a poem.
* **The mix is the Room's, not anyone's part.** `project_mixes` holds settings only (start in ms, level 0–2, muted) for
  this Room's parts; whoever sees the Room reads it, and the people making the work (on a part, or in the crew) change
  it through `part_mix_set`, which drops anything else. It saves as they go; nothing about a part or a take changes.
  Others see the settings, not the controls.
* **The download is made on the device**: the same takes and settings rendered offline into a WAV. Nothing is mixed,
  uploaded or stored on the server; the file carries only what the listener could already hear.
* Still to come (4b): publishing the song, and comments on a moment of it.

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
| 2 | *Made with*: versions and takes record the other parts' versions; "changed since this take" with the changed lines; Suggest to the lyricist (a proposal from the Audio page) | Done |
| 3 | Play-along both ways: the tune on the Writing page; words and tune on the Audio page; record over a track | Done |
| 4a | Listen together: the takes as one (starts, levels, mute), Where it stands, the words, a WAV made on the device | Done |
| 4b | Publishing the song; comments on a moment | Not started |
| 5 | Completion: credits (Lyrics → writing, Tune → sound, Voice → performance), equal shares, sign-off, publish together | Not started |

Implementation: `supabase/migrations/20261004000083_project_parts.sql` (+ `…085_part_made_with.sql`, `…086_part_takes.sql`, `…087_part_mix.sql`), `packages/creator-projects/src/parts.ts`
(+ `parts-options.ts`), `/api/v1/projects/[id]/parts/**`, `apps/web/src/app/(studio)/rooms/[id]/parts-panel.tsx`, `creations/[id]/studio/part-context.tsx`, `play-along.tsx`, `rooms/[id]/song/` with
`components/audio/use-mix.ts` and `lib/wav.ts`.
Tests: `tests/db/parts.test.ts`, `parts-options.test.ts`, `lib/wav.test.ts`, `e2e/parts.spec.ts`, `e2e/play-along.spec.ts`,
`e2e/listen-together.spec.ts`. Mockups: the owner's canvas
(4 Oct 2026).
