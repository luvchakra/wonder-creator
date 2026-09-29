# Wonder Creator — Phase 01
## Moments + DejaVu Foundation

**Sequence:** 1 of 5  
**Depends on:** Existing Wonder Creator domain entities and current `main`  
**Blocks:** Home orchestration, Quick Capture intelligence, Community aggregation, CreativeStudio cross-domain sourcing

---

## 1. Goal

Introduce two cross-product concepts without replacing or duplicating existing domain models:

- **Moment** — a common presentation/reference layer for meaningful entities across Wonder Creator.
- **DejaVu** — a lightweight associative tagging layer that connects Moments across time, projects, people, materials, conversations, and creations.

The implementation must preserve domain ownership:

- `Material` remains a Material.
- `Creation` remains a Creation.
- `Huddle` remains a Huddle.
- `Conversation` remains a Conversation.
- `Project` / `CreativeRoom` remains owned by its existing domain.
- Community later reads these entities through Moment references; it does not clone them.

Do **not** perform a broad rename of existing backend entities to `Moment`.

---

## 2. Product language

### Moment

> Everything meaningful in Wonder Creator can appear as a Moment.

Examples: quick text note, voice note, Material, photo/video, Scrapbook entry, Creation, Creation fragment, Open Conversation, Community reply, Huddle, Huddle highlight, collaboration request, Project/Creative Room activity, public reference, published work.

A Moment is a **cross-domain reference + shared preview contract**, not the canonical domain object.

### DejaVu

> DejaVu represents recurring threads connecting Moments.

Examples: `Dad`, `Railways`, `Waiting`, `Childhood`, `Mumbai Monsoon`, `Things We Almost Forgot`, `Carousel ideas`, `Visual storytelling`.

A Moment may have zero, one, or many DejaVus.

---

## 3. Architecture principles

1. Existing domain tables/services remain authoritative.
2. Moment references should be cheap to create, query, and delete.
3. DejaVu should work across domain boundaries.
4. Public/community Moments must retain provenance and rights metadata.
5. CreativeMind suggestions must not silently organize a user's content.
6. User-created DejaVu relationships and AI-suggested relationships must be distinguishable.
7. DejaVu is **not** a Collection and **not** a Project.
8. Moment preview data should be denormalized only enough to make cross-domain lists fast.
9. Deleting a domain object must invalidate or delete its Moment reference safely.
10. DejaVu must be usable incrementally; existing content does not need full backfill before launch.

---

## 4. Suggested data model

Adapt naming to existing codebase conventions.

### `moment_reference`

```ts
type MomentEntityType =
  | "material"
  | "creation"
  | "creation_fragment"
  | "scrapbook_entry"
  | "conversation"
  | "conversation_reply"
  | "huddle"
  | "huddle_moment"
  | "person_interaction"
  | "collaboration_request"
  | "project_activity"
  | "creative_room_activity"
  | "published_work"
  | "quick_text_note"
  | "voice_note";

interface MomentReference {
  id: string;
  creatorId: string;
  entityType: MomentEntityType;
  entityId: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  visibility: "private" | "shared" | "community" | "public";
  title?: string;
  excerpt?: string;
  previewAssetId?: string;
  previewKind?: "text" | "image" | "audio" | "video" | "mixed";
  sourceCreatorId?: string;
  sourceUrl?: string;
  rightsState?: string;
  attributionRequired?: boolean;
  deletedAt?: string | null;
}
```

Preview metadata is not authoritative; it supports fast cross-domain browsing.

### `dejavu`

```ts
interface DejaVu {
  id: string;
  creatorId: string;
  name: string;
  normalizedName: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}
```

### `dejavu_moment`

```ts
interface DejaVuMoment {
  id: string;
  dejavuId: string;
  momentId: string;
  addedByUserId?: string;
  source: "user" | "creativemind_suggestion_accepted" | "migration";
  createdAt: string;
}
```

### Optional `dejavu_suggestion`

Keep AI suggestions separate until accepted.

```ts
interface DejaVuSuggestion {
  id: string;
  creatorId: string;
  momentId: string;
  suggestedExistingDejaVuId?: string;
  suggestedName?: string;
  confidence?: number; // internal only
  rationale?: string;
  status: "pending" | "accepted" | "dismissed";
  createdAt: string;
  resolvedAt?: string;
}
```

---

## 5. DejaVu vs existing concepts

### Collection

> I intentionally collected these things together.

Curated and explicit. Example: `Film References`.

### DejaVu

> These things share a recurring person, place, idea, feeling, memory, or creative thread.

Example: `Railways`, `Waiting`, `Night`.

A Material can belong to Collection `Film References` and also carry DejaVus `Railways`, `Waiting`.

### Project / Creative Room

> We are intentionally making something.

A Project has goals, state, participants, tasks, and deliverables. A DejaVu can span many Projects over many years.

---

## 6. Moment service

Implement a shared Moment service with domain adapters.

```ts
interface MomentService {
  ensureMomentForEntity(input: {
    entityType: MomentEntityType;
    entityId: string;
    creatorId: string;
  }): Promise<MomentReference>;

  getMoment(id: string): Promise<MomentReference | null>;

  getMoments(input: {
    creatorId: string;
    entityTypes?: MomentEntityType[];
    visibility?: string[];
    personId?: string;
    projectId?: string;
    usedInCreation?: boolean;
    dateFrom?: string;
    dateTo?: string;
    cursor?: string;
    limit?: number;
  }): Promise<Paginated<MomentReference>>;

  refreshPreview(momentId: string): Promise<void>;
  deleteMomentForEntity(entityType: MomentEntityType, entityId: string): Promise<void>;
}
```

Use domain adapters such as `MaterialMomentAdapter`, `CreationMomentAdapter`, `HuddleMomentAdapter`, `ScrapbookMomentAdapter`, and `ConversationMomentAdapter` instead of putting domain-specific logic into the Moment service.

---

## 7. DejaVu service

Required operations:

```text
createDejaVu
renameDejaVu
archiveDejaVu
searchDejaVus
getRecentDejaVus
getDejaVu
getDejaVuMoments
addMomentToDejaVu
removeMomentFromDejaVu
```

Support normalized duplicate detection. Creating `Railways` when `railways` exists should prefer the existing DejaVu.

---

## 8. Suggested API surface

```text
GET    /moments
GET    /moments/:momentId

GET    /dejavus
POST   /dejavus
GET    /dejavus/:dejavuId
PATCH  /dejavus/:dejavuId
DELETE /dejavus/:dejavuId

GET    /dejavus/:dejavuId/moments
POST   /dejavus/:dejavuId/moments
DELETE /dejavus/:dejavuId/moments/:momentId

GET    /moments/:momentId/dejavus
GET    /moments/:momentId/dejavu-suggestions
POST   /moments/:momentId/dejavu-suggestions/:suggestionId/accept
POST   /moments/:momentId/dejavu-suggestions/:suggestionId/dismiss
```

Prefer archive over destructive delete where consistent with the repo.

---

## 9. DejaVu page

Tapping a DejaVu chip anywhere opens one predictable destination.

```text
Railways
23 Moments

[ All ] [ Materials ] [ Notes ] [ Creations ] [ Conversations ]

Today
  Voice note — Dad's railway story
  Creation — A Life in Moments

September
  Material — CST platform
  Conversation — Why stations make good storytelling spaces

2019
  Material — Empty platform
```

Rules:

- V1 sort may be reverse chronological.
- Show type filters only for types present.
- Keep first-level filters compact.
- Put advanced filters behind `Filter`.
- No dashboard charts.
- Do not show every metadata field on cards.

Advanced filter options: type, date range, mine/community, person, Project/Creative Room, used in Creation, unused, public/private, source.

---

## 10. DejaVu chips

Any Moment-capable card may display DejaVu chips.

```text
🎙 Dad's railway story
Voice note · 2:14 · Today

[ waveform ]

Dad   Railways   Childhood
```

Behavior:

- Tap chip → open DejaVu.
- `+ DejaVu` opens add/search sheet.
- Show max 2–3 chips inline.
- Additional chips collapse into `+2`.

---

## 11. Add DejaVu sheet

```text
Add a DejaVu

[ Search or type… ]

Recent
Dad
Railways
Childhood
Waiting

Suggested
Family stories
Train journeys
```

Rules:

- Search existing first.
- Typing a new value offers `Create "..."`.
- Suggestions are clearly suggestions.
- Never auto-attach AI suggestions.
- Attaching is immediately reversible.

---

## 12. Backfill strategy

Do not block launch on full historical backfill.

Recommended order:

1. New Quick Capture items.
2. New/updated Materials.
3. New/updated Creations.
4. Scrapbook entries.
5. Huddles.
6. Community/Open Conversation entities when Phase 03 lands.
7. Background historical backfill later.

Use idempotent jobs.

---

## 13. Permissions and privacy

A Moment reference must never widen access.

> Moment visibility can be equal to or more restrictive than the underlying entity, never less restrictive.

DejaVu pages must filter inaccessible Moments server-side.

If a public/community Moment becomes private or is deleted, update/invalidate visibility and remove it from unauthorized DejaVu results.

---

## 14. UI style requirements

Follow current Wonder Creator rules:

- compact mobile-first layout;
- no bottom navigation;
- no oversized section headers;
- one dominant action max;
- secondary actions in Palette / More / sheets;
- section spacing 12–16px;
- card padding 8–12px;
- minimum 44×44 hit targets;
- avoid decorative transitions;
- no infinite-scroll behavior as a product mechanic.

---

## 15. Tests

### Unit

- Moment creation is idempotent.
- Moment reference does not duplicate canonical entities.
- DejaVu normalized duplicate handling.
- Add/remove Moment to DejaVu.
- Suggestion acceptance/dismissal.
- Permission propagation.
- Deleted entity invalidation.

### Integration

- Material → Moment → DejaVu.
- Creation → Moment → DejaVu.
- Unauthorized user cannot see shared DejaVu Moment.
- Filter by entity type.
- Pagination stable across mixed entity types.

### UI

- Add existing DejaVu.
- Create new DejaVu.
- Tap chip opens DejaVu.
- Filter types.
- Empty DejaVu state.
- DejaVu with only one type.
- Removed/deleted Moment disappears safely.

---

## 16. Acceptance criteria

Phase 01 is complete when:

- [ ] Moment reference model exists.
- [ ] At least Material and Creation integrate with it.
- [ ] DejaVu CRUD exists.
- [ ] A Moment can be added to multiple DejaVus.
- [ ] DejaVu page aggregates mixed entity types.
- [ ] Type filters work.
- [ ] `+ DejaVu` works from at least Material and Creation.
- [ ] Permission boundaries are enforced server-side.
- [ ] AI suggestions are structurally supported but need not be generated yet.
- [ ] No existing domain model has been replaced by Moment.

---

## 17. Do not do in this phase

Do not yet build full Community UI, public Open Conversations, Ask Community, Home orchestration ranking, automatic DejaVu surfacing, CreativeStudio full DejaVu browser, popularity metrics, or social follows.

---

## 18. Handoff to Phase 02

Phase 02 assumes any Quick Capture item can produce a Moment, DejaVu chips can appear on Moment-capable cards, DejaVu pages exist, and Home can query mixed Moment summaries safely.
