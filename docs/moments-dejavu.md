# Moments + DejaVu — implementation contract

Owner spec: [`phases/01-moments-dejavu-foundation.md`](phases/01-moments-dejavu-foundation.md) (Phase 01 of 5). This page says how it is built.

## What they are

* **Moment**: a cross-domain *reference* with a small preview (`moment_references`). It is never the canonical
  object. Materials stay Materials and Creations stay Creations, and their tables keep their own truth and access
  rules. Nothing was renamed.
* **DejaVu**: a creator's recurring thread (a person, place, idea or feeling) connecting Moments across time
  (`dejavus`, `dejavu_moments`).
  * It is not a Collection (curated on purpose) and not a Project (made on purpose).
  * A Moment can carry any number of DejaVus.
* **Suggestions** (`dejavu_suggestions`): CreativeMind's ideas. They are written only by the pipeline (service role)
  and attached only when the creator accepts one. Accepted links are marked `creativemind_suggestion_accepted`, so
  they stay distinguishable from the creator's own (`user`).
  * Structurally supported; nothing generates them yet.

## Data (migration `…059_moments_dejavu.sql`)

* **`moment_references`**: one row per creator per entity (`unique (creator_id, entity_type, entity_id)`).
  * The `entity_type` check lists every kind in the spec. Only `material` and `creation` can be inserted
    (`app.can_see_moment_entity`); the rest stay closed until their adapter lands.
  * Preview columns (`title`, `excerpt`, `preview_asset_id`, `preview_kind`, `subtype`) are denormalised only for fast
    lists. They are not authoritative.
* **Access**:
  * You can only reference what you can open right now; this is checked as the caller.
  * `visibility` can never be wider than the entity (`app.moment_entity_visibility` plus `app.visibility_rank` in the
    insert and update policies).
  * Only preview columns, `visibility`, `occurred_at` and `deleted_at` are updatable (column grants).
* **Keeping current** (security-definer triggers):
  * A new or changed Material or Creation gets or refreshes its Moment. This means no launch-blocking backfill: new
    and updated items come first, and older ones get a Moment the first time they're given a DejaVu (idempotent).
  * Making an entity more private narrows its Moments.
  * Deleting an entity deletes its Moments, which cascades to their DejaVu links and suggestions.
* **`dejavus`**: a generated `normalized_name` (lower-case, whitespace collapsed) that is unique per creator, so
  `Railways` and ` railways ` are one thread.
  * `last_used_at` is set by a trigger when a Moment is attached, and drives Recent.
  * Archive instead of delete (`archived_at`).
* **RLS**: everything is owner-only. Links need both the DejaVu and the Moment to be the caller's own. Tests are in
  `tests/db/moments-dejavu.test.ts`.

## Code

* **`@wonder/creator-moments`**:
  * `shared.ts`: vocabulary and pure helpers, safe in the browser.
  * `adapters.ts`: `MaterialMomentAdapter` and `CreationMomentAdapter`. They load previews as the caller, so the
    owning domain decides what exists.
  * `moments.ts`: `ensureMomentForEntity`, `getMoment(s)`, `refreshPreview` and `deleteMomentForEntity`, with keyset
    pagination over `(occurred_at desc, id desc)`. Every read is re-checked through the adapters, and a Moment whose
    entity is gone or out of reach is marked deleted and never returned.
  * `dejavus.ts`: create (prefers the existing one by normalised name, and brings back an archived one), rename (a
    taken name is refused, never merged), archive, search, recent, get (with per-type counts), Moments,
    add/remove/attach entity, and suggestions accept/dismiss.
* **API** (`withApi`):
  * `GET|POST /api/v1/moments`, `GET /api/v1/moments/:id`, `GET /api/v1/moments/:id/dejavus`, and
    `GET /api/v1/moments/by-entity`.
  * `GET /api/v1/moments/:id/dejavu-suggestions` and `POST …/:suggestionId/accept|dismiss`.
  * `GET|POST /api/v1/dejavus`, `GET|PATCH|DELETE (archive) /api/v1/dejavus/:id`, `GET|POST /api/v1/dejavus/:id/moments`,
    and `DELETE /api/v1/dejavus/:id/moments/:momentId`.
* **UI**:
  * **Chips** (`components/dejavu/dejavu-chips.tsx`) on Material and Creation pages: up to three show, the rest fold
    into `+N`, and there is a `+ DejaVu` button.
  * **Add a DejaVu** sheet:
    * Search existing first; Recent shows when the search is empty.
    * `Create "…"` appears only when nothing matches the normalised name.
    * Suggestions are labelled "Suggested by CreativeMind".
    * Every toggle is immediate and reversible.
  * **DejaVu page** (`/dejavu/:id`):
    * The name and "N Moments".
    * Type filters (All · Materials · Notes · Creations · Conversations), shown only for types present and only when
      there is more than one.
    * `Filter` for dates.
    * Sections Today / Yesterday / month / year, compact rows that open the entity's own page, and "Take off" with
      Undo.
    * "Show more" (no infinite scroll). More holds Rename, Archive / Bring back and All DejaVus.
  * **Index** (`/dejavu`): every DejaVu with its count.

## Not in this phase (spec §17)

Community UI, Open Conversations, Ask Community, Home ranking, automatic DejaVu surfacing, a Studio DejaVu browser,
popularity metrics, follows, and generating suggestions. Advanced filters beyond dates (person, Creative Room, used in
a Creation, source) wait for the adapters and Phase 03 data they need.
