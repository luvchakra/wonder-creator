# P0 progress

Status legend: **Done** (implemented, tested, verified in a browser) · **Done (provider-gated)** (fully built; the
external provider must be configured to be live — honest "not connected" state otherwise) · **Partial** (usable, with
the gap listed) · **Not started**.

| # | Capability | Status | Notes |
|---|---|---|---|
| 1 | Creator Identity | Done | Onboarding (6 steps, progressive, skippable), profile, disciplines/skills/languages, voice, boundaries, visibility |
| 2 | Creative Material | Done | Create/import, view, search (FTS + semantic via Gemini embeddings/pgvector), filter, tags, provenance, security status, archive/delete (confirmed), reuse |
| 3 | CreatorSend | Done / Partial | Text, files, camera, voice notes, PDFs, Word (.docx) text, URLs (SSRF-guarded), multiple URLs, YouTube (oEmbed), explicit states, failure preservation, retry. Audio/video transcription via the AI provider (Gemini; inline ≤14 MB, File API above, deleted after use). Optional malware check by SHA-256 reputation (VirusTotal) before storage |
| 4 | CreatorTalk | Done | Text + browser dictation, attachments, persistence, grounding (server-resolved IDs), ambiguity question, streamed progress |
| 5 | CreatorBrain | Done (provider-gated) | Context minimisation, intent, discovery, generation pipeline, quality, governance, run tracking. Live with `WONDERCREATOR_AI_PROVIDER` (gemini/anthropic) + `WONDERCREATOR_AI_API_KEY`; offline deterministic model in dev/CI |
| 6 | Creative Context | Done | Per-intent `CreativeContext` assembly with privacy enforcement |
| 7 | Creative Memory | Done | Onboarding seeding, conversation extraction (live model), add/edit/remove, source + dates, correction flow |
| 8 | Artifact | Done | Types catalogue (writing/visual/audio/video/social), status, privacy, rights record, export (.md/.txt) |
| 9 | Artifact Studio | Done | Editor with stale-save protection, contextual Brain actions, revision review (diff, keep/discard), quality review |
| 10 | Artifact Versioning | Done | Immutable versions, atomic numbering, compare (diff), restore-as-new-version |
| 11 | Lineage / Creative Graph | Done | Explicit edges (created_from, derived_from, adapted_from, references…), calm graph view, derivatives listed |
| 12 | Multimodal Creation | Done (provider-gated) | Multiple materials incl. images (vision) in one brief; cross-modal understanding before generation |
| 13 | Reference Shelf | Done | Named shelves (defaults seeded), add/edit/remove references, notes/tags, use in creation |
| 14 | Creative Discovery | Done | Directions with "why it fits", no confidence scores; create from a direction |
| 15 | Creative Quality System | Done | Type-specific heuristic checks + model critique; suggestions only |
| 16 | Creator Autonomy | Done | 10 domains × levels, product defaults, hard ceilings for rights/commerce/destructive, proposals & approvals |
| 17 | Rights Foundation | Done | Ownership/joint shares, copyright, licenses (terms, territory, dates), automatic audited history, disclaimer |
| 18 | Creator Huddle | Done (provider-gated media) | Start, invite, discover, request/approve, text chat, presence, leave, host hand-off, remove, end, report, zero-participant dissolve. Voice/video via LiveKit when configured |
| 19 | Huddle → Material preservation | Done | Explicit save as idea/note with huddle provenance |
| 20 | Creator Profile + Live Presence | Done | Public-safe profile, live presence card, follow, block, invite to Huddle |
| 21 | Live Huddle discovery across platform | Done | Home strip, Huddles page, profile, search, notifications (join requests, invitations) |
| 22 | Security / privacy / governance | Done | RLS everywhere, hardened RPCs, CSP/headers, rate limits, SSRF, upload validation, prompt-injection fencing, export/delete with step-up. 278 DB security tests, 28 E2E tests (desktop + 360px) |
| 23 | Modular architecture | Done | Domain packages with clear ownership; one app, one database |
| 24 | Domain events | Done | Immutable `domain_events`, reserved lifecycle events emitted only by the database, idempotent consumer table |

## Asset dependencies (owner action)
- Official vector logo files and a dark-background logo variant (current logo files are raster crops of the board).
- Full-resolution originals of the background set.

## Known follow-ups
- None open from P0. Optional providers stay off until configured: LiveKit (Huddle voice/video) and the malware
  hash-reputation check.

# P0.1 / P1 progress

Plan: [`docs/plan-p0.1-p1.md`](plan-p0.1-p1.md) (owner-supplied; source of truth for scope and order).
Status legend as above. Items are worked in the plan's order (§51, §52), one PR each.
UI reference: [`docs/mockups/p0.1-screens.png`](mockups/p0.1-screens.png), [`p0.1-p1-overview.png`](mockups/p0.1-p1-overview.png) and the mobile boards [`mobile-p0.1.png`](mockups/mobile-p0.1.png), [`mobile-p1.png`](mockups/mobile-p1.png), [`mobile-overview.png`](mockups/mobile-overview.png) (owner-supplied). Mobile behaviour per story: [`docs/mobile-guidelines.md`](mobile-guidelines.md). Where the mockup and the plan
differ, the plan's product rules win: Scrapbook shows replies without like/engagement counts (plan §16), and follower
notifications are informational only (no follower-centric mechanics).

| Item | Status | Notes |
|---|---|---|
| P0.1-01 Creative Material Detail | Done | Preview (with a fallback for unsupported or held files), description and source & rights note, Details / Insights / Links / Usage tabs, owner and privacy shown, collections add/remove, Reference Shelf, similar material (semantic index), used-in artifacts, Use in creation, Ask CreatorBrain, download original (short-lived signed URL, clean files only), archive, delete with confirmation. Remaining: back link doesn't yet restore Library filters |
| P0.1-02 Material Collections | Done | Space → Collections tab (cover, name, count, "Private"; archived toggle; search), create with suggested names (Film References, Visual Style, Music Inspiration, Writing References, Locations, People) and description, rename, archive, delete (material kept). Collection page: multi-select add from the Creative Space, remove one or many (material kept), manual order, set cover, search within, Use in creation / Ask CreatorBrain (conversation linked to the collection; what's created records the collection in its lineage). Collections are private by constraint; covers, items and linked conversations are ownership-checked by RLS |
| P0.1-03 Intent Clarification | Done | `assessIntent` (IntentAssessment per plan: confidence, missing information, safe and consequential assumptions, recommended action; deterministic, no model call). Clear requests proceed and list what was assumed; missing length (long-form), audience (audience-facing formats), format (several named) or lead material (3+ pieces) opens an editable "What I understood" card in CreatorTalk; publishing, commercial use and imitation are never assumed silently and must each be confirmed. The request and material come from the stored question, each question is answered once, and the confirmed (or inferred) brief is recorded on the run (`ai_runs.intent_brief`) and in the conversation |
| P0.1-04 Creation Run Progress | Done | Run page `/create/runs/[id]` (stage list from persisted steps: done / current / skipped / stopped / waiting; current stage prominent; outputs; plain-language failure reasons incl. provider unavailable and interrupted). Work continues if the creator leaves (`after()`; stream writes never fail the run). Stop: checked before each stage, never mid-save, so nothing is half-saved. Retry reruns the stored request, only when no piece was produced, once (`retry_of` unique). CreatorTalk shows "Progress details" / "Stop" while working, "Try again" / "What happened" on failures and "How it was made" on drafts; notifications list running and unfinished creations |
| P0.1-05 Quality Review & Selective Refinement | Partial | Findings + suggestions; no select-and-apply |
| P0.1-06 Transformation Workflow | Partial | Transform with lineage; no source-version picker or inherited-context view |
| P0.1-07 Rights Detail & History | Partial | Ownership, copyright, licenses, audited history, disclaimer; step-up for transfer. Missing: contributors, usage rights, publication history sections |
| P0.1-08 License Creation & Request | Partial | Creator-side licenses with step-up for commercial activation; no requester flow or license modes |
| P0.1-09 Share / Download / Export | Partial | Visibility + .md/.txt export; no private share links, revocation or expiry |
| P0.1-10 Publishing Setup | Not started | |
| P0.1-11 Approval Center | Partial | Proposals + notifications; no unified center |
| P0.1-12 Autonomy Approval UX | Partial | Autonomy policy + proposals exist |
| P0.1-13 Huddle Create/Invite/Post-Huddle | Partial | Start, invite from profile, preserve idea/note; media eviction on remove/leave; stale presence hidden. Missing: invite search in-room, post-Huddle summary |
| P0.1-14 Scrapbook Detail & Replies | Not started | |
| P0.1-15 Search & Discovery | Done | `/search` with entity tabs (material, creations, collections, references, conversations, creators, live Huddles), date filter, material kind and tag filters, all in the URL so they survive navigation and reload; grouped results with entity labels, "Related in meaning" semantic matches, "Ask CreatorBrain about these" (opens CreatorTalk with the result set attached). The top-bar dialog links to it. Everything runs through the caller's RLS client; E2E checks another creator's private work never appears. Projects/Scrapbook join the index when those stories land |
| P0.1-16 AI Provider & BYOK | Partial | Env-configured provider + readiness; no BYOK |
| P0.1-17 Security & Audit Viewer | Not started | Audit log exists |
| P0.1-18 Mobile Completion Pass | Partial | 360px layouts; no sheet-based flows yet |
| P1 (all) | Not started | Begins after P0.1 rights, approvals, provenance and permissions are stable (plan §51). UI reference: [`docs/mockups/p1-screens.png`](mockups/p1-screens.png); the plan's guardrails win where they differ (no like counts on Market listings, analytics only from platform-supplied metrics, contribution splits recorded as agreements rather than legal conclusions) |
