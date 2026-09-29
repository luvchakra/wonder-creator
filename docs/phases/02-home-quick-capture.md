# Wonder Creator — Phase 02
## Home Orchestration + Quick Capture

**Sequence:** 2 of 5  
**Depends on:** Phase 01 — Moments + DejaVu Foundation  
**Blocks:** Community surfacing on Home, CreativeMind orchestration polish

---

## 1. Goal

Redesign Home as the **orchestration layer of the creator's life**.

Home is not a dashboard, feature directory, generic activity feed, endless recommendation feed, or AI chat screen.

Home should answer:

> What matters now?  
> What should I continue?  
> What changed while I was away?  
> What might inspire me?  
> Is my creative world connecting in a useful way?  
> Where could I help?

Also add **Quick Capture** with two first-class actions:

- Quick note
- Voice note

The output becomes a Material/Moment without requiring organization up front.

---

## 2. Product principles

1. Home shows approximately **5–7 meaningful items maximum**.
2. One dominant CTA per Home state.
3. Continue current work is usually strongest.
4. Do not manufacture activity.
5. Calm/quiet Home is valid.
6. Community content will later be selectively injected, never turned into a feed.
7. Adaptive navbar shows one short current truth.
8. Home prioritizes significance over recency.
9. Quick Capture must take seconds.
10. Capture first; organize later.

---

## 3. Home modes

### Active Home

Use when the creator has been active recently.

Primary content:

- Continue Creation
- one useful state/update
- one discovery
- one human/community signal when available

### Return Home

Use after a meaningful period away.

Primary content:

- Continue
- While you were away
- A little spark
- Your world is connecting
- Worth hearing (Phase 03 data)
- You could help (Phase 03 data)

### Quiet Home

Use when nothing important happened.

```text
Good afternoon, Kunal

Nothing needs your attention.

A Life in Moments is where you left it.
```

Optionally show one pleasant creative memory.

Do not create fake urgency.

---

## 4. Main Home layout

Recommended mobile structure:

```text
┌────────────────────────────────┐
│ Wonder Creator    3 things new │
├────────────────────────────────┤

 Good evening, Kunal

 CONTINUE
 ┌──────────────────────────────┐
 │ A Life in Moments            │
 │ Carousel · v4                │
 │ You were refining slide 3    │
 │ 5 sources · 1 unused         │
 │           Continue Creating →│
 └──────────────────────────────┘

 [ Quick note ]      [ Voice note ]

 [ While you were away ]
 Maya replied · Slides ready

 [ Your world is connecting ]
 Voice note + 2 photographs

 [ DejaVu ]
 Railways · 9 Moments

 [ A little spark ]
 Remember this?

 [ Worth hearing ]
 Phase 03 community item

 [ You could help ]
 Phase 03 help item

 Community                    →

                              🎨
```

Do not render empty categories.

---

## 5. Continue block

Primary rule:

> Surface one Creation that has the highest continuation value.

Inputs may include:

- last active Creation;
- unsaved/in-progress work;
- recent edits;
- pending generated output;
- collaborator activity;
- current Project context.

Example:

```text
CONTINUE

A Life in Moments
Carousel · v4

You were refining slide 3.
5 sources · 1 unused

[ Continue Creating ]
```

If there is no active Creation:

```text
SOMETHING WORTH STARTING

3 recent Materials seem connected.

[ Explore this idea ]
```

Do not auto-create a Creation before the user accepts.

---

## 6. Quick Capture

### 6.1 Quick note

Tap `Quick note`.

Open a minimal sheet/modal:

```text
Quick note

[ text area ]

Cancel                      Save
```

Rules:

- focus text input immediately;
- title optional / auto-derived;
- no Project selector;
- no DejaVu required;
- no tags required;
- save should be instant;
- after save, return to Home.

Create:

- canonical Material/note entity using existing domain patterns;
- Moment reference;
- optional async DejaVu suggestions.

### 6.2 Voice note

Tap `Voice note`.

Recording UI:

```text
Voice note

00:12
━━━━━━━━●━━━━━━

[ Stop ]
```

After stop:

```text
Voice note · 0:42

[ Play ]     [ Save ]
```

Rules:

- recording starts quickly;
- no mandatory title;
- save original audio first;
- transcription can happen asynchronously;
- transcription failure must not lose recording.

Create:

- canonical audio/Material entity;
- Moment reference;
- async transcription job;
- optional async summary;
- optional DejaVu suggestions.

---

## 7. Quick Capture post-save behavior

Do not interrupt save flow.

```text
✓ Voice note saved
```

Later, if suggestions are ready:

```text
Suggested DejaVu
Dad   Railways
```

User explicitly accepts or ignores them.

Never auto-attach CreativeMind DejaVus silently.

---

## 8. While you were away

This is not a notification list.

Aggregate meaningful changes such as:

- collaborator comment on active Creation;
- completed image/carousel generation;
- approval request;
- publishing failure;
- Huddle outcome;
- Project decision.

Example:

```text
WHILE YOU WERE AWAY

Maya commented on the ending
Carousel finished generating
1 approval needs review
```

If more than 3 items exist, summarize rather than display a long list.

---

## 9. A little spark

This section exists for emotional/creative value.

Possible content:

- old photo;
- old voice note;
- unused Material;
- Creation anniversary;
- meaningful past Scrapbook entry;
- public appreciation later, if available.

Examples:

```text
A LITTLE SPARK

A year ago today
you recorded this voice note.
```

```text
A LITTLE SPARK

This photograph has never appeared
in one of your Creations.
```

Do not force a CTA.

---

## 10. Your world is connecting

Use Moment + DejaVu foundations.

```text
YOUR WORLD IS CONNECTING

Your voice note from March
and these two photographs
seem to describe the same memory.

[ See connection ]
```

Phase 02 can support deterministic/simple candidates:

- same DejaVu;
- same Project;
- same person;
- explicit user relationships;
- recent co-usage.

Advanced semantic discovery comes in Phase 05.

---

## 11. DejaVu surfacing on Home

Examples:

```text
A DEJAVU SURFACED

Railways

2 new Moments now connect with
7 older Moments.

[ Open DejaVu ]
```

or:

```text
YOUR WORLD IS CONNECTING

Today's voice note may belong with
Things We Almost Forgot.
```

In Phase 02, do not automatically mutate the DejaVu.

---

## 12. Adaptive navbar

The middle Context Line should contain only one useful signal.

Examples:

```text
3 things changed
Nothing urgent
Your carousel is ready
A new connection was found
Railways surfaced again
```

Operational states override semantic AI content.

Priority:

1. critical error
2. offline
3. consequential external operation
4. live state
5. approval/blocker
6. processing/save
7. meaningful Home context
8. lifecycle state
9. metadata

Target length: 2–7 words.

---

## 13. Home ranking contract

Create a ranking abstraction that Phases 03 and 05 can extend.

```ts
type HomeCandidateKind =
  | "requires_decision"
  | "active_work_change"
  | "collaborator_response"
  | "completed_output"
  | "moment_connection"
  | "relevant_conversation"
  | "help_opportunity"
  | "relevant_huddle"
  | "creative_memory"
  | "general_activity";
```

Base priority order:

1. requires decision
2. active work change
3. collaborator response
4. completed output
5. strong Moment connection
6. relevant conversation
7. genuine opportunity to help
8. relevant Huddle
9. meaningful memory / DejaVu
10. generic activity

Do not expose numeric scores to users.

---

## 14. API / query needs

Suggested server aggregation:

```text
GET /home
```

Return structured slots, not raw feed rows.

```ts
interface HomePayload {
  mode: "active" | "return" | "quiet";
  contextLine?: string;
  continue?: HomeContinueItem;
  quickCapture: {
    textEnabled: boolean;
    voiceEnabled: boolean;
  };
  whileAway?: HomeSummary;
  worldConnecting?: HomeConnectionCard;
  dejavu?: HomeDejaVuCard;
  spark?: HomeMomentCard;
  worthHearing?: HomeCommunityCard;
  couldHelp?: HomeHelpCard;
  generatedAt: string;
}
```

The client should not reconstruct product priority rules.

---

## 15. Home rendering rules

- Do not render empty modules.
- Avoid repeated section titles when a card label is sufficient.
- Keep hero/continue card compact.
- Do not create horizontal carousels for every section.
- No bottom nav.
- Palette remains global/secondary action entry.
- Quick Capture can be visible because it is high-frequency.
- Do not show more than one large CTA.

---

## 16. Telemetry

Track outcomes, not vanity engagement.

```text
home_opened
home_mode_rendered
home_continue_clicked
quick_note_started
quick_note_saved
voice_note_started
voice_note_saved
voice_note_transcribed
home_connection_opened
home_dejavu_opened
home_spark_opened
```

Do not optimize Home for time spent.

---

## 17. Failure states

### Offline Quick Note

Allow local capture and sync later if current architecture supports safe offline drafts.

Navbar:

```text
Offline · saved locally
```

### Voice transcription failure

Keep audio.

```text
Voice note saved
Transcription unavailable
```

### Home aggregation failure

Fall back to:

- Continue
- Quick Capture
- Recent Creations

Do not block Home on CreativeMind.

---

## 18. Tests

### Quick Capture

- note save
- voice save
- failed transcription
- slow upload
- microphone permission denied
- retry after reconnect
- Moment created exactly once

### Home

- active mode
- return mode
- quiet mode
- missing sections
- only one section
- no active Creation
- multiple active Creations
- DejaVu surfaced
- navbar priority state

---

## 19. Acceptance criteria

- [ ] Home has Active / Return / Quiet modes.
- [ ] Continue card exists and is the primary action.
- [ ] Quick note saves a canonical entity + Moment.
- [ ] Voice note saves original audio + Moment.
- [ ] Voice transcription is asynchronous.
- [ ] Home can surface a DejaVu/Moment connection.
- [ ] While Away works as summary, not a notification feed.
- [ ] A Little Spark can render from existing Moments.
- [ ] Home Context Line follows priority rules.
- [ ] Empty modules do not render.
- [ ] Community-specific cards are pluggable but may remain empty until Phase 03.

---

## 20. Do not do in this phase

Do not yet build full Community, Open Conversations, Ask Community, Community → Studio actions, AI conversation summaries, popularity metrics, public follows, or automatic semantic DejaVu generation.

---

## 21. Handoff to Phase 03

Phase 03 plugs Community into the existing Home contract through `worthHearing`, `couldHelp`, relevant Huddles, and user-owned Open Conversation replies without turning Home into a feed.
