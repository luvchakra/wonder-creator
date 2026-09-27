# Wonder Creator — Contextual Image Generation Implementation Specification

**Status:** Implementation-ready  
**Date:** 27 September 2026  
**Audience:** Claude Code / engineering / product / design  
**Scope:** AI-generated carousel images, contextual visual concepts, Creation imagery, and premium image generation  
**Primary provider:** Gemini  
**Architecture:** provider-neutral, server-side, cache-first

---

# 1. Goal

Wonder Creator should generate useful images **from the creator's actual context**, not from generic prompts.

Primary use cases:

```text
Contextual carousel concepts
Explore / inspiration imagery
Creation concept art
Material-derived visual suggestions
Transform previews
Mood / style boards
Hero artwork
Premium final imagery
```

The system should understand the current creative context:

```text
Creation
Materials
Creative Room
selected references
creator-provided style/mood
existing images
summaries
version context
```

and generate visually relevant images without repeatedly charging for identical context.

---

# 2. Product Principle

The system should behave like:

> **Context in → useful visual possibilities out**

not:

> **Prompt box → random image**

The creator should usually not need to write a detailed image-generation prompt.

CreativeMind should assemble the generation context from the current page and creative state.

---

# 3. Provider Strategy

Use a provider-neutral image generation interface.

Default provider:

```text
Gemini
```

Recommended quality routing:

```text
FAST / CAROUSEL / PREVIEW
→ gemini-3.1-flash-lite-image

DEFAULT CREATION IMAGE
→ gemini-3.1-flash-image

PREMIUM / HERO / FINAL
→ gemini-3-pro-image
```

Optional future fallback / alternate provider:

```text
OpenAI image generation
```

The application UI must not depend on provider-specific model names.

---

# 4. Environment Variables

Recommended:

```env
WONDERCREATOR_IMAGE_PROVIDER=gemini

GEMINI_API_KEY=

WONDERCREATOR_IMAGE_FAST_MODEL=gemini-3.1-flash-lite-image
WONDERCREATOR_IMAGE_DEFAULT_MODEL=gemini-3.1-flash-image
WONDERCREATOR_IMAGE_PREMIUM_MODEL=gemini-3-pro-image
```

Optional secondary provider:

```env
OPENAI_API_KEY=
WONDERCREATOR_IMAGE_SECONDARY_PROVIDER=openai
WONDERCREATOR_IMAGE_EDIT_MODEL=
```

Never expose provider API keys to the browser.

All calls must originate from server-side provider adapters.

---

# 5. Quality Intents

Expose product-level intents rather than model names.

```ts
type ImageQualityIntent =
  | "preview"
  | "standard"
  | "premium";
```

Routing:

```text
preview
→ fast / low-cost model

standard
→ default model

premium
→ highest-quality configured model
```

The user should see terms such as:

```text
Preview
Standard
High Quality
```

not provider/model identifiers.

---

# 6. Primary API

Create one high-level image generation interface.

```ts
generateContextImage({
  creatorId,
  context,
  purpose,
  references,
  aspectRatio,
  qualityIntent,
  count,
});
```

Recommended type:

```ts
type GenerateContextImageRequest = {
  creatorId: string;

  context: ImageGenerationContext;

  purpose:
    | "carousel"
    | "explore"
    | "creation"
    | "transform-preview"
    | "moodboard"
    | "hero"
    | "final";

  references?: ImageReference[];

  aspectRatio:
    | "1:1"
    | "4:5"
    | "3:2"
    | "16:9"
    | "9:16";

  qualityIntent:
    | "preview"
    | "standard"
    | "premium";

  count?: number;

  styleHint?: string | null;
};
```

---

# 7. Context Object

Suggested context:

```ts
type ImageGenerationContext = {
  creation?: {
    id: string;
    title?: string;
    type?: string;
    version?: number;
    summary?: string;
    description?: string;
    lifecycle?: string;
  };

  materials?: Array<{
    id: string;
    type:
      | "image"
      | "audio"
      | "video"
      | "note"
      | "document"
      | "link";

    title?: string;
    summary?: string;
    visualDescription?: string;
    assetUrl?: string;
    selected?: boolean;
  }>;

  room?: {
    id: string;
    summary?: string;
  };

  creativeIntent?: {
    mood?: string[];
    themes?: string[];
    style?: string[];
    palette?: string[];
    medium?: string;
    audience?: string;
  };

  currentPage?: string;
};
```

---

# 8. Context Assembly

Create:

```text
buildImageGenerationContext()
```

It should combine only relevant page/domain state.

Example:

```text
Current Creation:
"My Father's Railway Stories"

Context:
- summary of Dad voice note
- 3 selected scanned photographs
- nostalgic / warm mood
- current visual tone
- current Creation description
- requested carousel purpose
```

Do not send unrelated profile history.

Do not send all Materials in the creator account.

---

# 9. Prompt Assembly

The creator-facing UI should not expose a raw prompt by default.

Build prompts internally from:

```text
purpose
current Creation
selected Materials
existing summaries
mood/style
aspect ratio
reference images
brand-safe constraints
```

Example generated prompt:

```text
Create a cinematic visual concept for a personal documentary-style Creation.

Context:
- Story centers on a father's railway memories.
- Mood: nostalgic, intimate, warm.
- Reference material includes aged family photographs and railway imagery.
- Keep the visual human and editorial.
- Avoid embedded text.
- Maintain visual continuity with the supplied references.

Output purpose:
Contextual carousel concept.

Aspect ratio:
16:9.
```

---

# 10. Carousel Generation

Recommended carousel behavior:

```text
3–5 images
```

Default:

```text
4
```

Each carousel image should explore a **different direction**, not four near-duplicates.

Suggested concept variants:

```text
1. documentary realism
2. memory / atmospheric
3. editorial composition
4. symbolic / poetic
```

Do not hard-code these four labels in all use cases.

CreativeMind should derive concept directions from context.

---

# 11. Carousel Response

```ts
type CarouselResult = {
  generationId: string;

  concepts: Array<{
    id: string;
    imageUrl: string;
    thumbnailUrl: string;
    directionLabel?: string;
    rationale?: string;
    providerMetadata?: Record<string, unknown>;
  }>;

  cached: boolean;
};
```

Keep `rationale` short.

Example:

```text
Warm documentary direction using family-memory cues.
```

Do not expose internal prompts by default.

---

# 12. Do Not Regenerate on Every Page Open

This is mandatory.

Generation flow:

```text
build context
↓
create context hash
↓
check cache
↓
cache hit?
  yes → return images
  no  → generate
```

The same meaningful context should produce the same stored carousel until the context changes or the creator explicitly requests regeneration.

---

# 13. Context Hash

Recommended hash inputs:

```text
creator_id
purpose
Creation ID
Creation version
selected Material IDs
Material updated_at/version
style/mood values
aspect ratio
quality intent
provider routing version
prompt template version
```

Do not include volatile values that do not affect the image.

Example:

```ts
const hashInput = {
  creatorId,
  purpose,
  creationId,
  creationVersion,
  materialVersions,
  styleIntent,
  aspectRatio,
  qualityIntent,
  promptVersion: "v1",
  routingVersion: "v1",
};
```

Hash:

```text
SHA-256
```

---

# 14. Cache Key

Example:

```text
imagegen:
creator_123:
carousel:
creation_789:
v4:
16x9:
preview:
84bd21...
```

---

# 15. Cache Layers

Use multiple layers.

## Database metadata cache

Store:

```text
context_hash
generation_id
creator_id
purpose
entity_id
entity_version
provider
model
status
created_at
expires_at
```

## Object storage

Store generated image assets.

## CDN/browser

Use immutable versioned URLs where possible.

Example:

```text
generated/context/creator123/creation789/v4/84bd21/01.webp
```

---

# 16. Cache Lifetime

Suggested:

```text
carousel previews
→ keep until context hash changes

standard generated Creation images
→ persistent Creation asset

premium/final images
→ persistent Creation asset

failed generation metadata
→ short TTL, e.g. 5–15 min

in-progress job state
→ short-lived
```

Prefer event/context invalidation over time-only expiry.

---

# 17. Regeneration

Provide:

```text
Try another direction
```

or:

```text
Regenerate
```

This must deliberately bypass the previous generation cache.

Add a generation nonce:

```text
variation = 2
```

or:

```text
generationSeedVersion
```

Regeneration must create a new generation record rather than overwriting the previous one.

---

# 18. Visual Stability

The same carousel should remain visible when:

```text
user leaves and returns
page refreshes
app reloads
another device opens the same Creation
```

until:

```text
meaningful context changes
creator requests regeneration
generation is removed
```

This improves creative continuity.

---

# 19. Provider Interface

Recommended abstraction:

```ts
interface ImageProvider {
  generate(
    request: ProviderImageRequest
  ): Promise<ProviderImageResult>;

  edit?(
    request: ProviderImageEditRequest
  ): Promise<ProviderImageResult>;
}
```

Implement:

```text
GeminiImageProvider
OpenAIImageProvider (optional / future)
OfflineImageProvider
```

---

# 20. Provider Router

Suggested:

```ts
resolveImageModel({
  qualityIntent,
  purpose,
  referencesCount,
  requestedResolution,
});
```

Example:

```ts
if (qualityIntent === "preview") {
  return FAST_MODEL;
}

if (qualityIntent === "premium") {
  return PREMIUM_MODEL;
}

return DEFAULT_MODEL;
```

Do not scatter model routing across feature code.

---

# 21. CreativeMind Tool

Expose a governed CreativeMind tool:

```text
generate_context_image
```

Suggested tool input:

```ts
type GenerateContextImageToolInput = {
  creationId?: string;
  materialIds?: string[];
  purpose: string;
  aspectRatio: string;
  qualityIntent: string;
  count?: number;
};
```

The tool should:

```text
resolve creator
check access
load allowed context
build summaries
resolve rights/privacy constraints
generate or retrieve cached image
persist lineage
return generated asset references
```

AI must not bypass governance.

---

# 22. Image Generation Job Flow

Use asynchronous jobs for non-trivial generation.

```text
Client
↓
POST /api/v1/image-generations
↓
validate + authorize
↓
compute context hash
↓
cache lookup
↓
cache miss
↓
create generation job
↓
provider call
↓
store outputs
↓
update job
↓
client receives completion
```

---

# 23. API Endpoints

Suggested:

```text
POST /api/v1/image-generations
GET  /api/v1/image-generations/:id
POST /api/v1/image-generations/:id/regenerate
POST /api/v1/image-generations/:id/select
```

Optional:

```text
DELETE /api/v1/image-generations/:id
```

if generated previews may be removed.

---

# 24. Create Request

Example:

```json
{
  "creationId": "creation_123",
  "materialIds": ["mat_1", "mat_2"],
  "purpose": "carousel",
  "aspectRatio": "16:9",
  "qualityIntent": "preview",
  "count": 4
}
```

---

# 25. Create Response

Cache hit:

```json
{
  "generationId": "gen_123",
  "status": "complete",
  "cached": true,
  "assets": [...]
}
```

Cache miss:

```json
{
  "generationId": "gen_456",
  "status": "queued",
  "cached": false
}
```

---

# 26. Status Model

```text
queued
processing
complete
partial
failed
cancelled
```

Do not show provider internals to the user.

User-facing:

```text
Creating…
Ready
Couldn’t create this
```

---

# 27. Progress UI

Follow Wonder Creator's minimal-transition rule.

Do not use a large AI loading experience.

Preferred:

```text
Creating visual ideas…
```

with:
- compact skeleton;
- subtle progress;
- no animated assistant;
- no chat transcript.

When complete:

```text
crossfade skeleton → images
```

---

# 28. Page Integration — Home

Potential use:

```text
Current Creation
→ one subtle generated visual continuation card
```

Do not generate automatically on every Home visit.

Only show cached/generated content already relevant to active work.

---

# 29. Page Integration — Explore

This is the strongest carousel use case.

Example:

```text
Explore
→ "Ways this memory could become a Creation"
→ 4 generated visual directions
```

Generation should use current active Creation / selected Materials if available.

---

# 30. Page Integration — Material Detail

Example:

```text
Photo Material
→ Explore possibilities
→ contextual carousel
```

or:

```text
Voice Material
→ Visual directions from this memory
```

Do not auto-generate unless the feature explicitly calls for it.

---

# 31. Page Integration — Creation

Possible:

```text
Transform
→ visual concept previews
```

For a text/audio Creation:

```text
Visual directions
```

For an existing image Creation:

```text
Alternative treatments
```

Use references to preserve continuity.

---

# 32. Page Integration — Creative Studio

Use generation as an action, not permanent chrome.

Examples:

```text
Generate concept
Generate background
Explore visual direction
Create reference frame
```

Results enter the Creation as contextual Material or generated asset.

---

# 33. Page Integration — Transform

Before performing a high-cost full transformation:

```text
preview carousel
```

may show possible visual directions.

Use preview-tier generation.

User picks one.

Then:

```text
standard/premium generation
```

creates the full output.

---

# 34. Page Integration — Creative Room

Generated visuals may be:

```text
shared idea boards
reference directions
visual concepts
```

All collaborators must see the same cached generation.

Do not regenerate separately per collaborator.

---

# 35. Page Integration — Brand / Campaign

Generated campaign concepts must respect:

```text
campaign brief
rights
brand constraints
approved source Material
```

Do not automatically incorporate private Materials unrelated to the campaign.

---

# 36. Creation Lineage

Any generated image used in a Creation must record:

```text
source Creation
source version
source Materials
generation purpose
provider
model
prompt template version
generation timestamp
creator
```

Do not treat generated output as provenance-free.

---

# 37. Rights & Attribution

Store enough metadata to answer:

```text
What inputs contributed?
Which Creation/version generated this?
Was an external reference used?
Which model/provider generated it?
```

Do not display raw prompt internals unless useful.

Generated outputs should integrate with the existing rights/provenance system.

---

# 38. External Reference Images

When using user-provided visual references:

```text
check creator access
check material rights metadata
check allowed usage context
```

Do not use unrelated private Materials.

Do not silently reuse another collaborator's restricted Material.

---

# 39. Brand Assets

For Wonder Creator's own production UI artwork:

- use supplied brand assets;
- do not regenerate the Wonder Creator logo;
- do not replace approved botanical/palette artwork with generative approximations.

AI generation is for creator content and contextual experiences, not to silently overwrite official product branding.

---

# 40. Image Format

Store master generated output in a suitable high-quality format.

Serve optimized derivatives:

```text
AVIF
WebP
```

Use PNG only where transparency requires it.

Generate thumbnails at ingestion/storage time.

---

# 41. Responsive Derivatives

Recommended derivative widths:

```text
320
640
960
1280
1920
```

Only generate larger derivatives if source resolution supports it.

Do not upscale low-resolution generations unnecessarily.

---

# 42. Thumbnail Strategy

For carousels:

```text
mobile thumbnail ~320–480px
```

Do not download 2K/4K output just to show a 160px preview.

Use `srcset` / responsive image delivery.

---

# 43. Lazy Loading

Only load:
- first visible carousel image eagerly when needed;
- remaining images lazily.

Do not preload multiple premium images globally.

---

# 44. Storage Security

Generated assets inherit the privacy of their parent context.

Private Creation:

```text
private storage / signed delivery
```

Publicly published Creation:

```text
publication-specific public derivative
```

Do not make all generated assets globally public merely for CDN convenience.

---

# 45. Signed URLs

Private generated content should use signed URLs with expiration.

Do not store long-lived signed URLs in database rows as canonical asset identity.

Store object/storage key.

Generate signed URL at request time.

---

# 46. Database Schema

Suggested table:

```sql
create table image_generations (
  id uuid primary key,
  creator_id uuid not null,
  creation_id uuid null,
  purpose text not null,
  context_hash text not null,
  quality_intent text not null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  status text not null,
  requested_count integer not null,
  error_code text null,
  created_at timestamptz not null,
  completed_at timestamptz null
);
```

Generated assets:

```sql
create table image_generation_assets (
  id uuid primary key,
  generation_id uuid not null,
  storage_key text not null,
  width integer null,
  height integer null,
  mime_type text null,
  sequence integer not null,
  selected boolean not null default false,
  created_at timestamptz not null
);
```

Adjust to existing domain conventions rather than duplicating existing asset tables.

---

# 47. RLS

Every generation row must be creator-scoped.

Collaborators may access generated assets only through the same domain permissions that grant access to the parent Creation/Room.

UI visibility is not authorization.

Add DB/RLS tests.

---

# 48. Rate Limits

Image generation is cost-bearing.

Apply:
- per creator;
- per IP/session if relevant;
- per plan/tier;
- per endpoint.

Suggested conceptual limits:

```text
preview generation      higher allowance
standard generation     lower allowance
premium generation      strict allowance
```

Do not hard-code business limits into UI components.

---

# 49. Cost Governance

Track:

```text
provider
model
quality intent
purpose
image count
resolution
cached vs generated
latency
success/failure
```

Use this to understand:

```text
cost per active creator
cost per carousel
cache savings
regeneration rate
premium usage
```

---

# 50. Cache Savings Metric

Track:

```text
image_generation_cache_hit
```

This should become a primary cost-control metric.

Also track:

```text
image_generation_requested
image_generation_started
image_generation_completed
image_generation_failed
image_generation_regenerated
image_generation_selected
```

---

# 51. Prompt Versioning

Never silently change generation semantics without versioning.

Example:

```text
prompt_version = "context-image-v1"
```

When prompt logic changes materially:

```text
context-image-v2
```

Include version in context hash.

---

# 52. Routing Versioning

Also version provider routing:

```text
routing_version = "image-router-v1"
```

If model assignment changes, existing cached generations remain valid, but new requests can intentionally use the new routing behavior.

---

# 53. Failure Strategy

If premium generation fails:

```text
do not silently downgrade
```

unless product explicitly allows fallback.

Better:

```text
Couldn't create the high-quality version.
Try again
```

For preview carousel, a configured lower-tier fallback may be acceptable if clearly part of provider routing.

---

# 54. Partial Success

If 4 carousel images requested and only 3 succeed:

```text
status = partial
```

Show the 3 useful images.

Offer:

```text
Create one more
```

Do not discard all successful output.

---

# 55. Provider Unavailable

If provider is not configured:

User state:

```text
Image generation isn't connected
```

Do not fake generated images.

Do not silently use unrelated stock images as generated output.

---

# 56. Moderation / Safety

Apply provider safety controls and Wonder Creator's own safety policy.

Do not write unsafe content to permanent storage if generation is rejected/blocked.

Store only minimal error metadata.

---

# 57. Prompt Injection

External Material text is untrusted.

Never allow uploaded documents/web content to alter system instructions.

Use fenced summaries / structured fields.

Do not concatenate raw external text into system-level provider instructions.

---

# 58. Data Minimization

Send only what the model needs.

Example:

Bad:

```text
entire account history
all Materials
all collaborator messages
```

Good:

```text
current Creation summary
3 selected Material summaries
2 reference images
requested mood/style
```

---

# 59. Cancellation

If provider/API supports cancellation:

```text
allow cancel while queued/processing
```

If not:

```text
mark client job ignored/cancelled
discard or retain completed asset according to storage policy
```

Do not promise provider-side cancellation if unsupported.

---

# 60. Regenerate vs Refine

Separate:

```text
Regenerate
→ new variation from same context

Refine
→ change explicit direction/context and generate
```

This distinction helps lineage and caching.

---

# 61. User Selection

When a carousel concept is selected:

```text
mark selected
```

Then offer contextually:

```text
Use in Creation
Develop this
Make high quality
Create another variation
```

Keep visible buttons minimal and move secondary choices to Palette/More.

---

# 62. Upgrade Path

Typical:

```text
preview carousel
↓
creator selects concept
↓
standard generation
↓
creator refines
↓
premium generation if requested
```

Do not generate premium images before the user has expressed enough intent.

---

# 63. Image Editing

Design the provider abstraction to support future editing.

Examples:

```text
remove background
change mood
replace object
extend frame
keep subject, alter environment
```

Editing should use the existing image as a reference and preserve lineage.

---

# 64. Generated Asset as Material

A generated image may be saved as a Creative Material.

Record:

```text
origin = generated
generation_id
source Creation
source Materials
provider metadata
```

Then it can participate in future context like any other Material.

---

# 65. Generated Asset as Creation

If the image itself becomes a finished creative object:

```text
promote/save as Creation
```

Record lineage from generation + source context.

---

# 66. Background Generation Jobs

Use job queue semantics if the existing architecture already has a queue.

Do not block long server requests unnecessarily.

Generation jobs should be idempotent by:

```text
context_hash
purpose
quality intent
variation id
```

---

# 67. Idempotency

Support an idempotency key on generation requests.

This prevents duplicate charges when:
- user double taps;
- network retries;
- client reconnects.

---

# 68. Request Dedupe

If an equivalent job is already:

```text
queued
processing
```

return the existing job instead of starting a second one.

---

# 69. Loading UI

Carousel while generating:

```text
4 compact skeleton cards
```

Text:

```text
Creating visual directions…
```

Avoid:
- fake progress;
- rotating AI slogans;
- assistant animations;
- full-screen takeover.

---

# 70. Completion UI

When ready:

```text
simple crossfade
120–160ms
```

No staggered card entrance animation.

This follows the Wonder Creator minimal-transition rule.

---

# 71. Error UI

Example:

```text
Couldn't create visual directions.

Try again
```

Optional details under More.

Do not show raw provider errors.

---

# 72. Empty State

If no useful context exists:

```text
Add a Material or describe the idea first
```

Do not generate random images with weak context merely to fill the UI.

---

# 73. Quality Choice UI

Do not force quality selection every time.

Defaults:

```text
carousel / explore
→ preview

normal Creation generation
→ standard

explicit Final / High Quality
→ premium
```

Only expose quality choice when it helps.

---

# 74. Aspect Ratio Defaults

Suggested:

```text
carousel concept      16:9 or 4:5 depending component
Creation image        based on Creation format
social derivative     based on destination
hero                  16:9
portrait story        9:16
square listing        1:1
```

The product should choose sensible defaults contextually.

---

# 75. Model-Specific Logic

Keep provider quirks inside adapters.

Feature code should not contain:

```text
if Gemini...
if OpenAI...
```

except provider-level configuration.

---

# 76. Testing — Unit

Test:

```text
quality router
context hash
prompt assembly
cache hit
cache miss
regeneration nonce
idempotency
provider failure
partial generation
rights filtering
permission filtering
prompt validation
```

---

# 77. Testing — Integration

Test:

```text
Creation → carousel generation
Material → contextual generation
Explore → cache reuse
same context → same cached generation
version change → cache invalidation
regenerate → new generation
private asset → signed URL
collaborator access
unauthorized access rejection
provider unavailable
```

---

# 78. Testing — E2E

Minimum flows:

```text
Explore → Generate carousel → Select concept
Creation → Transform preview → Select → Generate standard image
Material → Explore possibilities → Save generated image as Material
Creation → Generate high-quality final
Refresh → cached carousel remains
Second collaborator → sees same carousel
Regenerate → new carousel appears
```

---

# 79. Performance Acceptance

Targets:

```text
cache hit UI response
→ near immediate

generation request enqueue
→ <500ms server response target where practical

image loading
→ responsive derivative, lazy loaded

page render
→ never blocked by generation
```

Provider latency is external and should not block navigation.

---

# 80. Security Acceptance

```text
[ ] Provider key never reaches browser
[ ] RLS on generation metadata
[ ] Signed delivery for private assets
[ ] Access checked against parent Creation/Room
[ ] External text fenced / sanitized
[ ] No private unrelated context sent
[ ] No fake provider output
[ ] Audit event for generated persistent assets
```

---

# 81. Product Acceptance

```text
[ ] Carousels are contextually relevant
[ ] Same context does not regenerate automatically
[ ] User can regenerate explicitly
[ ] Preview generation uses low-cost tier
[ ] Standard/premium generation is intentional
[ ] Generated assets retain lineage
[ ] UI remains compact
[ ] No chat UI introduced
[ ] No excessive transitions
[ ] Visual suggestions remain stable across reloads
```

---

# 82. Suggested Implementation Order

```text
Phase 1
Provider abstraction + Gemini adapter

Phase 2
Context builder + prompt builder

Phase 3
Generation tables/storage + RLS

Phase 4
Context hash + cache

Phase 5
Generation API + job lifecycle

Phase 6
Explore carousel

Phase 7
Material Detail contextual carousel

Phase 8
Creation / Transform integration

Phase 9
Save generated output as Material/Creation

Phase 10
Premium generation + provider fallback

Phase 11
Cost telemetry + optimization
```

---

# 83. CLAUDE.md Standing Instruction

Add:

```md
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

---

# 84. Final Architecture

```text
CREATOR CONTEXT
Creation
Materials
References
Mood
Style
       ↓
CONTEXT BUILDER
       ↓
CONTEXT HASH
       ↓
CACHE
   ↙       ↘
HIT       MISS
 ↓          ↓
Return      IMAGE ROUTER
cached      ↓
images      PROVIDER
            ↓
          STORE
            ↓
         LINEAGE
            ↓
        RETURN UI
```

---

# 85. Final Product Rule

The image system should feel like:

> **Wonder Creator understands my work and gives me visual possibilities that belong to it.**

not:

> **Wonder Creator has an image generator.**

The implementation rule is:

> **Generate only when context is meaningful, cache aggressively, preserve creative continuity, and spend premium generation only after the creator shows intent.**

---

# Implementation notes (phases 10–11)

## High quality version (phase 10, §53, §62)

* Asked for, never automatic: the chosen image's More menu → **High quality version**
  (`POST /api/v1/image-generations/:id/assets/:assetId/upgrade`, premium hourly budget).
* It is an `upgrade` change (`image_asset_revisions.kind`) on the premium tier's model. The chosen image goes to the
  model as the reference, with the instruction to keep its subject, composition, palette and mood. The new image takes
  the old one's place, and the old one stays in history (`replaced_by`). The new image records `quality_intent = premium`.
* An image that is already high quality is returned as it is, and the same idempotency key returns the same change.
* A failure says "Couldn't create the high-quality version" and offers Try again. It never falls back to a lower tier.
* Provider fallback (a secondary provider such as OpenAI) is not built. It needs an owner decision and a key, and
  "no fake providers" rules out a placeholder. The provider interface already keeps provider quirks in adapters, so a
  second adapter plugs into `selectImageProvider`.

## Cost telemetry (phase 11, §49–50)

* `image_generations.cache_hits` / `last_cache_hit_at` count each time a stored generation is served instead of
  generated (`image_generation_cache_hit`, service role only).
* Each change records the model and tier it actually ran on, plus its latency (`image_asset_revisions.model`,
  `quality_intent`, `latency_ms`).
* `app.image_generation_daily_costs` has one row per day × provider × model × tier × purpose × source, where source is
  `generation` or `change:<kind>`. Its columns are requests, regenerations, images requested and made, failed, partial,
  cache hits, average latency and distinct creators. It holds counts and timings only: no prompts, context,
  instructions or creator ids. It lives in the `app` schema (not exposed by the API) and only the service role can read
  it:

```sql
select day, quality_intent, purpose, source, requests, images_made, cache_hits, failed, avg_latency_ms, creators
from app.image_generation_daily_costs where day > current_date - 30 order by day desc;
```
