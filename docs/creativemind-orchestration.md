# CreativeMind orchestration, quality and rollout (Phase 05)

Owner spec: [`docs/phases/05-creativemind-orchestration-rollout.md`](phases/05-creativemind-orchestration-rollout.md)
(29 Sep 2026). Builds on Phases 01–04 (`moments-dejavu.md`, `home-quick-capture.md`, `community.md`,
`studio-integration.md`).

CreativeMind quietly connects the system: it finds relationships, summarises, ranks within categories, suggests and
explains relevance. It never reorganises the creator's world, infers rights, publishes, becomes a chat panel, optimises
for time spent, or overrides deterministic truth.

## Boundaries (§2)

Deterministic truth always wins: errors, offline/sync, publishing, external operations, rights, licensing,
attribution, permissions, approvals, finance, live Huddle state, exact counts and dates, processing progress. These
come from the database and the Context Strip's fixed priorities (`lib/context-strip/types.ts`); AI text is a P6
"creative context" line that can never displace them (`ai-context-line.md`).

CreativeMind assists with: relationship discovery, DejaVu suggestions, summaries, relevance reasons, role suggestions,
Community matching, A little spark, Your world is connecting — always as suggestions, always optional, always async.

## Your world is connecting (§5, §15)

`@wonder/creator-moments/connections` — `discoverConnections(db, service, creatorId)`:

| Type | Evidence (recorded facts only) | Example |
| --- | --- | --- |
| `same_memory` | a voice note and photographs captured the same day | “Your voice note from March and these two photographs may describe the same memory.” |
| `shared_theme` | a meaningful tag on a new Moment and a much older one; or closeness in the search index | “Your photograph from March and a new note are both about “waiting”.” |
| `creative_opportunity` | a fresh note names an unfinished Creation it isn't part of | “Today's note may fit “Platform 3”.” |

- Stored in `moment_connections` (migration 064): pipeline-written, creator-read, one per set of Moments and type
  (`signature`), `evidence` for **Why am I seeing this?**, `confidence_internal` not readable by creators (column
  grant), expires after 21 days. Opened / used / dismissed by the creator; **dismissed never returns**. Moments the
  creator already connected with a DejaVu aren't suggested.
- Tags and names must be human concepts (`isMeaningfulName`): Dad, Railways, Waiting — not Photo, Blue, Tuesday,
  Content, IMG_2041.
- Runs after Home answers (`lib/home/discover.ts`, `after()`), only when the creator's Moments or tags changed (or
  every six hours). Home shows one connection card (`FoundConnection`: open, Why am I seeing this?, Dismiss); the
  deterministic Phase 02 connection stands in when there is none.

## DejaVu suggestions (§6)

- A DejaVu the creator dismissed twice in 60 days isn't offered again (`repeatedlyDismissed`).
- New names are suggested only from a meaningful tag that recurs on at least three Materials, isn't already a DejaVu
  and wasn't turned down (`suggestNewDejaVu`); the creator's own DejaVus come first; at most one; never attached.

## Community relevance and You could help (§7–8)

Plain reasons, never percentages or "people like you": *You're in this conversation*, *You have 2 Materials that may
help* (existence only — never the Materials themselves), *You worked with Maya before*, *You're open to giving
feedback* (`creator-community/feed.ts`). Sharing is always the creator's explicit choice.

## Conversation so far (§9)

`open_conversation_summaries` (migration 064): 2–4 points, each linked to the replies it comes from (`See the reply`),
viewpoints with disagreement preserved, no winner, no percentages, no names (`validateSummary`). Readable by whoever can
read the conversation; written only by the pipeline. Written in the background once a conversation has 6+ replies and
refreshed after 4 more; until then the stored one reads *Summary from earlier · N newer replies below*. Removed and
deleted replies never reach the model. No live model → no summary (honest).

## Reply triage in the Studio (§10)

`GET /studio-sessions/:id/community-responses/triage` — replies grouped by what they suggest (“2 suggest shortening
the line”), at most four groups, each reply in one (`validateTriage`), cached per reply set, asked for after the list
shows. **View replies** filters the list; **Use idea in Studio** puts those replies on the Working Table as Feedback.
Nothing is applied automatically.

## Made from (Scenario C)

`artifact_version_sources` (migration 064): when a version is saved in the Studio (`POST /studio-sessions/:id/commit`),
the sources in use or pinned are recorded against it with roles, use, **rights state and credit as they were** —
including someone else's Community reply applied as feedback. Immutable; the owner writes, whoever can read the
Creation reads. Materials and Creations also get `references` lineage edges. Available sources are never recorded.

## Context Line and caching (§13–14)

Already in place (`ai-context-line.md`, `creator-brain/context-line.ts`): 2–7 words, ≤56 chars, no first person, no
“I found”, grounded in supplied keys, deterministic fallback shown immediately, cached per object version signature,
never requested per keystroke, never allowed to overwrite a newer deterministic state.

## Quality (§18)

Outcome telemetry only (`lib/telemetry.ts`, no content, no dwell time): connection opened / used / dismissed / “why”
opened, DejaVu suggestion accepted / dismissed, Community reply used in Studio, thought saved, triage used, Huddle and
Creative Room from a conversation, Ask Community sent — alongside Phase 02's resumed Creation, captured note, opened
connection. Acceptance rate is not the only measure, and time on Home is not a success metric.

## Flags and rollout (§19–20)

`lib/flags.ts` (names, stages) and `lib/features.ts` (resolution). `WONDERCREATOR_ROLLOUT_STAGE` = A…E (default **E**:
everything shipped is on); any flag can be forced with `WONDERCREATOR_FLAG_<NAME>=on|off`. Routes declare
`withApi(…, { feature })` and answer 404 while off; pages call `flagOn`; client entry points use `useFeature`.

| Stage | Flags |
| --- | --- |
| A — internal | `moments_enabled`, `dejavu_enabled`, `quick_capture_voice_enabled`, `home_orchestration_enabled` |
| B — small beta | `community_enabled`, `open_conversations_enabled`, `community_home_cards_enabled` |
| C — expanded beta | `community_to_studio_enabled`, `ask_community_enabled`, `external_image_sources_enabled` |
| D — AI enhancement | `semantic_connections_enabled`, `dejavu_ai_suggestions_enabled`, `conversation_summaries_enabled` |
| E — general availability | all of the above, after the gate below |

### Community GA gate (§21)

| Requirement | Status |
| --- | --- |
| Report handling | Done — `moderation_reports` for conversations, replies, posts, profiles |
| Block / mute | Done — blocks hide both ways; mutes are private |
| Spam controls, rate limits | Done — per-route limits, `checkBudget` for starting and replying |
| Moderator tools | Done — platform moderators remove conversations and replies (audited) |
| Deletion workflows | Done — own replies, owner removal, conversation delete cascades Moments |
| Audit trail | Done — `audit_logs` for removals and moderation |
| Abuse testing | Partial — DB and e2e cases for blocks, Limited, removal; no load/abuse drill yet |
| Age / eligibility policy | Owner decision — not in scope until the product sets one |

## Performance (§22)

Home's deterministic shell renders without AI; Quick Capture saves before understanding; the Working Table and DejaVu
pages have no AI dependency; Community lists never wait for summaries; connections, summaries and triage run after the
response or on demand, and every AI failure degrades to the deterministic experience.

## Definition of done (§26)

| | |
| --- | --- |
| Moments span major domains | Materials, Creations, Conversations, Scrapbook (Phase 01, 03) |
| DejaVu across mixed Moment types | Yes |
| Quick text and voice capture | Yes (Phase 02) |
| Home Active / Return / Quiet | Yes (Phase 02) |
| Community without duplicate social objects | Yes (Phase 03) |
| Open Conversations; → Huddle → Creative Room | Yes (Phase 03) |
| Community items into CreativeStudio; DejaVu feeds the Working Table | Yes (Phase 04) |
| Ask Community from a fragment | Yes (Phase 04) |
| Working Table collapsible; Carousel reorder, refine, add one more | Yes (Phase 04) |
| Provider-neutral, provenance-aware external images | Yes (Phase 04) |
| CreativeMind suggestions async and optional | Yes (this phase) |
| Rights, privacy, moderation, permissions deterministic | Yes (RLS, rights gate, flags) |
| Home calm, not a feed | Yes: 1 Continue, Quick Capture, a few contextual cards |

Known limits: Carousels don't save versions from the Studio, so *Made from* is recorded for written pieces; `shared_person`
and `shared_place` connections need people and places in understanding, which isn't recorded yet.

## Tests

`packages/creator-brain/src/orchestration.test.ts`, `packages/creator-moments/src/connections.test.ts`,
`apps/web/src/lib/flags.test.ts`, `tests/db/creativemind.test.ts`, `e2e/creativemind.spec.ts`.
