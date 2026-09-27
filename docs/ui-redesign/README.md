# UI redesign — tracker

Spec: [`spec.md`](spec.md) (owner-supplied, 27 Sep 2026). Boards: [`boards/`](boards) — visual references only.

## Presentation language (UI copy only — internal names stay)

| Internal (code, DB, API) | UI |
|---|---|
| artifact | **Creation** |
| artifact studio (`/artifacts/[id]/studio`) | **Creative Studio** |
| creator-brain / CreatorBrain | **CreativeMind** |
| CreatorTalk (`/create`) | **meTalk** |
| project (`/projects/[id]`) | **Creative Room** |
| app navigation | **Palette** (Creative Palette) |
| CreatorSend (`/send`) | **Bring Material** |

## Phases (spec §54)

| Phase | Item | Status |
|---|---|---|
| UI-A | Canvas shell + Creative Palette (no bottom nav, slim top bar, contextual Creation / Creative Room / Material palettes) | Done |
| UI-A | Home Canvas (greeting, one current Creation, one honest CreativeMind moment, recent Materials, one live Huddle) + meTalk sheet | Done |
| UI-A | Materials wall · Material detail | Done |
| UI-A | Supplied watercolor artwork: Palette trigger motif, one Home floral corner; responsive AVIF/WebP, hashed, immutable, typed registry (`WATERCOLOR`), only the motif and the one Home decoration are preloaded | Done |
| UI-A | Creation view (hero, type/status, description, key metadata, four sections, one CreativeMind insight) · Context view (Materials · References · People · Related; old `?tab=lineage/references` links redirect) | Done |
| UI-A | Creative Studio — writing canvas: near-full-screen surface at reading measure, minimal title/status, no AI pane (CreativeMind as refine chips, one ask line and the quality review below the page), Creation Palette (§7.3) while working. Creations are text today; video/image/audio canvases wait for media Creations (no fake editors) | Done |
| UI-A | Presentation terminology sweep — user-visible copy only: piece/artifact → Creation, project → Creative Room, Studio → Creative Studio, CreatorBrain → CreativeMind, CreatorTalk → meTalk (identifiers, routes, tables, events and AI-only prompt text unchanged) | Done |
| UI-B | Transform Creation (`/artifacts/:id/transform`): format cards filtered by the source (forms that suit it first, every other form by category), each with a shape preview, format, one sentence and output shape; tap → focused configuration (version, notes, what carries over) → Create a new Creation with lineage | Done |
| UI-B | Creative Quality: Original / Proposed / Changes switch on a revision preview (shared `Segmented` control); per-check results, never one score | Done |
| UI-B | Versions: dedicated compare view (`/artifacts/:id/compare`) — Single view · Before / After (stacked on phones) · Swipe; restore still adds a new version | Done |
| UI-B | Rights: an at-a-glance summary ("You own this Creation", personal use, sharing as the creator, commercial use → add a license, credit) from the stored record only, above the disclaimer and the detailed sections | Done |
| UI-B | Share / Publish: separate concepts, cross-linked (Share = people open it; Publish = send to a platform; Download = your copy); publish steps named Prepare · Customize · Review & schedule · Publish; success only after the destination confirms (unchanged) | Done |
| UI-B | Approval Center: every card answers what happens, which Creation (or what it's about), rights · cost, who asked and when, and when it expires; Review opens the exact parameters to approve, decline or edit | Done |
| UI-C | Creative Room: at-a-glance overview — current Creation hero, next steps (open tasks), recent Materials, crew, one CreativeMind moment for waiting requests; full lists below, the rest via section nav and Palette | Done |
| UI-C | Crew & invitations: people with flexible roles (adds Creator, Filmmaker), invited/pending and former members, activity, Huddle entry; the crew registers its own Palette group | Done |
| UI-C | Tasks: light default — In progress · Completed switch over status groups (no kanban); milestones below | Done |
| UI-C | Contributions: All activity · By version · By people (grouping only; shares only where recorded) | Done |
| UI-C | Huddles: Live now · My Huddles (no fake "Upcoming"/"For you" — Huddles are spontaneous; never ranked by viewer count) | Done |
| UI-C | Collaborative editing, Find collaborators: reviewed against §27/§29 — Creation stays dominant, no ranking/score; availability waits for P1-14 | Reviewed |
| UI-D | CreatorPublish: Queue · Drafts · Published views; cards show the Creation, destination, schedule and status; "published" only once the destination confirms | Done |
| UI-D | Settings: "AI & CreativeMind" (the governed autonomy levels, conservative for publishing, commerce, rights and destructive actions), AI providers and Connected apps entries; Privacy & Security keeps activity, access, data export and deletion | Done |
| UI-E | **Context-aware Palette** (`palette-spec.md`): deterministic `resolvePalette` (page rules → lifecycle/media → permissions → no dangerous first-level → rank) shows 3–4 actions with More… and Go to… (Home · Create · Materials · Huddles · Explore · Me); Create opens New Creation · Bring Material · Capture · meTalk. Every screen declares a `PaletteScope`. Trigger shows the painted palette only; compact leaves; reveal ≤280ms, minimal stagger, no rotation. Telemetry and feature flags from the spec are deferred (no analytics pipeline yet) | Done |
| UI-E | **Navbar Context Strip** (`context-strip.md`): one quiet line between logo and search saying what's happening — deterministic `resolveContextStrip` over the §12 priorities (error → offline → publishing → live → pending → save/processing → lifecycle → presence → metadata), one primary plus one secondary on wider screens, 12.5px, no wrapping, 140ms crossfade, glyph + text (never colour alone), only errors announced. Screens pass facts they already loaded (Creation `v4 · In progress`, Material `Voice · 02:14` / `Transcribing…`, Materials `64 materials`, Search `18 results`, Approvals `3 approvals pending`, Room `… · Active`, Publishing); transient signals from the Studio (Unsaved → Saving… → Saved → version) and live Huddles (`● Live · 4 people · 12:42`). Presence and "Published · Instagram" wait on data the pages don't load yet | Done |
| UI-E | **Artistic Canvas** (owner: "use the assets to make the pages more beautiful"): watercolour-paper texture under every screen and two soft Vector Kit washes in the far corners, tinted by section (dawn · studio · materials · together · room; utility screens quiet) — fixed, decorative, no layout, no motion; painted sprigs beside creative page titles | Done |
| UI-E | Compact density + interaction minimalism: shared `PageTitle` (24px) and small buttons (36px look, 44px target); **Creation view** — one primary action per lifecycle, two secondary, the rest under More; 208px hero, grouped metadata | Done |
| UI-E | **Creative Palette fan**: leaves on a quarter-arc around the trigger (nearest beside it, furthest above it, leaves kept horizontal), content-sized, soft fan-open ≤280ms; Palette design principles added to CLAUDE.md | Done |
| UI-E | **Inline navbar search** (owner request): the pill becomes the field in place, quick results drop down under the bar | Done |
| UI-E | **Adaptive Context Line — AI layer** (`ai-context-line.md`): for the creator's own Creation, Studio, Material and Home, `GET /api/v1/context-line` builds facts server-side under RLS (version and change summaries, unused recent Materials, themes, similar Materials; creator text fenced as untrusted), asks the configured provider for one line (`context_line` task, low effort), validates it (≤56 chars, confidence ≥0.75, only supplied keys, no first person/praise/AI mentions/invented numbers, never the title) and caches it per object version for 10 min. It slots in at P6 — below errors, offline, publishing, live, approvals and saving; above lifecycle — and crossfades in after the deterministic line; no loading state, and without a live provider it stays quiet (no fake insight). Per-page AI copy for rights, rooms, huddles and business waits on those pages' structured facts | Done |
| UI-E | **Contextual image generation — phases 1–7** (`docs/image-generation.md`): provider-neutral image interface with a Gemini REST adapter (key in a header, blocked/empty answers are failures, nothing stored for them) and an honest "not connected" provider; quality router (preview → fast, standard → default, premium → premium model, env-overridable; `image-router-v1`); minimised context (the Creation and its version, ≤4 of the creator's own Materials with summaries, ≤3 clean image references, themes/moods) with fenced creator text (`context-image-v1`); SHA-256 context hash; `image_generations` + `image_generation_assets` (server-written pipeline state, read by the creator and the Creation's collaborators, private storage, signed URLs); cache-first requests with dedupe, idempotency keys, a 10-minute failed TTL and "Try another direction" as a new variation; jobs (after() + cron retry); WebP master ≤1920px + 480px thumbnail; partial success kept; per-tier hourly budgets. UI: a compact "Ways this could look" carousel on Material detail and Explore — stored directions show at once, new ones only when asked, 4 skeletons + "Creating visual directions…", 140ms crossfade, select a concept. Next phases: Creation/Transform previews, save as Material/Creation with lineage, premium, cost dashboard | Done |
| UI-E | **CreativeRadio (Mood Music Player MVP, `music-player.md`; `soundtrack` in code)**: 27 licensed tracks — Kevin MacLeod (incompetech, CC BY 4.0, credited in song details) and Musopen's Chopin recordings (CC0) — catalogued in `@wonder/creator-soundtrack` with hashes; the server mirrors each file (SSRF-guarded fetch, SHA-256 must match, MP3 detected) into a public `soundtrack` bucket, streaming from the licensed source until then. AudioProvider above the routes (survives navigation; track, mood, queue, volume and position saved locally), mini player beside the Palette, Soundtrack panel/bottom sheet with mood chips, ranked songs, now playing, song details, Up next (reorder/remove/clear), refresh mix, more like this, favourites (RLS), shuffle/repeat; "Set the mood" / "Calm · song" as a quiet Palette leaf. Visual directions also on the Creation page ("Slide visuals" for carousels) with a Studio Palette shortcut | Done |
| UI-E | Density/minimalism passes for the remaining screens (Home hero and action grid, Materials, Studio, Room, Huddles, Settings rows) | Next |
| UI-D | Brand, Campaign, Commercial Rights, Market, Business, Analytics — screens arrive with P1-15+; they'll be built in the Canvas/Palette language | Waiting on P1 |
| UI-B | Transform · Quality · Versions · Rights · Share/Publish · Approval Center | Not started |
| UI-C | Creative Room · Crew · Invitations · Tasks · Collaborative editing · Contributions · Find collaborators · Huddles | Not started |
| UI-D | Autonomy · Privacy · CreatorPublish · Brand · Campaign · Commercial rights · Market · Business · Analytics | Not started |

## Asset dependencies

See `packages/ui/src/brand/ASSETS.md` → Missing assets (Palette motif; composable botanical corners and washes).
