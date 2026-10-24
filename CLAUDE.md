@apps/web/AGENTS.md

# Wonder Creator — working agreement

Contracts live in `docs/`; read the linked one before changing an area. This file holds the rules that apply everywhere.

## Every session

- Work the backlog in `docs/plan-p0.1-p1.md` (P0.1, then P1; §51/§52 order). Keep `docs/progress.md` current.
- Keep going. Ask only for owner-only decisions, credentials, or anything destructive or irreversible.
- On finishing a task (merged, or blocked on something only the owner can do), send one `PushNotification` line: what's done and what the owner must act on. Also when an owner decision blocks work. [4 Oct 2026]
- Ship via PRs, one per finished piece of work: CI green on the current head, no conflict, no open blocking review finding → squash-merge yourself → reset the working branch from `main` → notify. Never push straight to `main`. Dependabot PRs merge only when the owner names them. [15–16 Oct 2026]
- Before opening or merging a PR, check for an open issue "End-to-end tests failing on main" and the latest nightly run. Fix a red nightly first (see Build slots).

## Token economy

- Keep sessions short: start a new session or `/compact` after each finished batch. State lives in `docs/` and PRs, not the conversation.
- Batch related requests into one branch and one PR; add to the open PR while CI runs.
- CI: when a CI-completed event arrives, read the check results once and act (merge or fix) in that turn. No polling, `sleep` loops or repeated status checks.
- Text before pixels: `node scripts/ui-check.mjs <path> [--find role:name] [--click role:name]` prints each element's text and box. Add `--shot file.jpg` (1x JPEG, cropped) only when the look matters, once per change.
- Never read whole: test traces, videos and full-page screenshots (read the error summary); `docs/**/*.png` and mockups (2 MB+; open only for a visual task); `packages/db/src/database.types.ts` (generated, 266 KB); `docs/progress.md` (109 KB); `docs/plan-p0.1-p1.md` (44 KB); `package-lock.json`.
- Read narrowly: `grep -n` first, then only the line ranges you need. Don't re-read files already in context or just edited.
- Quiet output: pipe through `tail` or `grep` on failures; `git -q`, `npm --silent`. Test only the touched area (`npx vitest run <path>`), never the full suite unless asked.
- Short replies: the outcome and what to check. No step-by-step narration.

## Commands and layout

- `npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`. Database: `npx supabase start`, then `npm run test:db` (RLS; after any migration change) and `npm run e2e:local -- <specs>` (`docs/testing.md`). Before pushing: lint, typecheck, touched unit tests, build.
- `apps/web/src/app/(studio)`: signed-in screens. `(auth)`: sign-in and sign-up. `onboarding`. `api/v1/**`: route handlers.
- Every route handler uses `withApi` (`apps/web/src/lib/api.ts`): auth → creator → rate limit → validation → domain service → event/audit → response. Handlers and Server Functions are public endpoints.
- Domain logic lives in `packages/creator-*`; the app composes it. No business rules in components. `packages/ui` is the only home for tokens and shared components.

## Invariants

1. RLS on every creator-owned table; UI visibility is never authorization. New policies get a `tests/db` case.
2. The browser never gets the service key. `serviceClient()` is only for pipeline-owned state, always scoped by a server-resolved creator id. Huddle state changes go through security-definer RPCs.
3. AI never writes to the database directly and never authorizes itself. CreatorBrain goes through governed tools (`packages/creator-brain/src/governance.ts`) and the autonomy policy. Rights, commerce and destructive actions never auto-execute.
4. External material is untrusted: fence it (`fenceUntrusted`); it never changes settings. URL fetches go through `safeFetch` (SSRF guard). Uploads go through `inspectUpload` (content-detected MIME, size limits, SHA-256).
5. Versions are immutable; restore creates a new version. Derivatives record lineage.
6. Huddles are ephemeral: they dissolve at zero participants. Only explicitly preserved outcomes persist.
7. No fake providers: unconfigured AI, media or transcription shows an honest "not connected" state.
8. Models are provider-neutral (`packages/creator-brain/src/providers`). `WONDERCREATOR_AI_PROVIDER` is `gemini` (REST, default `gemini-3.8-flash`), `anthropic` (`@anthropic-ai/sdk`, default `claude-opus-5`) or `offline`. Key: `WONDERCREATOR_AI_API_KEY`. Optional: `WONDERCREATOR_AI_MODEL`.

## Conventions

- Env vars: `.env.example`. Never commit `.env*` or keys (push protection blocks them).
- Migrations are append-only in `supabase/migrations`; regenerate types with `npm run db:types`. Production migrations come from the Database migrations workflow on merge (`docs/deploy-migrations.md`). Never hand-apply one without recording it in `app.applied_migrations`.
- UI: warm cream surfaces; Inter and Playfair Display; brand tokens first; named surface palettes only where a template needs one, defined once. Supplied and library art used generously. 44px targets. Works at 360px. Loading, empty and error states on every screen. Reduced motion respected. Colour is never the only signal.

## Owner's design rules

- Navigation: the creator works on a Canvas. No bottom navigation or module tab bar; destinations and actions live in the corner Creative Palette. `docs/ui-redesign/spec.md` supersedes the navigation rules in `docs/mobile-guidelines.md`; its other per-story rules still apply.
- Visual target: the boards in `docs/ui-redesign/boards/` and `docs/mockups/`. On art, colour, type, spacing, composition and mood, the boards are the target. Plan guardrails win over mockups on guardrails (no like counts, platform-only analytics, privacy, rights). Boards are references, never runtime assets.
- Brand: never alter, redraw or regenerate the logo, wordmark or app icon, and never alter supplied art. Brand authority: `packages/ui/src/brand/ASSETS.md` and the supplied brand board.
- Decorative art (backgrounds, botanicals, washes, textures, paper, light, illustrations) may be authored in code when nothing supplied fits and it lifts the result. Prefer supplied art, record provenance in `ASSETS.md`, and never present authored art as a real photograph or someone's content.
- Terms: Creation, Creative Studio, CreativeMind (CreatorBrain; shown only in context), meTalk (CreatorTalk; a transient mode, not a chat product), Creative Room, Palette, CreativeRadio (`soundtrack` in code), Pulse (the open space for conversations, asks and people; `community` in code), Community. These change in the presentation layer and page routes only: `/creations`, `/rooms`, `/pulse`, `/materials`, `/explore`, `/people`, `/me`, with permanent redirects from the old paths in `next.config.ts`. Never rename tables, packages, events or APIs. Phases: `docs/ui-redesign/README.md`.

## Aesthetic excellence

- Target: calm, painterly, editorial and warm, as the boards show. Tidy but plain is a failure.
- On expressive surfaces, aesthetics win over density numbers. Accessibility (contrast, 44px targets, reduced motion, readable type), privacy, rights and the logo never bend.
- Before building a screen with a board, list what gives the board its character (art, type scale, colour, texture, depth, spacing, imagery) and carry all of it over. Don't reduce it to a layout.
- Art is part of the design: painted heroes, botanicals in cards, washes behind tiles, paper and grain on editorial surfaces. Sources: `brand/kit.ts`, `brand/watercolor.ts`, `brand/creator-page.ts`.
- Real imagery first: the creator's own pictures (covers, first slides, Moments photos), then art. Empty image slots get painted washes or typographic treatment, never grey boxes or generic icons.
- Type: Playfair Display for names, titles and statements; Inter for UI. Expressive surfaces may use 26–60px display sizes and italics; utility surfaces keep the compact scale.
- Depth: soft layered shadows, translucency over art, paper grain, tinted surfaces. Flat white boxes on flat cream are not house style.
- Colour: brand tokens first. Surfaces with their own palette (Cinematic Dark, Editorial Paper) define named values once, in tokens or the template.
- Expressive: Home, onboarding, Profile, Creator Page, published works, DejaVu, Moments and Scrapbook, empty states, sign-in. Utility: settings, rights, approvals, business, forms, lists. Density rules apply fully to utility; on expressive surfaces they cap clutter, not beauty.
- Restraint: one hero, one accent, art in negative space, no clutter, no decorative loops. Text over art needs a scrim or shadow.
- Review before shipping: screenshot at 390px and a desktop width beside the board, and fix missing art, plain cards, weak type, cramped or empty composition. Passing tests is not done for UI; a screen is complete only once density and aesthetics are checked against the board.

## Creative Palette

Contract `docs/ui-redesign/palette-spec.md`. Code: `packages/ui/src/components/palette.tsx`, `apps/web/src/lib/palette/`.

- Fan, not a list. Leaves stack above the corner trigger (below it when the trigger is high). Each leaf's start (icon and first letter) sits on a quarter-arc around the trigger: nearest leaf closest to the trigger's column, furthest leaf furthest away. Leaf ends are free. Leaves stay horizontal, never tilted or rotated. Never icon-only leaves.
- The trigger is the painted Vector Kit palette only, with no disc behind it. The open state may show a small surface behind the close icon.
- Movable [28 Sep 2026]: a drag moves the trigger. It docks to the nearest left or right edge at the dropped height, remembered on the device (`useEdgeDock`). The fan mirrors to that side and opens downward when the trigger is high. Shift + arrow keys move it. A drag is never a tap.
- Label: "What can I do next?", never status. Status belongs in the navbar Context Line (`docs/ui-redesign/context-strip.md`, `ai-context-line.md`).
- Contextual Palette: 3 primary actions, then `More…` and `Go to…`. Global Palette: 4 destinations (Create, Materials, Explore, Me; Home too, away from Home; Huddles is a door inside Explore) plus the quiet music leaf. [4 Oct 2026]
- Create opens "Make a new Creation": Writing, Carousel, Images, Video, Audio, Presentation (each on its own page [5 Oct 2026]); Collaborate with others (a new Creative Room); a quiet bring-in or capture link. [4 Oct 2026]
- Order: page → lifecycle or media type → permissions → rank. Deterministic. Dangerous, rights, commerce and destructive actions are never first level. Hiding is not security; the server still refuses.
- Don't repeat the page's visible primary action as a first-level leaf without a strong reason.
- Sizes: 36–40px visual pills in ≥44px hit targets; 14px labels; 12px hints; content-sized, not full-width.
- Motion: soft fan-open (slide and fade, no rotation), 200–280ms, minimal stagger. None under reduced motion.
- A11y: focus moves to the first leaf on open and on each view change (More…, Go to…, Create). Escape, an outside tap or the trigger closes it. Announce the action count. The trigger keeps its accessible name.
- Every signed-in screen declares a `PaletteScope`; screens without one get the global Palette.

## Interaction

Contract: `docs/ui-redesign/interaction-minimalism.md` (its review sequence applies to every screen).

- One dominant action per screen: the most frequent, stable and visually strongest. At most two visible secondary actions and three prominent buttons in total. High-emphasis (purple) marks one primary action or selected state.
- Rare actions go to Palette `More…`, a sheet or progressive disclosure. Never show the same action both on the page and first-level in the Palette.
- Consequential controls stay visible in context: Approve and Decline, Save, Cancel, Leave Huddle, media controls, form submission.
- Transitions: one major transition per user action, ≤280ms, predictable. Motion only clarifies continuity, state or object movement. No decorative entrances, bounce, parallax, multi-stage choreography or repeated card transitions. Prefer inline changes and compact sheets over intermediate pages.
- Confirm only destructive, financial, rights-changing or externally consequential actions.
- Future-stage actions (Publish, License, Market, Analytics, commercial) appear only when the Creation makes them relevant.
- Empty state: one short message and one primary action. Error state: one clear recovery action. The primary action stays in the same place across nearby states.
- Fewer buttons [4 Oct 2026, every page]: count the tappable things above the fold and on the whole page; each must earn its place. A section title is its link (no "See all" or "All X" rows). A card is one link. Setup invitations live where the setting lives (Me, Settings), not on content pages. Nothing appears twice across header, page and Palette. When you touch a page, say in the PR what was removed or merged.
- CreativeMind: at most one prominent insight or suggestion, as a 2–3 line card with one action. Never stack cards or keep a permanent assistant panel.

## Density

Contract: `docs/ui-redesign/compact-density.md` (§21 is the implementation checklist).

- Visual sizes may shrink; hit targets never go below 44×44 CSS px. Ordinary buttons look 32–40px high. No 52–64px full-width pills; full width only for a single completion action (Save, Publish, Submit).
- Type: mobile page titles 22–24px; Creation titles 20–22px; section titles 15–17px; body 14px; secondary 13px; metadata 12–12.5px. Expressive surfaces may use display type up to 60px.
- Spacing: page padding 14–16px; card padding 8–12px; card gaps 8–10px; section gaps 12–16px. No 32–48px vertical whitespace on utility screens. Whitespace separates meaning; it must not compensate for oversized components. Headers fit in ~44–48px; no marketing title blocks on detail pages.
- Flatten nested cards into one surface with dividers and compact rows. Settings, choices, integrations, notifications, tasks and rights use 44–52px rows.
- Chips and tabs are 28–32px high and scroll horizontally rather than wrapping.
- Heroes: 160–220px on utility and detail pages (about 24–30vh). Expressive surfaces (Profile, Creator Page, published works, Home) may use 30–45vh painted or photographic heroes.
- Botanicals sit in negative space or behind heroes. They never push primary content below the fold on utility screens or reduce contrast.
- Group metadata (`Short Film · v4 · Private · 2:38`). Use progressive disclosure for secondary metadata, rights history, advanced settings, audit detail and provider or debug info.
- At 390×844, a non-immersive page shows the primary content and at least one useful next or context element above the fold.
- Compact is not cramped: body text stays on the compact scale; touch targets stay intact; rights, approval and security clarity is never sacrificed.
- Shorten a utility page by 15–25% when that loses nothing useful.
- Check at 320, 360, 390, 430 and 480px, and at a desktop width.

## Carousel Composer

Contract: `docs/ui-redesign/carousel-composer.md`. Key rules:

- Creator picks the initial slide count first (3, 4, 5, 6 or Custom; default 5). Each slide gets a suggested source-text chunk, kept as real, editable text, never flattened into pixels.
- `Generate one more` adds exactly one slide; `Show more styles` explores treatments. They are different actions.
- `Regenerate this image` (optional instruction) affects that slide only and offers `Use new` or `Keep current`. Reordering never regenerates.
- Overview: `Continue Creating` plus at most two secondary actions. Advanced editing lives in the full-screen Slide Editor. `Details ›` replaces the tab rows. Routine edits autosave.

## Mini player

Contract: `docs/ui-redesign/mini-player.md`. Code: `apps/web/src/components/soundtrack/`.

- Mounted once at app shell, never in bottom navigation. Docks to the right edge at the vertical middle when audio is active; the tab is movable and keeps ≥72px from the Palette. Expands leftward.
- Collapsing never stops playback. Never covers the Palette, a primary CTA, the keyboard or live controls. Immersive contexts force-collapse. A live Huddle interrupts it.
- One 180–260ms transition, none under reduced motion. Hidden when no queue is active. State persists across routes; integrate Media Session.

## Features

Each contract lives in `docs/`; read it before changing the feature.

- **Personal Sources** (`docs/personal-sources.md`): Connect, Discover, Review and Bring In stay separate. Sync never runs in a request. Nothing is imported without an explicit choice. Disconnect deletes what was discovered.
- **Testimonials** (`docs/testimonials.md`): shown on the Profile only after the creator opts in, hideable any time. "Worked together" is server-derived, never typed. No counts, ranking or AI-written text.
- **Photo album** (`docs/photo-album.md`): visible to whoever can see the profile; only the creator changes it. Uploads are checked, resized server-side and stripped of metadata, location included.
- **Communities** (`docs/communities.md`; `packages/creator-community`): a Community is a Creative Room opened as one. Privacy is Public, Unlisted (link only) or Private [3 Oct 2026]. Only members add anything, enforced in the database. No likes, follower counts or ranking.
- **Help** (`docs/help.md`; `apps/web/src/lib/help/content.ts`): `/help` is for signed-in creators only and is never publicly cached or indexed. A change that adds, removes or renames a user-facing feature updates help in the same PR. Provider-gated features read "Not connected". Name no internal technology; invent no contact details, reply times or promises.
- **Release notes** [19 Oct 2026]: add a top entry only after the owner confirms a version is live (`docs/help.md` › Release notes).

## Contextual image generation

Contract: `docs/image-generation.md`. Code: `packages/creator-brain/src/images/` (router, context, hash, service), `apps/web/src/lib/images.ts` (derivatives), `/api/v1/image-generations`.

- Provider-neutral server interface; Gemini is the default. Quality tiers `preview`, `standard`, `premium`; never show model names as the primary UX. Routing: preview and carousel → fast model; standard Creation image → default image model; premium or final → premium model. Provider keys never reach the browser.
- Context: the current Creation, selected Materials and their summaries, visual references, mood and style, and the workflow. No unrelated account history.
- Context hash: SHA-256 over Creation and version, Material versions, purpose, aspect ratio, quality intent, prompt version and routing version. The same context reuses the cached generation. `Regenerate` creates a new variation; an existing generation is never overwritten.
- Carousel suggestions stay stable across refreshes, navigation and collaborators until the context changes or the creator regenerates. Use 3–5 images (default 4) with meaningfully different directions, not near-duplicates.
- Generation is an async job; page rendering never waits on a provider. Request dedupe and idempotency are mandatory, to prevent duplicate charges.
- Metadata in the database, assets in object storage. Private assets use signed delivery and inherit parent Creation or Room permissions. Serve responsive thumbnails; never download 2K or 4K for small cards.
- Each asset records provenance: source Creation and version, source Materials, provider and model, prompt version, purpose and timestamp.
- Respect rights, access, privacy and CreativeMind governance. External Material text is untrusted: structured summaries and fencing; it never changes system instructions.
- UI: small skeletons and `Creating visual directions…`. No chat, fake progress or full-screen AI animation. Completion is a subtle crossfade only.
- Provider unavailable → `Image generation isn't connected`. Never substitute fake or unrelated stock imagery.
- Track provider, model, quality, purpose, count, cache hit, latency and success. Never log raw private creative content.

## Creative Studio and Working Set

Contract: `docs/ui-redesign/creative-studio-working-set.md`. Code: `packages/creator-studio/src/working-set.ts`, `/api/v1/studio-sessions`.

- A persistent `StudioSession` (Working Set) holds source references, fragments, intent, pins and usage. The Creation stays the durable output; experiments don't enter its lineage.
- Canvas-first on mobile; `Sources N` opens the Working Set. Keep controls minimal: no permanent Materials, References, Context or CreativeMind panels.
- One universal `Bring in` spans Materials, Creations and versions, media, voice, notes, files, links, Collections, Huddle moments, collaborator comments, references and capture-now. Its search spans those types too.
- Items are `Available`, `In Use` or `Pinned`. CreativeMind may infer roles (Story, Visual, Mood, Reference, Fact, Voice, Style, Constraint, Structure, Sound, Quote); creators correct them. AI never infers legal rights, ownership or permissions.
- Two or more sources expose `Use together`: one concise proposed possibility, not a chat flow.
- Fragments (ranges, clips, frames, sections, scenes, stanzas, blocks) and partial reuse of previous Creations (Whole Creation, Text, Visual Style, Scene, Structure, Idea, Opening, Ending) record their reuse intent.
- Output format is independent of the Working Set; transform by changing the canvas mode inside Studio. meTalk acts on context directly (e.g. `use these photos`).
- CreativeMind surfaces at most one connection. `What's influencing this?` shows In Use, Available and Pinned sources. Unused sources are never discarded automatically. Pins are constraints: ask before changing a pinned source.
- Huddle moments and comments enter via `Save to Studio` / `Use in Studio`. Projects make briefs and references available without marking them In Use.
- Studio owns session state only; Materials, Creations, Huddles, Projects, Rights, People and Comments keep their domains. Store references, not copies.
- Provenance records only what a committed result used. Routine add, remove, select and pin actions autosave without a version. Convergence never bypasses RLS, permissions, rights, governance or provider boundaries.

## Creative Room parts

Contract: `docs/creative-room-parts.md`. A Room is made of parts (Lyrics · Tune · Voice), each a Creation on its format's page. Parts are peers with no pipeline; anyone may be invited to one part without joining the Room. Shares are equal per person. Versions record the other parts' versions they were made with. No AI melodies, lyrics or arrangements.

## Back navigation

Contract: `docs/ui-redesign/back-navigation.md`.

- Back is a return, not a parent link. Order: the per-tab trail (`NavMemory`, skipping pages that only forward); then an explicit `?from=`; then the natural home, which follows context (a part's Creation returns to its Room).
- One `BackLink` component. Its accessible name says where it goes, e.g. "Back to the Creative Room".
- Deleting or leaving something drops its pages from the trail. Done is not Back. `Go to…` and the top bar start new journeys. Never hard-wire Back to a parent page.

## Performance

Contract and measurements: `docs/performance.md`. Requests cost time here, not queries: a database round trip is ~90 ms live; queries take under 10 ms.

- Page stages: at most three (session → the object → everything about it). Ask everything that needs only the route id and viewer in one `Promise.all`. Chain only what truly needs an earlier answer, inside its own branch.
- No `await` in a loop, no N+1. Batch with `.in(...)`, an embedded select or one RPC.
- Show the shell and the dominant action first; slower sections stream behind same-height placeholders. No blocking spinner.
- Read only what you show: name columns; never `select("*")` on lists or hot reads of text, jsonb or `search` columns (`MATERIAL_COLUMNS`, `ARTIFACT_COLUMNS`). Every list has `.limit()` and paging. "Is there any?" is `limit(1)`. Counts use `head: true` or a grouped SQL function, never rows counted in JavaScript (PostgREST caps at 1,000).
- Audit, telemetry, mark-read, re-indexing, summaries and key lookups go in `after()`. Events a later step depends on stay in the request.
- Never ask twice: memoise session, consents and avatar per request (`cache` or `WeakMap`). `withApi` remembers the creator id. Pass data you already hold.
- Polls: one endpoint, one database call. Pause while hidden, refetch on return, slow down when nothing changes. Never poll with a write. Don't poll what the page already received. Two components never fetch the same endpoint independently.
- Caching: `withApi` JSON is `no-store`. Private, low-churn data may use `private, max-age=…`. Per-creator data is never `public`. Anything a write changes is refreshed after the write. Shared reference data (the soundtrack catalogue) is cached once. Server-only data stays server-only. No `cacheComponents` or `staleTimes` without an app-wide invalidation rule (owner).
- Indexes come with the table: the columns the app filters, joins, orders or deletes by, plus anything an RLS policy looks up per row. Use `(filter, order desc)` composites and partial indexes for `status`, `deleted_at` and `failed`. Don't index audit columns (`created_by`, `updated_by`). Write policies are split per command beside a `select` policy, never `for all`. Run the performance advisors after DDL and fix what they raise.
- Measure before optimising (`pg_stat_statements`, a timed function run as a creator). A performance PR records dependent stages or requests per page before and after; a database PR records the advisor result.
- JavaScript: sheets, canvases and panels load with `next/dynamic`. List pages stay ≤200 KB gzipped. Heavy libraries (the Huddle media client, zod outside forms, the browser Supabase client) never ride on every page. A client component never imports server-only data.
- Images: sized for where they show; every image has `width` and `height` or an aspect ratio. The one above the fold is `fetchPriority="high"`; the rest are `loading="lazy"` and `decoding="async"`.
- Polling is one fetch path: `apps/web/src/lib/use-poll.ts`.

## Build slots and deployments

Contract and numbers: `docs/performance.md` › Build slots and deployments. Vercel counts every deployment it creates against the daily cap (100 on the free plan), including ignored ones.

- Merge automatically when green (see Every session). Batch: one PR per finished piece of work; one squash-merge is one deployment. Check the day's count first: `git log origin/main --since='24 hours ago' --oneline | wc -l`. Above ~70, hold everything except production and hotfixes.
- Only `main` deploys (`apps/web/vercel.json` › `git.deploymentEnabled`). No previews. Never link a second Vercel project to the repository.
- No docs-only PRs: a docs-only merge still creates and cancels a deployment. Docs, `docs/progress.md`, Help topics and tests go in the PR with the code they describe.
- Verify before pushing so there are no fix-up pushes; push a branch once, when ready.
- Tests never spend a slot. E2E and RLS run on GitHub Actions or locally against a local app. PRs run fast checks only (typecheck, lint on changed files, related unit tests, build; RLS when the database changes). E2E runs nightly at 03:00 IST (`e2e-nightly.yml`), never on PRs or merges. Until launch the owner allows the whole suite and any number of throwaway test users and data, on local stacks only, never production.
- Before a risky merge (sign-in, permissions, migrations, payments, a new cross-feature flow), run the affected specs locally: `npm run e2e:local -- e2e/<spec>.spec.ts`.
- A red nightly is fixed before other work merges. Check the open issue "End-to-end tests failing on main" and the latest nightly, then find the root cause ("flaky" is not one). Never skip, disable or delete a test to get green; never re-run a failed run hoping it passes (`docs/testing.md`).
- Cap hit: stop pushing to `main` (refused deployments aren't queued). Wait until the oldest counted deployment is 24 hours old, then redeploy the latest `main` once. "Rate limited" is infrastructure, not a test failure.
