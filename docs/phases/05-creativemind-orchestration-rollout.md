# Wonder Creator — Phase 05
## CreativeMind Orchestration, Ranking, Safety, Quality & Rollout

**Sequence:** 5 of 5  
**Depends on:** Phases 01–04  
**Purpose:** Make the system feel coherent, intelligent, calm, and useful without turning CreativeMind into a chat destination.

---

## 1. Goal

Use CreativeMind to quietly connect:

- Home
- Moments
- DejaVu
- Community
- Open Conversations
- Huddles
- CreativeStudio
- Working Table
- Creations
- People
- Projects / Creative Rooms

CreativeMind should find relationships, summarize, rank, suggest, explain relevance, and reduce search effort.

CreativeMind should **not** silently reorganize the user's world, infer legal rights, publish without approval, become a persistent chat panel, maximize engagement/time spent, or override deterministic operational truth.

---

## 2. Intelligence boundaries

### Deterministic truth always wins for

- errors
- offline/sync
- publishing
- external operations
- rights
- licensing
- attribution requirements
- permissions
- approvals
- finance
- live Huddle state
- exact counts
- exact dates
- processing progress

### CreativeMind may assist with

- relationship discovery
- semantic grouping
- DejaVu suggestions
- summarization
- relevance ranking
- creative-role suggestion
- Community opportunity matching
- wording of non-critical Context Lines
- source connection suggestions
- `A little spark`
- `Your world is connecting`

---

## 3. Home orchestration

Phase 02 defined the ranking contract.

CreativeMind now improves candidate quality.

Priority remains:

1. requires decision
2. active work change
3. collaborator response
4. completed output
5. strong Moment connection
6. relevant public conversation
7. help opportunity
8. relevant Huddle
9. meaningful memory / DejaVu
10. generic activity

AI may rank within categories but should not demote critical deterministic states.

---

## 4. Home card budget

Home should remain small.

Recommended final cap:

```text
1 primary Continue card
2 Quick Capture actions
3–5 contextual cards
```

Not every category appears.

CreativeMind should optimize for:

```text
usefulness
novelty
emotional value
continuation value
human connection
diversity of purpose
```

not:

```text
click probability
time spent
engagement score
```

---

## 5. `Your world is connecting`

Build a semantic connection service over Moments.

Possible evidence:

- same DejaVu;
- recurring person;
- recurring place;
- semantic similarity;
- same emotion/theme;
- used together before;
- same Project but never combined;
- voice note + photo describing same event;
- unfinished Creation + recently captured note.

Suggested result shape:

```ts
interface MomentConnection {
  id: string;
  creatorId: string;
  momentIds: string[];
  connectionType:
    | "shared_theme"
    | "shared_person"
    | "shared_place"
    | "same_memory"
    | "creative_opportunity"
    | "unused_pairing";
  shortExplanation: string;
  confidenceInternal: number;
  createdAt: string;
  expiresAt?: string;
}
```

Do not expose percentage confidence.

Example UI:

```text
Your voice note from March
and these two photographs
seem to describe the same memory.
```

---

## 6. DejaVu suggestions

CreativeMind can propose:

- attach Moment to an existing DejaVu;
- create a new DejaVu.

Example:

```text
Suggested DejaVu
Dad   Railways   Childhood
```

Rules:

- no silent attachment;
- suggestions can be dismissed;
- dismissed suggestions should reduce repetition;
- user-created DejaVus get preference;
- avoid flooding user with generic tags;
- prefer human concepts over metadata.

Good:

```text
Dad
Railways
Waiting
Things We Almost Forgot
```

Weak:

```text
Photo
Blue
Tuesday
Content
```

unless genuinely useful.

---

## 7. Community relevance

CreativeMind may surface relevance based on:

- current Creation;
- Working Set;
- explicit DejaVus;
- Projects;
- collaborators;
- user's `Open to…` choices;
- saved Community topics;
- recent questions.

Human-readable explanations:

```text
Related to your carousel
You have Material that may help
You worked with Maya before
Related to your current film
```

Never show percentage matches or “people like you” explanations.

---

## 8. `You could help` matching

Goal:

> Find situations where the user may genuinely contribute.

Potential matches:

- someone requests a reference matching user's Material;
- critique request overlaps user's experience;
- collaborator asks for feedback;
- Huddle topic overlaps active DejaVu/Project;
- open collaboration matches explicit `Open to…`.

Rules:

- do not infer private traits;
- do not expose private Material automatically;
- say `You have 2 Materials that may help`, not show them publicly;
- user decides what to share.

---

## 9. Conversation summaries

For long Open Conversations:

```text
Conversation so far

Most creators separate narrative text from captions.
Several prefer 4–6 slides.
A smaller discussion formed around typography.
```

Rules:

- summarize viewpoints;
- preserve disagreement;
- do not declare a creative winner;
- link summary points back to source replies where possible;
- regenerate when enough new replies arrive;
- mark stale summary if source changed significantly.

Returning user:

```text
Since you last read this
8 new replies · 2 new ideas
```

---

## 10. Community reply triage for Studio

When replies return to Ask Community, CreativeMind may group them:

```text
2 suggest shortening the line
3 prefer the current version
1 suggests removing text entirely
1 discusses image choice
```

Do not auto-apply.

Offer:

```text
View replies
Use idea in Studio
```

Any applied feedback becomes a source/reference with lineage.

---

## 11. Source relationship suggestions in CreativeStudio

When 2+ sources are selected:

```text
Use together
```

CreativeMind may propose one concise possibility:

```text
Could become a visual spoken-word piece.
```

No chat transcript.
No list of 12 ideas.
One high-value possibility at a time.

---

## 12. Source-role suggestions

CreativeMind can suggest:

```text
Story
Visual
Mood
Reference
Fact
Voice
Style
Constraint
Character
Structure
Sound
Quote
Feedback
Creative direction
```

User can correct.

Never suggest legal states such as ownership or permission.

---

## 13. Adaptive Context Line

Use hybrid deterministic + AI behavior.

Priority:

```text
critical error
offline
consequential external operation
live
pending/blocking
processing/save
AI creative context
lifecycle
presence
metadata
```

Examples:

```text
Offline · saved locally
Publishing to Instagram…
Maya is editing
3 selected
A new connection was found
Railways surfaced again
```

AI Context Line requirements:

- 2–7 words target;
- max 56 chars;
- no first-person assistant voice;
- no `I found…`;
- no opening chat;
- no spinner;
- deterministic fallback immediately;
- AI update may replace fallback asynchronously only if still relevant.

---

## 14. AI caching

Context Line and semantic suggestions should use context signatures.

Example inputs:

```text
creatorId
page
entityId
entityVersion
selectedFragmentId
sourceSetHash
homeCandidateSetHash
```

Rules:

- cache reusable phrasing;
- discard stale AI results;
- never let slow AI overwrite newer deterministic state;
- no AI request for every keystroke.

---

## 15. Provenance and explainability

For semantic suggestions, retain enough evidence to answer:

```text
Why am I seeing this?
```

Examples:

```text
Because both Moments are tagged Railways.
Because this conversation discusses carousel captions.
Because Priya requested a visual reference and you have two Materials tagged Waiting.
```

Do not expose hidden embeddings or raw model reasoning.

---

## 16. Privacy

Requirements:

- no publicizing private Moment content;
- no using private source text in Community previews;
- Ask Community shares only selected excerpt;
- Community matching reveals that relevant private Material exists, not its content;
- DejaVu names are private by default;
- AI processing follows existing model/provider privacy boundaries.

---

## 17. Rights

CreativeMind must not infer:

- ownership;
- license;
- attribution waiver;
- consent;
- public-domain status;
- commercial reuse permission.

Those are deterministic.

AI may suggest `Use as reference` even when reuse is unknown, but inserting into a final artifact must pass rights checks.

---

## 18. Quality controls

### Suggestions

Measure:

- accepted;
- dismissed;
- ignored;
- reopened;
- later used in Studio.

Do not optimize only for acceptance rate.

### Home

Measure:

- resumed Creation;
- captured note;
- opened meaningful connection;
- joined useful Huddle;
- helped someone;
- entered Studio.

Avoid `time on Home` as a success metric.

### Community

Measure:

- constructive replies;
- useful saves;
- Studio uses;
- Huddle conversions;
- collaboration starts.

Avoid raw engagement maximization.

---

## 19. Feature flags

Recommended flags:

```text
moments_enabled
dejavu_enabled
dejavu_ai_suggestions_enabled
home_orchestration_enabled
quick_capture_voice_enabled
community_enabled
open_conversations_enabled
community_home_cards_enabled
community_to_studio_enabled
ask_community_enabled
external_image_sources_enabled
semantic_connections_enabled
conversation_summaries_enabled
```

Roll out progressively.

---

## 20. Rollout order

### Stage A — internal/dev

- Moments
- DejaVu
- Quick Capture
- Home modes

### Stage B — small beta

- Community
- Open Conversations
- basic Home Community cards

### Stage C — expanded beta

- Community → Studio
- Ask Community
- royalty-free external sources

### Stage D — AI enhancement

- semantic Moment connections
- DejaVu suggestions
- Community relevance
- summaries

### Stage E — general availability

after moderation, privacy, rights, and abuse systems are stable.

---

## 21. Moderation and abuse quality gate

Community GA should require:

- report handling;
- block/mute;
- spam controls;
- rate limits;
- moderator tools;
- deletion workflows;
- audit trail;
- abuse testing;
- age/eligibility policy integration if relevant to the product.

Do not widely launch public conversations before this gate.

---

## 22. Performance targets

Keep the experience calm and fast.

- Home deterministic shell: immediate from cache when possible.
- Quick note save: perceived instant.
- Voice recording start: near-instant after permission.
- Working Table open: no AI dependency.
- DejaVu page first result: database/API path only.
- CreativeMind suggestions: async enhancement.
- Community basic list: no summarization dependency.

AI failure must degrade gracefully.

---

## 23. Final cross-product UX rules

1. No bottom nav.
2. One dominant action per normal mobile screen.
3. 0–2 visible secondary actions.
4. Use Palette / More for rare actions.
5. Context Line tells what matters; Palette tells what can be done.
6. Canvas remains dominant in CreativeStudio.
7. Sources collapse when not needed.
8. Community is not an infinite attention feed.
9. DejaVu is associative memory, not a folder.
10. Moment is a presentation/reference abstraction, not a backend rename.
11. CreativeMind stays quiet unless it adds value.
12. Deterministic truth overrides AI phrasing.

---

## 24. End-to-end acceptance scenarios

### Scenario A — Capture → DejaVu → Studio

1. User records voice note.
2. Voice note saves immediately.
3. Moment created.
4. CreativeMind suggests `Railways`.
5. User accepts.
6. Later opens `Railways`.
7. Filters to Voice.
8. Opens note.
9. Taps `Explore in Studio`.
10. Source appears Available on Working Table.

### Scenario B — Community → Help → Collaboration

1. Priya creates Looking For conversation.
2. Community surfaces it to Kunal.
3. Home says `You could help`.
4. Kunal sees two private Materials may fit.
5. Kunal explicitly chooses one to share.
6. Conversation becomes Huddle.
7. Huddle becomes Creative Room.
8. Resulting Creation retains lineage.

### Scenario C — Ask Community

1. User selects Carousel slide 3.
2. Taps Ask Community.
3. Only slide 3 excerpt is shared.
4. Replies arrive.
5. Studio shows `7 community responses`.
6. User chooses one reply.
7. Adds it as creative direction.
8. Refines text.
9. New Creation version records lineage.

### Scenario D — Quiet Home

1. No important changes.
2. Home shows Continue + Quick Capture.
3. Context Line says `Nothing urgent`.
4. One optional Spark appears.
5. No fake activity.

---

## 25. Final product model

```text
Home
  = what matters now

Quick Capture
  = preserve before it disappears

Moments
  = meaningful things across the system

DejaVu
  = recurring threads connecting Moments

Materials
  = creative fuel

CreativeStudio
  = where ingredients combine

Working Table
  = temporary source surface

Creations
  = things intentionally made

Scrapbook
  = reflections and shared thoughts

People
  = relationships

Community
  = creative exchange layer

Open Conversations
  = public asynchronous discussion

Huddles
  = live discussion

Creative Rooms / Projects
  = making together

CreativeMind
  = intelligence connecting all of it
```

Final conceptual line:

> Life creates Moments.  
> Quick Capture preserves them.  
> DejaVu connects them.  
> Home tells you which ones matter now.  
> CreativeStudio transforms them.  
> Creations give them new form.  
> Community lets Moments move between people.  
> Conversations let people think together.  
> Huddles let them talk together.  
> Creative Rooms let them make together.  
> CreativeMind quietly connects the whole system.

---

## 26. Definition of done for the 5-phase program

- [ ] Moments span major Wonder Creator domains.
- [ ] DejaVu works across mixed Moment types.
- [ ] Quick text and voice capture work.
- [ ] Home supports Active / Return / Quiet modes.
- [ ] Community exists without creating duplicate social objects.
- [ ] Open Conversations work.
- [ ] Community → Huddle → Creative Room flow works.
- [ ] Community items can enter CreativeStudio.
- [ ] DejaVu can feed the Working Table.
- [ ] Ask Community works from selected Creation fragments.
- [ ] Working Table remains collapsible and uncluttered.
- [ ] Carousel supports reorder, text refinement, and add-one-more.
- [ ] External royalty-free image sources are provider-neutral and provenance-aware.
- [ ] CreativeMind suggestions are asynchronous and optional.
- [ ] Rights, privacy, moderation, and permissions are deterministic and enforced.
- [ ] Home remains calm and does not become a feed.
