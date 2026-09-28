@apps/web/AGENTS.md
# Wonder Creator — working agreement for Claude Code

Product contract, UI contract and P0 scope: the Wonder Creator specs the owner supplied (summarised in `docs/`). Brand authority: `packages/ui/src/brand/ASSETS.md` + the supplied brand board. Never create, redraw or regenerate the logo or brand artwork. Missing assets are documented, not invented.

## How to work (owner's standing instruction)

> "continue with remaining items, don't stop, don't ask unless important"

* Continue with the remaining items without stopping; don't ask unless it's important (a decision only the owner can make, credentials, or something destructive or irreversible).
* Ship through PRs: open a PR for each piece of work and merge it to `main` once CI is green.
* Backlog: `docs/plan-p0.1-p1.md` (P0.1 then P1, in its §51/§52 order). Status lives in `docs/progress.md`; keep it current.
* UI direction: `docs/ui-redesign/spec.md` (owner-supplied, 27 Sep 2026) with reference boards in `docs/ui-redesign/boards/`. It supersedes the navigation rules in the mobile guidelines: the creator works on a Canvas, there is no bottom navigation or module tab bar, and destinations/actions live in the corner Creative Palette. CreativeMind (CreatorBrain) appears only contextually; meTalk (CreatorTalk) is a transient mode, not a chat product.
* UI terms (Creation, Creative Studio, CreativeMind, meTalk, Creative Room, Palette, CreativeRadio — the mood music player, `soundtrack` in code) change in the presentation layer only — never rename tables, packages, events or APIs for it. Boards are references, never runtime assets. Redesign phases (UI-A → UI-D) are tracked in `docs/ui-redesign/README.md`.
* Mobile: `docs/mobile-guidelines.md` (per-story mobile rules) and the boards in `docs/mockups/`, except where the UI redesign spec overrides them. Plan guardrails win over mockups (no like counts, platform-only analytics).

## Creative Palette design (owner's standing instruction)

The Palette is the product's signature control. It follows every rule in this file (minimalism, density, accessibility)
and these specifics. Contract: `docs/ui-redesign/palette-spec.md`; implementation: `packages/ui/src/components/palette.tsx`
(layout) and `apps/web/src/lib/palette/` (what it offers).

* **Fan, not a list.** Leaves open as a fan on a quarter-arc around the corner trigger: the leaf nearest the trigger sits
  beside it, the furthest sits above it. **Leaves stay horizontal** — the arc is in their placement, never a tilt or
  rotation of the leaf or its text. Never use icon-only leaves.
* The trigger is the painted Vector Kit palette only — no disc or background behind it. The open state may show a small
  surface behind the close icon so it stays legible.
* **Movable (owner, 28 Sep 2026):** the creator can drag the trigger anywhere and leave it. It docks to the nearest left
  or right edge at the dropped height, and the spot is remembered on the device (`useEdgeDock`). The fan mirrors to that
  side and opens downward when the trigger sits high on the screen. Shift + arrow keys move it; a drag is never a tap.
* **What can I do next?** — never status. Status belongs in the navbar Context Line (`docs/ui-redesign/context-strip.md`,
  `docs/ui-redesign/ai-context-line.md`).
* Contextual Palette: **3–4 primary actions**, then `More…` and `Go to…`; global Palette max **6** destinations (Home,
  Create, Materials, Huddles, Explore, Me). Create opens New Creation · Bring Material · Capture · meTalk.
* Deterministic and context-aware: page → lifecycle / media type → permissions → rank. Dangerous, rights, commerce and
  destructive actions are never first level. It hides what the server would refuse; it is not a security boundary.
* Don't repeat the page's visible primary action as a first-level leaf unless there's a strong reason.
* Compact leaves: 36–40px visual pills inside ≥44px hit targets, 14px labels, 12px hints, content-sized (not full-width).
* Motion: a soft fan-open from the trigger (slide + fade, no rotation) in 200–280ms with minimal stagger; nothing when
  reduced motion is set.
* Accessibility: focus moves to the first leaf on open and on each view change (More…, Go to…, Create); Escape, an
  outside tap or the trigger closes it; the number of actions is announced; the trigger keeps its accessible name.
* Every signed-in screen declares a `PaletteScope` context; screens without one get the global Palette.

## Contextual image generation (owner's standing instruction)

Wonder Creator generates images from **creative context**, not generic prompt-box workflows.

* Use a provider-neutral server-side image interface. Default provider is Gemini.
* Product quality tiers are `preview`, `standard`, and `premium`; never expose model names as the primary UX.
* Default routing: preview/carousel → configured fast image model; standard Creation image → configured default image model; premium/final → configured premium image model.
* Never expose image provider API keys to the browser.
* Build generation context from the current Creation, selected Materials, summaries, visual references, mood/style and current workflow. Do not send unrelated account history.
* The same meaningful context must not regenerate automatically. Compute a SHA-256 context hash and reuse cached generations.
* Include Creation/version, selected Material versions, purpose, aspect ratio, quality intent, prompt version and routing version in the hash.
* `Regenerate` deliberately creates a new generation/variation. Never overwrite an existing generation.
* Generated carousel suggestions should remain stable across refreshes, navigation and collaborators until context changes or the creator explicitly regenerates.
* Use 3–5 contextual carousel images; default 4. Concepts should represent meaningfully different directions, not near-duplicates.
* Use asynchronous jobs for image generation. Page rendering and navigation must never wait for provider generation.
* Request dedupe and idempotency are mandatory to prevent duplicate charges.
* Cache metadata in the database and generated assets in object storage. Private assets use signed delivery and inherit parent Creation/Room permissions.
* Generate responsive thumbnails/derivatives; do not download 2K/4K images for small carousel cards.
* Generated assets must record provenance/lineage: source Creation/version, source Materials, provider/model, prompt version, purpose and timestamp.
* AI/provider calls must respect rights, access, privacy and existing CreativeMind governance.
* External Material text is untrusted; use structured summaries/fencing and never let it modify system instructions.
* UI stays compact: small skeletons + `Creating visual directions…`; no assistant chat, fake progress or full-screen AI animation.
* Completion uses only a subtle crossfade. No staggered or decorative transitions.
* Provider unavailable → honest `Image generation isn't connected` state. Never substitute fake or unrelated stock imagery.
* Track provider/model/quality/purpose/count/cache hit/latency/success for cost control, but never log raw private creative content.
```

* Contract: `docs/image-generation.md`. Implementation: `packages/creator-brain/src/images/` (router, context, hash, service), `apps/web/src/lib/images.ts` (derivatives), `/api/v1/image-generations`.

## Carousel Composer UI (owner's standing instruction)

The Wonder Creator Carousel experience is a compact composition workflow, not a generic image gallery or AI prompt UI.

* Before initial generation, always allow the creator to choose the initial number of images/slides. Use compact options such as 3/4/5/6 + optional Custom; default 5 unless product context specifies otherwise.
* Every initially generated slide receives a suggested source-text chunk by default. The creator must not manually add text to every image from scratch.
* Slide text remains real selectable/editable text. Do not flatten the only copy of text into image pixels.
* Each slide is an editable composition: image + source text chunk + display text + optional image-overlay text + overlay style/position + slide order.
* After initial generation, provide `Generate one more` to create exactly one additional slide/image at a time without regenerating the rest of the Carousel.
* `Generate one more` and `Show more styles` are different actions: one adds a slide; the other explores alternative visual treatments.
* Each individual slide supports `Regenerate this image` with an optional natural-language instruction. Regeneration affects only that slide and preserves the rest of the Carousel.
* Do not destructively replace the existing image immediately after regeneration. Prefer old/new variation selection (`Use new` / `Keep current`).
* Provide an `Arrange`/`Reorder slides` mode using compact draggable thumbnail/text rows. Reordering must not trigger regeneration.
* Tapping a slide opens a focused full-screen Slide Editor. Advanced editing does not live permanently on the Overview.
* In Slide Editor, support placing text on image, dragging the overlay, resizing it, changing position, alignment, style, colour, shadow/background treatment, and editing/replacing the underlying text chunk.
* Separate text Read/Selection mode from overlay Drag/Edit mode so mobile gestures do not conflict.
* Support full-screen image viewing/editing and compact image crop/zoom/focal controls.
* Overview screen: one prominent `Continue Creating` action; maximum two visible secondary actions (normally `Generate one more` and `Arrange`). Everything else is contextual.
* Do not show permanent button walls such as Continue + Transform + Share + Context + Download + More above the Carousel.
* Move Transform/Share/Context/Download/Rights/Versions/People and other less-frequent actions into the contextual Palette, `Details`, More, or slide overflow.
* Replace persistent About/Materials/Versions/Rights/People tab rows on the working Carousel screen with a compact `Details ›` entry.
* Use one high-emphasis action at a time. Normal mobile screens have max 1 primary + 2 secondary high-level actions.
* Keep buttons visually compact while preserving >=44×44 CSS px hit targets.
* Use minimal transitions: simple sheets/page transitions and 120–160ms content crossfades. No staggered card entrances, bounce, or elaborate AI-loading choreography.
* Generation state uses compact skeletons/status only; no assistant chat, fake progress or full-screen AI animation.
* All routine text/layout/order edits autosave. Do not require a Save button for every composition change.
* Preserve source text, source Creation/version, Material lineage, generation ID, image asset, overlay configuration and order for every slide.
* Ensure all slide edit and reorder operations are accessible without precision drag gestures alone.

* Contract: `docs/ui-redesign/carousel-composer.md`.

## Persistent right-middle mini player (owner's standing instruction)

Wonder Creator's mini audio/music player is a persistent app-shell component.

* When audio is active, the player docks to the **right edge around the vertical middle of the viewport**.
* **Movable (owner, 28 Sep 2026):** the collapsed tab can be dragged anywhere. It docks to the nearest left or right edge
  at that height, is remembered on the device, and keeps >=72px from the Palette. The panel expands away from that edge.
* Default compact state is a slim right-edge tab showing tiny artwork + subtle playing indicator + expand affordance.
* Tapping the collapsed player expands a compact player **leftward from the same right-middle anchor**.
* Expanded player shows only essential controls: track info, progress, previous, play/pause, next, and optional Queue/More.
* Tapping collapse or swiping right returns it to the same right-edge tab. Collapsing never stops playback.
* Do not place the mini player in bottom navigation or as a persistent bottom bar.
* The player persists across routes and should be mounted once at app-shell level. Never create a new audio element/player instance per page.
* Playback continues across Home, Materials, Creation, Creative Studio, Creative Room, Explore, Huddles, Me, Business, Analytics and Settings unless interrupted by another audio-focus experience.
* In immersive/full-screen editing contexts, default to `forceCollapsed`; playback continues.
* Live Huddle or foreground video/audio should pause or appropriately interrupt background mini-player audio.
* Player must not cover the Palette, primary CTA, keyboard, live controls, text-overlay handles, or other high-priority UI. Shift vertically or force-collapse when collision occurs.
* Maintain >=72px separation from the Palette trigger when both are visible.
* Use only one restrained expand/collapse transition (roughly 180–260ms). No bounce, rotation, multi-stage choreography or decorative animation.
* Respect `prefers-reduced-motion`.
* Collapsed mode should not expose multiple tiny buttons. Its main purpose is awareness + expand.
* Expanded player remains compact; secondary controls such as mood, queue, save, stop, repeat/shuffle live under Queue/More as relevant.
* Minimum interactive hit target remains >=44×44 CSS px.
* If no track/queue is active, do not show the mini player.
* Persist current track, queue, playback time and play/pause state across route navigation.
* Integrate OS Media Session controls where supported.
* Keep playback state isolated so progress updates do not trigger app-wide re-renders.

* Contract: `docs/ui-redesign/mini-player.md` (supersedes the bottom mini player in `music-player.md`). Implementation: `apps/web/src/components/soundtrack/` (`MiniPlayer`, `useMiniPlayerConstraint`, `useSoundtrackTime`).

## Interaction minimalism (owner's standing instruction)

Wonder Creator must minimize UI transitions and visible controls. The detailed contract is `docs/ui-redesign/interaction-minimalism.md`.

* Every normal screen has **one dominant action/task**, at most **two visible secondary high-level actions**, and no more than **three prominent buttons total**.
* Keep the most frequent action visible, stable and visually strongest. Do not hide the primary action in the Palette.
* Secondary/rare actions appear only when required through the contextual Palette, `More…`, a bottom sheet, or progressive disclosure.
* Do not duplicate the same actions both prominently on the page and in the first-level Palette unless there is a strong usability reason.
* Contextual Palette remains **3–4 primary items**; global Palette max **6**.
* Use at most **one major UI transition per user action**. Normal page/sheet transitions should be restrained, predictable and generally **<=280ms**.
* Use motion only to clarify spatial continuity, state change or object movement. Remove decorative entrance animations, bounce, parallax, multi-stage choreography and repeated card transitions.
* Prefer inline state changes, compact sheets and direct actions over extra intermediate pages.
* meTalk is transient: invoke → capture intent → act/clarify if necessary → disappear. Do not create a persistent chat workflow.
* CreativeMind shows at most **one prominent contextual insight/suggestion** at a time; never stack AI cards or create a permanent assistant panel.
* Do not show future-stage actions early. Publish, License, Market, Analytics and commercial actions appear only when the Creation/context makes them relevant.
* Keep direct consequential controls visible in context: Approve/Decline, Save, Cancel, Leave Huddle, media controls and form submission are not hidden behind the Palette.
* Confirm only destructive, financial, rights-changing or externally consequential actions. Do not add confirmation dialogs to normal creative actions.
* Empty states: one short message + one primary action. Error states: one clear recovery action.
* Primary action placement should remain stable between nearby states. Avoid moving the same action around the screen as content updates.
* Purple/high-emphasis styling should normally identify only one primary action or selected state at a time.

### Interaction review sequence

For every screen:

1. Identify the one most frequent/important action.
2. Keep it visible and stable.
3. Keep at most two secondary actions visible.
4. Move everything else to contextual reveal.
5. Remove duplicated actions.
6. Remove unnecessary intermediate screens.
7. Remove decorative motion.
8. Ensure each user action causes no more than one major transition.
9. Verify consequential actions remain explicit.
10. Verify reduced-motion mode and E2E flow length before marking complete.

## UI density & compactness (owner's standing instruction)

Wonder Creator product screens must be **compact, calm and editorial**, not large and sparse.

The detailed implementation contract is `docs/ui-redesign/compact-density.md`. Follow it on every new or modified product screen.

### Non-negotiable density rules

* Reduce **visual** control size, typography and whitespace; do not reduce accessibility. Interactive hit targets remain at least **44×44 CSS px**.
* A button/pill may look 32–40px high while living inside a >=44px hit target. Do not use 52–64px full-width pills for ordinary actions.
* Mobile page titles are normally **22–24px**; Creation titles **20–22px**; section titles **15–17px**; body **14px**; secondary text **13px**; metadata **12–12.5px**. Reserve 26–30px display type for Home/onboarding/editorial hero moments.
* Routine mobile page padding is **14–16px**; card padding **8–12px**; card gaps **8–10px**; section gaps **12–16px**. Do not use 32–48px vertical whitespace in normal application screens without a deliberate editorial reason.
* Standard headers should fit in roughly **44–48px**. Do not use marketing-style title/subtitle blocks on utility/detail pages.
* Flatten nested cards. Prefer one surface + dividers + compact rows over card-inside-card layouts.
* Prefer compact **44–52px rows** for settings, choices, integrations, notifications, tasks, rights and utility actions instead of large button/card stacks.
* Use full-width primary CTAs only for a genuine single completion action (Save, Publish, Submit, etc.). Contextual actions belong in the Palette or compact inline controls.
* Chips/tabs should be visually around **28–32px** high and horizontally scroll where necessary rather than wrapping into several tall rows.
* Non-immersive mobile hero media should usually be about **160–220px** high / roughly 24–30vh. Do not consume half the screen with routine detail-page heroes.
* Decorative botanical/watercolour assets must be absolutely positioned or background decoration. They may decorate existing negative space but must **not create large empty layout regions**.
* CreativeMind insight defaults to **one compact 2–3 line card + one action**. Do not stack large AI explanation cards or chat transcripts.
* Contextual Palette shows **3–4 primary actions**; global Palette max **6**. Use `More…` for secondary actions rather than elongating the Palette.
* Group metadata instead of creating tiles for every fact. Example: `Short Film · v4 · Private · 2:38`.
* Use progressive disclosure for secondary metadata, rights history, advanced settings, audit detail and provider/debug information.
* At a normal ~390×844 viewport, non-immersive pages should normally expose the primary content **and at least one useful next/context element above the fold**.
* Compact does **not** mean cramped: do not make body text smaller than the compact scale, do not reduce touch targets, and do not sacrifice rights/approval/security clarity.
* When reviewing an existing page, if it can become **15–25% shorter** without losing useful information or hurting readability/touchability, make it shorter.
* Whitespace separates meaning; it must not compensate for oversized components.

### Compactness implementation sequence

For every screen:

1. Identify the primary creative object or decision.
2. Remove duplicated labels, descriptions and action blocks.
3. Apply compact typography.
4. Reduce component padding/gaps.
5. Replace large cards/buttons with rows where suitable.
6. Flatten nested surfaces.
7. Move secondary detail behind progressive disclosure.
8. Move contextual actions into the Palette.
9. Ensure decoration does not consume flow layout.
10. Verify >=44px hit targets and accessible text.
11. Screenshot-test at 320/360/390/430/480px and a representative desktop viewport.
12. Do not mark complete until density has been visually reviewed.

## Commands

* `npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`
* `npx supabase start` then `npm run test:db` (RLS/security suite) and `npm run test:e2e` (app on :3000)
* Run lint, typecheck, unit tests and build before pushing. Run `test:db` after any migration change.

## Layout

* `apps/web/src/app/(studio)` — signed-in screens; `(auth)` sign in/up; `onboarding`; `api/v1/**` route handlers.
* Every route handler uses `withApi` (`apps/web/src/lib/api.ts`): auth → creator resolution → rate limit → validation → domain service → event/audit → response. Route handlers and Server Functions are public endpoints.
* Domain logic lives in `packages/creator-*`; the app composes it. Keep business rules out of React components.
* `packages/ui` is the only place for tokens and shared components. New patterns go there.

## Invariants (do not break)

1. RLS on every creator-owned table; UI visibility is never authorization. Add a `tests/db` case for new policies.
2. The browser never gets the service key. `serviceClient()` is only for pipeline-owned state, always scoped by a server-resolved creator id. Huddle state changes go through security-definer RPCs.
3. AI never writes to the database directly and never authorizes itself: CreatorBrain goes through governed tools (`packages/creator-brain/src/governance.ts`) + autonomy policy. Rights, commerce and destructive actions can never auto-execute.
4. External material is untrusted: fence it (`fenceUntrusted`), never let it change settings. URL fetches go through `safeFetch` (SSRF guard). Uploads go through `inspectUpload` (content-detected MIME, size limits, SHA-256).
5. Versions are immutable; restore creates a new version. Derivatives record lineage.
6. Huddles are ephemeral: dissolve at zero participants; only explicitly preserved outcomes persist.
7. No fake providers: unconfigured AI/media/transcription show honest "not connected" states.
8. Models: provider-neutral (`packages/creator-brain/src/providers`). `WONDERCREATOR_AI_PROVIDER` = `gemini` (REST, `gemini-3.8-flash` default) | `anthropic` (`@anthropic-ai/sdk`, `claude-opus-5` default) | `offline`; key in `WONDERCREATOR_AI_API_KEY`; optional `WONDERCREATOR_AI_MODEL`.

## Conventions

* Env vars: see `.env.example`. Never commit `.env*` files or keys (GitHub push protection will block them).
* Migrations are append-only in `supabase/migrations`; regenerate types with `npm run db:types`.
* UI: warm cream surfaces, Inter + Playfair Display, brand tokens only, 44px targets, works at 360px, loading/empty/error states for every screen, reduced motion respected, colour never the only signal.
