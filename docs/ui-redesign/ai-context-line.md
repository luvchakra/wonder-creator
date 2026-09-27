# Wonder Creator — AI-Powered Contextual Navbar Specification

**Status:** Owner-approved UI direction  
**Date:** 27 September 2026  
**Audience:** Claude Code / engineering / design  
**Applies to:** all Wonder Creator authenticated product screens  
**Primary component:** top navbar middle area  
**Product terminology:** Creation, Creative Studio, CreativeMind, meTalk, Creative Room, Huddle, Material

---

# 0. Executive Direction

Use the **middle area of the top navbar as an intelligent contextual sentence**.

Instead of leaving the center empty, repeating the page title, or showing generic counts, surface the most useful short piece of context for what the creator is doing **right now**.

Examples:

```text
v4 · Private
Autosaved · 2 here
Dad voice note is still unused
3 photos may fit this scene
Live · 12:42 · 4 people
The opening changed most
Scheduled tonight · 7:30 PM
Rights clear for personal use
Maya is editing this now
2 approvals are blocking publish
Nothing needs your attention
```

The navbar should feel like Wonder Creator **understands the current creative moment**.

However:

> **AI must never replace operational truth.**

Errors, offline state, publishing, permissions, approvals, rights restrictions, live connection state, exact counts, exact dates, finance state and progress come from structured application state. AI may decide which safe context is most useful and phrase it naturally.

---

# 1. Name

The middle area is called the:

# **Adaptive Context Line**

It is:

- one line;
- short;
- calm;
- contextual;
- occasionally interpretive;
- usually generated from current page context;
- never a chat message;
- never a feature menu;
- never a notification ticker.

---

# 2. Product Goal

The Context Line should answer one useful question:

```text
What matters right now?
What changed?
What is unresolved?
What is useful to remember here?
Who is present?
What is the current state?
What relationship to the current Creation matters?
```

It should reduce the need to open Details, People, Versions, Rights, progress panels, or metadata simply to understand the current moment.

---

# 3. Navbar Mental Model

```text
LEFT
Where am I / how do I go back?

MIDDLE
What matters right now?

RIGHT
One essential local control / More
```

The Palette remains separate:

```text
Palette
→ What can I do next?
```

The Context Line must not become an action menu.

---

# 4. One-Line Rule

Mobile:

```text
1 line only
```

Preferred:

```text
2–7 words
```

Soft maximum:

```text
~42 characters
```

Hard maximum:

```text
56 characters
```

Desktop may be a little longer but should still be microcopy.

Never wrap.

---

# 5. Hybrid Intelligence Model

## 5.1 Deterministic truth layer

Use structured application state for:

- offline / online;
- saving;
- upload progress;
- processing progress;
- publishing state;
- live Huddle state;
- permissions;
- rights restrictions;
- approval state;
- selected count;
- participant count;
- current version;
- due date;
- connection quality;
- payment / payout state;
- errors;
- provider availability.

These facts must never be invented by AI.

## 5.2 AI semantic layer

AI may choose or phrase:

- the most useful non-critical fact;
- what changed between versions;
- which existing Material is especially relevant;
- what remains unresolved;
- which collaborator activity matters;
- which relationship or lineage fact is useful;
- continuity from the creator’s previous session;
- concise interpretation of already-computed page context.

Example input:

```json
{
  "page": "creation",
  "lifecycle": "in-progress",
  "version": 4,
  "visibility": "private",
  "unusedMaterials": [
    {"type": "audio", "title": "Dad voice note", "relevance": 0.91}
  ],
  "recentChange": "opening scene shortened",
  "collaboratorsHere": 0
}
```

Possible AI Context Line:

```text
Dad voice note is still unused
```

That is more useful than `v4 · Private` when no higher-priority state is active.

---

# 6. Priority System

Use this order:

```text
P0  Critical error / security / rights block
P1  Offline / sync risk
P2  Active external or consequential operation
P3  Live real-time state
P4  Pending approval / blocked workflow
P5  Active processing / saving
P6  AI semantic creative context
P7  Lifecycle / current object state
P8  Collaboration presence
P9  Counts / metadata
P10 Quiet / nothing useful
```

AI primarily operates at `P6` and may phrase P7–P9.

AI never overrides P0–P5.

---

# 7. Context Line Modes

## State

```text
Autosaved
Publishing…
Offline · Saved locally
```

## Presence

```text
Maya is editing
2 collaborators here
```

## Creative context

```text
The opening changed most
3 trip photos may fit this scene
```

## Continuity

```text
You left this at version 4
The ending was your last edit
```

## Consequence

```text
Rights review required before publish
2 approvals are blocking publish
```

## Progress

```text
Rendering 62%
3 of 8 materials imported
```

Only one should dominate at a time.

---

# 8. Visual Design

Recommended style:

```text
font-size: 12–13px
font-weight: 500–600
visual height: 24–28px
one line
muted text or subtle capsule
```

The Context Line should be visually quieter than the page title and primary action.

---

# 9. Interaction

Default:

```text
non-interactive
```

Make it interactive only when it naturally opens useful existing context.

Examples:

```text
2 collaborators here
→ Presence sheet
```

```text
3 approvals blocking publish
→ Approval Center
```

```text
The opening changed most
→ Version diff
```

```text
3 photos may fit this scene
→ Suggested Materials view
```

Never open an AI chat from the Context Line.

---

# 10. Tone

The line should sound:

- observant;
- concise;
- human;
- specific;
- calm.

Avoid:

```text
I noticed...
I think...
CreativeMind suggests...
Great job!
Based on my analysis...
You should...
```

Prefer:

```text
The opening changed most
3 travel photos may fit
Maya is editing this
Dad voice note is still unused
```

The intelligence should feel embedded in the product, not conversational.

---

# 11. AI Output Grammar

Preferred patterns:

```text
[Object] · [state]
[Count] [thing] [state]
[Person] is [activity]
[Thing] may fit [context]
[Thing] still needs [state]
[Change] changed most
[Workflow] is waiting on [dependency]
[Time] · [state]
```

Avoid paragraphs.

---

# 12. AI Input Rules

Only pass context already available to the page or cheaply derived from its domain:

- current Creation metadata;
- current Material metadata;
- visible page state;
- selected object;
- current version diff summary;
- active collaborators;
- current rights summary;
- workflow state;
- page-local recommendations already computed;
- current CreativeMind insight if one exists;
- recent domain events relevant to the current object.

Do not fetch unrelated history merely to populate the navbar.

Do not run broad retrieval on every route change.

---

# 13. Privacy Rules

Respect page permissions and existing privacy behavior.

Do not expose sensitive information in the navbar when the page itself would not already expose equivalent information.

Be especially conservative with:

- financial amounts;
- private family Material;
- private collaborator activity;
- rights disputes;
- account security;
- brand/commercial negotiation details.

If needed, use a discreet form:

```text
2 items need attention
```

rather than a sensitive explicit value.

---

# 14. Invocation Strategy

Do not call AI on every render.

Recommended:

```text
route/object changes
→ build context signature
→ resolve deterministic priority
→ if P0–P5 exists, render it
→ else check AI context cache
→ render deterministic fallback immediately
→ asynchronously generate semantic Context Line
→ validate
→ crossfade in if still current
```

---

# 15. Cache Strategy

Cache key:

```text
creator_id
page_type
entity_id
entity_version / updated_at
context_signature
```

Suggested TTL:

```text
semantic creative context      5–15 min
version-specific insight       until version changes
Material relevance             5–15 min
Explore context                2–5 min
presence                       deterministic, no AI cache
operational status             deterministic, no AI cache
```

Invalidate when the relevant version, lifecycle, rights, selected object, publish state, or context signature changes.

---

# 16. Performance

Navbar AI must never delay page render.

```text
deterministic fallback: immediate
AI enhancement: async
```

Do not show:

```text
Thinking…
AI loading…
Generating context…
```

If the provider is unavailable, use fallback indefinitely.

---

# 17. Model Use

This is a lightweight microcopy task.

Use the existing provider-neutral CreativeMind/CreatorBrain server architecture.

Do not:
- call providers from the browser;
- expose API keys;
- write navbar copy to the database as business truth;
- create a new assistant subsystem.

AI output is ephemeral/cacheable presentation text.

---

# 18. Suggested AI Prompt

```text
Generate one short navbar context line for Wonder Creator.

Use only the supplied structured context.

Goal:
surface the single most useful thing for the creator to know right now.

Rules:
- 2–7 words preferred.
- Maximum 56 characters.
- One line.
- No first person.
- No praise.
- No generic advice.
- No emojis.
- No unsupported facts.
- Do not repeat the page title.
- Prefer specific creative context over generic metadata when safe.
- If there is no useful semantic observation, return null.
- Never infer rights, approvals, payments, publishing, security, live state, people, counts or dates.
- Never invent activity.
```

---

# 19. Suggested Response Schema

```ts
type AIContextLine = {
  text: string | null;
  reason:
    | "creative_context"
    | "continuity"
    | "presence"
    | "lifecycle"
    | "metadata"
    | "none";
  sourceKeys: string[];
  confidence: number;
};
```

Validation:

```text
text <= 56 chars
confidence >= threshold
all sourceKeys exist in supplied context
no prohibited pattern
```

If validation fails:

```text
use deterministic fallback
```

Suggested confidence threshold:

```text
0.75
```

---

# 20. Deterministic Fallbacks

Every page must work without AI.

Examples:

```text
Creation          → v4 · In progress
Material          → Photo · 14 Sep
Creative Studio   → Autosaved
Huddle            → Live · 12:42 · 4 people
Rights            → Personal use
Publish           → Draft
Business          → Sep · ₹84,200
```

AI improves relevance, not correctness.

---

# 21. Page-by-Page Navbar Design

## 21.1 Home Canvas

**Fallback**

```text
Continue · A Life in Moments
```

No active Creation:

```text
Ready to create
```

**AI possibilities**

```text
Your film is where you left off
3 new materials fit your current work
Yesterday’s idea is still unfinished
Dad voice note may fit your film
One idea is worth revisiting
```

Use recent active Creation, recent relevant Material, existing CreativeMind insight, unfinished-work state and recent domain activity.

Do not show dashboard-style count summaries.

---

## 21.2 Create Entry

**Fallback**

```text
Choose how to begin
```

**AI possibilities**

From Material:

```text
Starting with Dad voice note
```

From Creation:

```text
Creating from A Life in Moments
```

Blank:

```text
Start with an idea or material
```

---

## 21.3 Empty Canvas

**Fallback**

```text
Draft
```

After save:

```text
Draft saved
```

**AI possibilities**

```text
3 materials are ready to use
Your voice note is attached
Starting from the trip collection
```

Do not interpret creatively before enough content exists.

---

## 21.4 Materials / Inspiration Wall

**Fallback**

```text
64 materials
```

Filtered:

```text
Photos · 12
```

**AI possibilities**

```text
Travel material dominates this view
4 items connect to your film
Recent voice notes may be useful
Your newest material is audio
```

**Overrides**

```text
3 selected
2 importing…
Import failed
```

---

## 21.5 Material Detail — Photo

**Fallback**

```text
Photo · 14 Sep
```

**AI possibilities**

```text
This image fits your opening scene
Similar light appears in 3 materials
Unused in any Creation
Used in A Life in Moments
```

Relation claims require structured evidence.

---

## 21.6 Material Detail — Audio / Voice

**Fallback**

```text
Voice · 02:14
```

**AI possibilities**

```text
This mentions your father twice
Unused in your current film
The final 30 seconds may fit
Already used in version 3
```

**Overrides**

```text
Transcribing…
Transcript ready
Transcription unavailable
```

---

## 21.7 Material Detail — Note

**Fallback**

```text
Note · 184 words
```

**AI possibilities**

```text
This note contains 3 scene ideas
The ending idea is still unused
Linked to your current film
```

---

## 21.8 Material Detail — Document

**Fallback**

```text
Document · 3 pages
```

**AI possibilities**

```text
2 ideas connect to your current work
This source supports your opening
One reference is still unused
```

---

## 21.9 Material Detail — Video

**Fallback**

```text
Video · 01:42
```

**AI possibilities**

```text
The strongest moment starts at 0:38
2 moments fit your current Creation
Unused in any Creation
```

**Overrides**

```text
Finding moments…
8 moments found
Processing failed
```

---

## 21.10 Collection View

**Fallback**

```text
Golden Hours · 24 materials
```

**AI possibilities**

```text
Most items come from September
5 items fit your current film
This collection is mostly photography
```

**Overrides**

```text
4 selected
Adding 3 materials…
```

---

## 21.11 Explore / Creative Discovery

**Fallback**

```text
For your current work
```

**AI possibilities**

```text
Ideas related to your opening
People who work in documentary film
Materials matching your visual tone
Possibilities from recent voice notes
```

Describe current discovery scope, not quality.

---

## 21.12 Search

**Fallback**

```text
18 results
```

**AI possibilities**

```text
Mostly Materials · 12 results
3 results connect to your film
No exact Creation match
```

**Overrides**

```text
Searching…
No results
```

---

## 21.13 Creation — Idea

**Fallback**

```text
Idea · Private
```

**AI possibilities**

```text
No Material added yet
Your voice note could start this
This idea has not been shaped yet
```

---

## 21.14 Creation — In Progress

**Fallback**

```text
v4 · In progress
```

**AI possibilities**

```text
The opening changed most recently
Dad voice note is still unused
2 references remain unused
Maya commented on the ending
```

**Overrides**

```text
Saving…
Saved
Offline · Saved locally
```

---

## 21.15 Creation — Review

**Fallback**

```text
v5 · Ready for review
```

**AI possibilities**

```text
The ending changed since v4
2 suggestions remain unresolved
Maya has not reviewed this version
```

**Overrides**

```text
Review requested
2 approvals pending
```

---

## 21.16 Creation — Finished

**Fallback**

```text
Finished · Private
```

**AI possibilities**

```text
Ready to share
Rights are clear for sharing
One collaborator is uncredited
```

Rights/attribution statements require structured proof.

---

## 21.17 Creation — Published

**Fallback**

```text
Published · Instagram
```

**AI possibilities**

```text
Published from version 6
This is your current public version
A derivative was created yesterday
```

**Overrides**

```text
Publishing…
Publish failed
Scheduled · 7:30 PM
```

---

## 21.18 Creative Studio — Writing

**Fallback**

```text
Autosaved
```

**AI possibilities**

```text
The opening is your latest change
Scene 4 has the newest edits
2 references remain unused
Maya is reading this
```

**Overrides**

```text
Saving…
Offline · Saved locally
Refining…
2 collaborators here
```

---

## 21.19 Creative Studio — Image

**Fallback**

```text
Editing v3
```

**AI possibilities**

```text
The crop changed most recently
3 references share this colour mood
Maya is viewing this
```

**Overrides**

```text
Saving…
Exporting…
Rendering preview…
Offline
```

---

## 21.20 Creative Studio — Video

**Fallback**

```text
01:42 · v5
```

**AI possibilities**

```text
The opening cut changed most
Scene 3 is still the longest
2 unused clips match this sequence
```

**Overrides**

```text
Rendering 62%
Saving…
Offline · Saved locally
2 collaborators here
```

---

## 21.21 Creative Studio — Audio / Music

**Fallback**

```text
02:14 · v3
```

**AI possibilities**

```text
The intro changed most recently
Voice enters at 0:34
2 references remain unused
```

**Overrides**

```text
Exporting…
Saving…
2 listening
```

---

## 21.22 Context View

**Fallback**

```text
6 materials · 3 people
```

Active tab:

```text
Materials · 6
People · 3
References · 8
```

**AI possibilities**

```text
Most context comes from voice notes
Maya contributed 3 references
2 materials remain unused
```

---

## 21.23 Transform Creation

**Fallback**

```text
From v4
```

After format choice:

```text
Trailer · from v4
```

**AI possibilities**

```text
Trailer keeps your source material
3 references will carry forward
Poem uses the same source set
```

Do not claim one format is better.

**Overrides**

```text
Creating trailer…
Transformation failed
```

---

## 21.24 Creative Quality Review

**Fallback**

```text
4 suggestions
```

**AI possibilities**

```text
Most suggestions affect the opening
2 suggestions overlap
The ending has no open suggestions
```

**Overrides**

```text
2 selected
Applying changes…
New version created
```

---

## 21.25 Version History

**Fallback**

```text
5 versions
```

Selected:

```text
v3 · 24 Sep
```

**AI possibilities**

```text
v5 changed the opening most
v3 introduced the current ending
v4 added Maya’s contribution
```

Compare:

```text
v3 ↔ v5
```

---

## 21.26 Version Compare

**Fallback**

```text
v3 ↔ v5
```

**AI possibilities**

```text
The opening changed most
2 scenes were shortened
The ending is unchanged
```

AI must use structured diff/summary data.

---

## 21.27 Lineage

**Fallback**

```text
3 sources · 4 derivatives
```

**AI possibilities**

```text
This came from version 2
Two derivatives use this source
The trailer is the newest branch
```

---

## 21.28 Rights Overview

**Fallback**

```text
You own this
```

or:

```text
Personal use
```

**AI possibilities**

```text
Clear to share privately
Publish requires one rights review
Maya needs attribution
```

Only from rights-engine state.

**Overrides**

```text
Rights conflict
Rights review required
License request pending
```

---

## 21.29 License Detail

**Fallback**

```text
Non-exclusive · 12 months
```

**AI possibilities**

```text
Commercial use is allowed
Derivatives require approval
Attribution is required
```

No AI legal interpretation beyond explicit terms.

---

## 21.30 Share

**Fallback**

```text
Private
```

or:

```text
Unlisted · 7 days
```

**AI possibilities**

```text
Only invited people can open this
This link expires Friday
3 people already have access
```

---

## 21.31 Publish Setup

**Fallback**

```text
Draft
```

**AI possibilities**

```text
Instagram is the selected destination
Caption is still empty
Visibility is ready
```

**Overrides**

```text
Scheduled · 7:30 PM
Publishing…
Publish failed
```

---

## 21.32 Publication Detail

**Fallback**

```text
Published · Instagram
```

**AI possibilities**

```text
Published from version 6
A derivative exists for this post
Last updated yesterday
```

---

## 21.33 Approval Center

**Fallback**

```text
3 pending
```

**AI possibilities**

```text
2 approvals block publishing
One request changes rights
Oldest request is from yesterday
```

No recommendation on whether to approve.

---

## 21.34 Approval Detail

**Fallback**

```text
Publish approval
```

or:

```text
Rights approval
```

**AI possibilities**

```text
This will publish externally
This changes commercial rights
This affects 2 collaborators
```

Facts only.

---

## 21.35 Creative Room

**Fallback**

```text
A Life in Moments · Active
```

**AI possibilities**

```text
The current Creation changed today
Maya added 3 materials
One review is still waiting
2 people are here now
```

**Overrides**

```text
Huddle live · 4 people
2 approvals blocking work
```

---

## 21.36 Creative Room — No Active Creation

**Fallback**

```text
Ready to begin
```

**AI possibilities**

```text
8 materials are ready to use
3 people are already in this room
Your last Huddle saved 2 ideas
```

---

## 21.37 Crew Workspace

**Fallback**

```text
4 people · Active
```

**AI possibilities**

```text
Maya added the latest contribution
One milestone is due Friday
2 people are here now
```

---

## 21.38 Crew Invite

**Fallback**

```text
4 members
```

**AI possibilities**

```text
2 invites are still pending
Maya joined today
```

---

## 21.39 Tasks & Milestones

**Fallback**

```text
3 open · 1 blocked
```

**AI possibilities**

```text
Next milestone is Friday
One task blocks the current Creation
Maya owns the next task
```

No productivity judgments.

---

## 21.40 Collaborative Editing

**Fallback**

```text
2 collaborators here
```

**AI possibilities**

```text
Maya is editing the opening
3 changes are waiting for review
You are both in Scene 2
```

Presence/activity must be structured real-time state.

---

## 21.41 Contribution & Attribution

**Fallback**

```text
6 contributors
```

**AI possibilities**

```text
Maya contributed most recently
3 people shaped version 5
One contribution needs attribution
```

Avoid ranking creative worth.

---

## 21.42 Find Collaborators

**Fallback**

```text
12 matches
```

**AI possibilities**

```text
5 match documentary film
3 are available this week
2 worked with similar materials
```

Only from explicit profile/availability data.

---

## 21.43 Creator Profile

**Fallback**

```text
Available to collaborate
```

or:

```text
Currently creating
```

**AI possibilities**

```text
Works mostly in documentary film
3 shared creative interests
One mutual collaborator
```

Never infer sensitive traits.

---

## 21.44 Huddle Discovery

**Fallback**

```text
5 live now
```

**AI possibilities**

```text
2 Huddles relate to your film
One starts in 20 minutes
Maya is in a live Huddle
```

---

## 21.45 Huddle Detail / Lobby

**Fallback**

```text
Starts in 12 min
```

or:

```text
4 people waiting
```

**AI possibilities**

```text
This Huddle is about film editing
Maya is already here
Your current Creation is attached
```

---

## 21.46 Live Huddle

**Fallback**

```text
Live · 12:42 · 4 people
```

AI use should be minimal during live sessions.

Possible:

```text
Your Creation is being discussed
2 materials shared
```

**Overrides**

```text
Connection unstable
Reconnecting…
Microphone unavailable
```

---

## 21.47 Post-Huddle

**Fallback**

```text
42 min · 4 people
```

**AI possibilities**

```text
3 ideas were saved
One new Creation was started
2 moments became Materials
```

No subjective meeting-quality judgment.

---

## 21.48 Me / Living Portfolio

**Fallback**

```text
A Life in Moments · Active
```

**AI possibilities**

```text
Your current work is documentary film
2 Creations changed this week
One collaboration is active
```

Avoid follower-count emphasis.

---

## 21.49 My Creations

**Fallback**

```text
18 Creations
```

Filtered:

```text
In progress · 4
```

**AI possibilities**

```text
4 Creations are still active
Your newest work is a short film
2 Creations changed this week
```

---

## 21.50 Creator Autonomy

**Fallback**

```text
Balanced
```

Domain-specific:

```text
Publishing · Ask first
```

**AI possibilities**

```text
Publishing always asks first
Refinement can run automatically
Rights changes always require approval
```

Must reflect explicit policy only.

---

## 21.51 Privacy & Security

**Fallback**

```text
Private by default
```

**AI possibilities**

```text
No security action needed
One session needs review
2 connected apps have access
```

Never fabricate security assurance.

**Overrides**

```text
Security review required
Session expired
```

---

## 21.52 Notifications

**Fallback**

```text
2 need action
```

**AI possibilities**

```text
Both actions relate to publishing
One approval expires soon
Maya mentioned your Creation
```

Prefer actionable context over unread count.

---

## 21.53 CreatorPublish Queue

**Fallback**

```text
3 scheduled
```

**AI possibilities**

```text
Next publish is tonight
2 publications use version 6
Instagram is next
```

**Overrides**

```text
Publishing 1 of 3
Publish failed
```

---

## 21.54 Publication Derivative

**Fallback**

```text
Trailer · from v4
```

**AI possibilities**

```text
This derivative uses 3 source materials
Created from version 4
The source has since changed
```

---

## 21.55 Brand Opportunities

**Fallback**

```text
3 new opportunities
```

**AI possibilities**

```text
2 involve short-form video
One matches your availability
One requires commercial rights
```

Do not expose proprietary fit scores as authoritative text.

---

## 21.56 Brand Opportunity Detail

**Fallback**

```text
Short film · Due 14 Oct
```

**AI possibilities**

```text
Commercial rights are required
One deliverable is requested
Your current film is not attached
```

Do not tell the creator whether to accept.

---

## 21.57 Campaign Brief

**Fallback**

```text
Draft · Due 14 Oct
```

**AI possibilities**

```text
2 deliverables remain
Rights review is still open
One milestone is due Friday
```

**Overrides**

```text
Awaiting approval
Rights review required
```

---

## 21.58 Commercial Rights Setup

**Fallback**

```text
Non-exclusive · 12 months
```

**AI possibilities**

```text
India only · 12 months
Derivatives require approval
Attribution is required
```

Strictly structured terms.

---

## 21.59 CreatorMarket Browse

**Fallback**

```text
24 available
```

**AI possibilities**

```text
8 photography listings
5 match your current filters
3 were added this week
```

Avoid fake urgency/scarcity.

---

## 21.60 Market Listing Detail

**Fallback**

```text
Active · ₹12,000
```

**AI possibilities**

```text
Non-exclusive license
2 inquiries are open
This listing uses version 4
```

**Overrides**

```text
Paused
Unavailable
Rights review required
```

---

## 21.61 Market Listing Editor

**Fallback**

```text
Draft
```

**AI possibilities**

```text
Price is still missing
Rights terms are complete
Preview uses version 4
```

---

## 21.62 CreatorBusiness

**Fallback**

```text
Sep · ₹84,200
```

**AI possibilities**

```text
3 payouts are pending
Most revenue came from licenses
One payment needs attention
```

Financial facts must come from finance state.

---

## 21.63 Transactions

**Fallback**

```text
18 transactions · Sep
```

**AI possibilities**

```text
3 payouts remain pending
Latest payment arrived today
2 transactions need review
```

---

## 21.64 Payouts

**Fallback**

```text
3 payouts pending
```

**AI possibilities**

```text
Next payout is Friday
One payout needs account review
```

---

## 21.65 Analytics

**Fallback**

```text
30 days · All platforms
```

**AI possibilities**

```text
This view is scoped to your film
Instagram contributed most views
Publishing activity increased this week
```

AI may summarize supplied analytics but must not infer causality unless supported.

---

## 21.66 Creation Analytics

**Fallback**

```text
A Life in Moments · 30d
```

**AI possibilities**

```text
Most activity followed publication
Instagram has the largest audience here
Saves increased this week
```

Use descriptive language only.

---

## 21.67 Connected Apps

**Fallback**

```text
5 connected
```

**AI possibilities**

```text
One connection needs attention
Google Drive was used most recently
2 publishing destinations are connected
```

**Overrides**

```text
1 connection expired
Provider unavailable
```

---

## 21.68 AI Provider / BYOK

**Fallback**

```text
Gemini · Connected
```

or:

```text
Anthropic · Connected
```

AI generation is unnecessary here.

**Overrides**

```text
Provider unavailable
Key needs attention
Offline mode
```

Never expose API key fragments.

---

## 21.69 Audit Log

**Fallback**

```text
42 events · 30 days
```

**AI possibilities**

```text
Latest change was a publish action
3 rights events this week
One security event needs review
```

Only from structured audit categories.

---

## 21.70 Settings

**Fallback**

```text
Privacy
Notifications
AI Providers
Appearance
```

AI is usually unnecessary. Predictability is more useful.

---

## 21.71 Onboarding

**Fallback**

```text
Step 2 of 4
```

Suggested authored text:

```text
Tell Wonder Creator what you make
Choose how much autonomy you want
```

No AI required.

---

## 21.72 Error / Not Found / Permission Denied

**Fallback**

```text
Couldn’t open this
```

or:

```text
Access unavailable
```

AI should not invent recovery steps.

---

# 22. Intelligent Context Selection

Suggested usefulness scoring:

```text
directly affects current object              +100
unresolved context                            +90
recently changed                              +80
relevant unused Material                      +70
active collaborator activity                  +65
continuity from previous session              +60
useful relationship / lineage                 +55
generic metadata                              +20
vanity metric                                  -80
unsupported inference                        -1000
```

---

# 23. No Novelty Rotation

Do not rotate Context Lines merely to make the product feel alive.

Good:

```text
The opening changed most
```

stays until meaningful context changes.

Bad:

```text
The opening changed most
Your opening has new edits
Recent work focused on the opening
```

cycling every few seconds.

Stability is more important than novelty.

---

# 24. Session Continuity

On return to a Creation, AI may surface:

```text
You left this at version 4
The ending was your last edit
Maya commented after you left
```

Only from actual version/domain events.

This is a high-value use of the navbar because it restores context without a separate recap screen.

---

# 25. Selected Object Context

Selection may temporarily override generic page context.

Examples:

```text
Materials     → 3 selected
Studio        → Scene 4 · 2 references
Lineage       → v3 · created from v2
Tasks         → Edit trailer · due Friday
```

When selection clears, revert to the stable Context Line.

---

# 26. CreativeMind Relationship

The Context Line may use CreativeMind infrastructure but should not look like CreativeMind.

Never prefix:

```text
CreativeMind:
```

CreativeMind may provide semantic interpretation while the navbar system controls:
- priority;
- truth;
- validation;
- length;
- fallback;
- display.

---

# 27. No AI Chat Surface

Do not create:
- navbar chatbot;
- prompt field;
- assistant drawer;
- conversation thread.

If an AI line is tappable, it opens existing product context.

Example:

```text
3 photos may fit this scene
→ filtered Materials
```

not an AI explanation chat.

---

# 28. Actionable AI Context

A line may have one subtle action.

Examples:

```text
3 photos may fit this scene
→ Suggested Materials
```

```text
Maya commented on the ending
→ Comment
```

```text
One contribution needs attribution
→ Attribution issue
```

Text remains the primary visual.

---

# 29. Accuracy Rules

Reject AI output if it:

- invents names;
- invents counts;
- invents dates;
- invents live activity;
- invents rights;
- invents publication state;
- makes legal conclusions;
- makes financial predictions;
- claims causality without evidence;
- infers sensitive traits;
- exposes secrets;
- exceeds maximum length;
- uses assistant voice;
- repeats the page title unnecessarily.

---

# 30. Context Payload Minimization

Prefer existing summaries to raw content.

Example:

```json
{
  "materialType": "audio",
  "duration": 134,
  "existingSummary": "Father describes childhood train journeys",
  "usedInCurrentCreation": false
}
```

Do not send a full transcript solely to generate a 5-word navbar line when a summary already exists.

---

# 31. Server Architecture

```text
Page / domain state
        ↓
buildNavContext()
        ↓
resolveDeterministicPriority()
        ↓
P0–P5?
 yes → render deterministic
 no
        ↓
read cache
        ↓
render fallback immediately
        ↓
CreativeMind navbar microcopy tool
        ↓
validate
        ↓
cache
        ↓
crossfade if context signature still matches
```

---

# 32. Suggested Files

```text
apps/web/src/lib/navigation/
  nav-context.ts
  nav-context-resolver.ts
  nav-context-ai.ts
  nav-context-cache.ts
  nav-context-validator.ts

packages/ui/src/nav/
  AdaptiveContextLine.tsx

packages/creator-brain/src/tools/
  navbar-context.ts
```

Use existing provider-neutral AI infrastructure.

---

# 33. Suggested Context Type

```ts
type NavAIContext = {
  page: string;

  entity?: {
    id: string;
    type: string;
    title?: string;
    lifecycle?: string;
    version?: number;
    visibility?: string;
    updatedAt?: string;
  };

  operational?: {
    saveState?: "clean" | "dirty" | "saving" | "saved" | "offline";
    processing?: string | null;
    progress?: number | null;
    error?: string | null;
  };

  collaboration?: {
    activeCount?: number;
    activeNames?: string[];
    recentActivitySummary?: string | null;
  };

  rights?: {
    status?: string;
    blockers?: string[];
    attributionIssues?: number;
  };

  workflow?: {
    pendingApprovals?: number;
    dueAt?: string | null;
    scheduledAt?: string | null;
  };

  creative?: {
    currentSummary?: string | null;
    recentChangeSummary?: string | null;
    unusedRelevantMaterials?: Array<{
      id: string;
      type: string;
      label: string;
      relevance: number;
    }>;
    unresolvedSuggestions?: number;
    lineageSummary?: string | null;
  };
};
```

---

# 34. Render State

```ts
type AdaptiveNavbarState = {
  text: string;
  source: "deterministic" | "ai";
  tone:
    | "neutral"
    | "active"
    | "success"
    | "warning"
    | "error"
    | "live";
  priority: number;
  action?: {
    type: "route" | "sheet";
    target: string;
  };
  expiresAt?: number;
};
```

---

# 35. Race Condition Rule

Every AI request carries a context signature.

Before applying response:

```text
if currentSignature !== responseSignature:
    discard response
```

Never let text from a previous page or entity appear after navigation.

---

# 36. Motion

Only:

```text
opacity crossfade
120–160ms
```

No:
- slide;
- spring;
- typewriter;
- shimmer;
- word-by-word reveal.

The navbar must feel stable.

---

# 37. Mobile Width Strategy

Preferred center width:

```text
120–190px
```

If too long:

```text
1. use shortText
2. remove secondary clause
3. use deterministic fallback
4. truncate only as last resort
```

Example:

```text
Full:
Dad voice note is still unused

Short:
Dad voice note is unused

Fallback:
v4 · In progress
```

---

# 38. Desktop Behavior

Desktop may allow:

```text
primary context · secondary signal
```

Example:

```text
The opening changed most · Autosaved
```

Still no ticker or dashboard metrics.

---

# 39. Localization

Generate in the current UI language.

- dates locale-aware;
- time locale-aware;
- currency locale-aware;
- names unchanged;
- fallback templates localized;
- avoid slang unless explicitly part of brand voice.

---

# 40. Accessibility

- meet text contrast requirements;
- do not rely on color alone;
- interactive line has >=44px hit target;
- autosave should not repeatedly announce to screen readers;
- errors may use polite/assertive live region as appropriate;
- Huddle duration must not announce every second;
- truncated text exposes full accessible label.

---

# 41. Telemetry

Track:

```text
nav_context_rendered
nav_context_ai_requested
nav_context_ai_cache_hit
nav_context_ai_rejected
nav_context_clicked
nav_context_fallback_used
```

Dimensions:

```text
page
entity_type
source
reason
priority
latency_bucket
```

Never log raw private creative content.

---

# 42. Quality Metrics

Useful internal measures:

```text
AI acceptance rate
fallback rate
validation rejection rate
average generation latency
action click-through when applicable
repeated-context rate
context changes per session
```

Do not optimize for clicks alone.

---

# 43. Required Tests

```text
AI disabled
provider unavailable
AI timeout
AI returns null
AI returns >56 chars
AI invents person
AI invents rights state
AI repeats page title
offline override
publish override
rights conflict override
Huddle connection warning override
selection override
mobile shortText
localization
rapid route change
stale async response
```

---

# 44. Loading Rule

Never display:

```text
Thinking…
Generating context…
AI loading…
```

Fallback appears immediately. AI enhancement arrives silently.

---

# 45. Offline Rule

Offline always overrides AI.

Examples:

```text
Offline · Saved locally
Offline · Unsaved changes
```

Do not request AI while offline.

---

# 46. Sensitive Utility Pages

Reduce or disable AI on:

```text
Security
BYOK/API key management
Delete account
Payment configuration
Payout setup
Legal acceptance
Consequential rights actions
```

Prefer deterministic context.

---

# 47. Compact Navbar Examples

## Creation

```text
‹  A Life in Moments       The opening changed most    ⋯
```

## Studio

```text
‹  Creative Studio         Autosaved · 2 here          ⋯
```

## Huddle

```text
‹  Independent Film        Live · 12:42 · 4 people     ⋯
```

## Rights

```text
‹  Rights                  Publish needs rights review ⋯
```

## Publish

```text
‹  Publish                 Scheduled · 7:30 PM         ⋯
```

## Creative Room

```text
‹  Creative Room           Maya added 3 materials      ⋯
```

---

# 48. Bad Examples

Do not do:

```text
‹ Creation   v4 Private Autosaved 2 people 4 materials ⋯
```

Too much.

Do not do:

```text
‹ Creation   Refine Share Publish Export ⋯
```

Actions, not context.

Do not do:

```text
‹ Creation   CreativeMind thinks this is looking great! ⋯
```

Chatty and not useful.

Do not do:

```text
‹ Studio     AI is thinking… ⋯
```

AI implementation detail should remain invisible.

---

# 49. CLAUDE.md Standing Instruction

Add this block to repository `CLAUDE.md`:

```md
## AI-powered adaptive navbar context (owner's standing instruction)

Use the middle area of the Wonder Creator top navbar as an **Adaptive Context Line**: one short, intelligent line describing the single most useful thing for the creator to know in the current moment.

### Core behavior

* Make the center navbar contextual on every product page where useful. Do not leave it empty by default and do not merely repeat the page title.
* Build the line from the current page/object context so Wonder Creator appears aware of the current Creation, Material, Creative Room, Huddle, workflow or utility state.
* Use **AI/CreativeMind for semantic phrasing and selection of useful creative context**, but never use AI as the source of operational truth.
* Deterministic state always overrides AI for errors, offline/sync state, publishing, active external operations, live Huddle/network state, rights restrictions, approvals, permissions, security, financial state, exact counts, exact dates and progress.
* Priority: critical error → offline → consequential external operation → live state → pending/blocking decision → processing/save state → AI creative context → lifecycle → presence → metadata/count.
* AI copy should normally be 2–7 words and must fit one line; hard maximum 56 characters.
* Never use first-person assistant language such as `I noticed`, `I think`, `CreativeMind suggests`, praise, generic advice or chat-style wording.
* Good examples: `The opening changed most`, `Dad voice note is still unused`, `Maya is editing this`, `3 photos may fit this scene`, `v4 · Private`, `Live · 12:42 · 4 people`.
* Context Line tells the creator **what matters / what is happening**. The Palette tells them **what they can do next**.
* The line is informational by default. Make it interactive only when it opens an existing relevant product context such as presence, version diff, suggested Materials or approvals. Never open an AI chat from it.
* Render deterministic fallback immediately. AI enhancement is asynchronous and must never delay page rendering.
* Never show a spinner, shimmer, `Thinking…` or typewriter animation while AI copy is generated.
* Cache semantic context by creator/page/entity/version/context signature. Invalidate when relevant version/lifecycle/context changes.
* Validate every AI result: maximum length, supported source keys, no invented people/counts/dates/rights/payment/security/publish facts, no prohibited assistant voice. Invalid result → deterministic fallback.
* Every AI request carries a context signature. Discard stale responses after navigation or state changes.
* Do not perform broad retrieval or expensive AI calls solely to fill the navbar. Use page-local context or cheap domain state.
* Reuse existing summaries rather than sending full private Materials/transcripts when possible.
* Use the existing provider-neutral CreativeMind/CreatorBrain server architecture. Never expose provider keys to the browser.
* Status replacement uses only a subtle 120–160ms crossfade. No slide, spring, typewriter or word-by-word animation.
* Mobile Context Line is one line, roughly 120–190px. Shorten/drop secondary wording before truncating.
* Do not rotate AI lines for novelty. Keep a useful line stable until underlying context meaningfully changes.
* Reduce or disable AI on sensitive utility surfaces such as security, BYOK, destructive settings, payment setup and consequential legal/rights decisions.
* Every page must have a deterministic Context Line fallback so the feature remains fully functional when AI is offline or unconfigured.
```

---

# 50. Final Standard

The best Context Line should make the creator think:

> **“Yes, that is exactly the useful thing to know right now.”**

It should never make them think:

> **“Why is the AI talking to me?”**

The intelligence should disappear into the interface.

Final principle:

> **Use the navbar center as a quiet, intelligent awareness layer.**

And:

> **AI chooses meaning; application state supplies truth.**
