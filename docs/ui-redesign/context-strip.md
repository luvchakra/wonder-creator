# Wonder Creator — Adaptive Navbar Middle Area / Context Strip Specification

**Status:** Owner-approved UI direction  
**Date:** 27 September 2026  
**Audience:** Claude Code / engineering / design  
**Applies to:** Wonder Creator top navbar / app bar across mobile, tablet and desktop  
**Related UI rules:** compact UI, interaction minimalism, context-aware Palette, no bottom navigation

---

# 1. Goal

The middle area of the Wonder Creator top navbar should not be wasted space.

It should become a **compact, context-aware information area** that answers:

> **What is the most useful thing for me to know right now?**

This area is called the:

# **Context Strip**

The Context Strip is not another menu.

It is not a notification banner.

It is not a second toolbar.

It is a small, quiet information surface that changes according to the current page, object and state.

---

# 2. Core Rule

The Context Strip should show:

```text
1 primary piece of useful information
+ optionally 1 compact secondary signal
```

Maximum:

```text
2 compact signals
```

Do not fill the center with multiple badges, buttons or metrics.

The top bar should remain calm.

---

# 3. Navbar Structure

Recommended mobile top bar:

```text
┌────────────────────────────────────────────┐
│ ‹   Page / Context    [ Context Strip ]  ⋯ │
└────────────────────────────────────────────┘
```

Alternative when title is large below the bar:

```text
┌────────────────────────────────────────────┐
│ ‹          [ Context Strip ]             ⋯ │
└────────────────────────────────────────────┘

Creation Title
```

Desktop:

```text
┌──────────────────────────────────────────────────────────────────┐
│ Wonder Creator / Back      [ Context Strip ]          Search  ⋯ │
└──────────────────────────────────────────────────────────────────┘
```

The center should be visually balanced, but does not need to be mathematically centered if the left/right controls differ in width.

---

# 4. Purpose of the Context Strip

Use the center area for information such as:

```text
Autosaved
v4 · Private
2 collaborators here
Live · 12:42
3 materials selected
Creating…
Published · Instagram
License: Personal use
Due Friday
3 approvals pending
Offline · Changes saved locally
AI provider unavailable
```

The exact content depends on context.

---

# 5. What It Must Not Become

Do not use the center area as:

- a second navigation bar;
- a row of feature buttons;
- a breadcrumb trail with 4–5 levels;
- a scrolling news ticker;
- a multi-metric dashboard;
- an advertisement area;
- a CreativeMind chat area;
- a permanent status carousel;
- a location for decorative text.

The Context Strip exists to reduce uncertainty, not add options.

---

# 6. Information Priority

Choose the center information in this order:

```text
1. Critical current state
2. Current work status
3. Save / sync state
4. Collaboration / live presence
5. Lifecycle status
6. Time-sensitive information
7. Secondary metadata
```

Examples:

If publishing is actively in progress:

```text
Publishing…
```

should replace:

```text
v4 · Private
```

If offline:

```text
Offline · Changes saved locally
```

should replace normal metadata.

If a Huddle is live:

```text
Live · 12:42 · 4 people
```

is more useful than the room title.

---

# 7. Visual Design

## 7.1 Default appearance

Use a quiet capsule or inline text.

Preferred visual styles:

```text
v4 · Private
```

or:

```text
● Autosaved
```

or:

```text
2 collaborators here
```

Avoid large pills.

Recommended visual height:

```text
24–28px
```

Hit area only when interactive:

```text
>= 44px
```

The Context Strip should usually be informational, not interactive.

---

## 7.2 Typography

Recommended:

```text
12–13px
medium / semibold where needed
```

Use strong color only for status that needs attention.

Normal state:

```text
slate / muted navy
```

Active/live state:

```text
brand purple or soft red/live tone
```

Warning:

```text
amber
```

Error:

```text
red
```

Success:

```text
teal / green
```

Do not use color alone; include text/icon.

---

# 8. Minimal Interaction

The Context Strip should usually **not be tappable**.

Make it tappable only when tapping clearly reveals useful detail.

Examples:

```text
2 collaborators here
→ opens People / Presence sheet
```

```text
3 approvals pending
→ opens Approval Center
```

```text
Autosaved
→ no action required
```

```text
Published · Instagram
→ opens publication detail only if useful
```

Do not turn every status into a button.

---

# 9. Transition Rule

Changing Context Strip content should use:

```text
simple crossfade
120–160ms
```

No slide animations.

No bouncing.

No changing width with spring motion.

Avoid layout shift.

Use a fixed/min width area where practical.

---

# 10. Compactness Rule

The Context Strip should fit on one line.

Preferred maximum mobile width:

```text
120–180px
```

When content is longer:

1. shorten the wording;
2. prioritize the primary signal;
3. hide the secondary signal;
4. never wrap to 2 lines in the navbar.

Examples:

Bad:

```text
Your Creation has been successfully published to Instagram
```

Good:

```text
Published · Instagram
```

---

# 11. Context Strip Content by Page

---

## 11.1 Home Canvas

Primary options:

```text
Continue: A Life in Moments
```

or, more compact:

```text
A Life in Moments · In progress
```

If there is no active Creation:

```text
Ready to create
```

If CreativeMind has a meaningful unresolved insight:

```text
1 idea waiting
```

Avoid:

```text
12 Creations · 64 Materials · 4 Huddles
```

Home should not feel like a dashboard.

---

## 11.2 Create Menu

Show:

```text
New Creation
```

or:

```text
Choose how to begin
```

This is one of the few contexts where the Context Strip may simply reinforce the mode.

Do not show counts.

---

## 11.3 Empty Canvas

Show:

```text
Unsaved
```

After the first meaningful input:

```text
Draft saved
```

If material is attached:

```text
3 materials attached
```

Prefer save state over generic information.

---

## 11.4 Materials / Inspiration Wall

Default:

```text
64 materials
```

If filtered:

```text
12 photos
```

If selection mode:

```text
3 selected
```

If importing:

```text
2 importing…
```

Selection/import status has priority over total count.

---

## 11.5 Material Detail — Photo

Show:

```text
Photo · 14 Sep
```

or:

```text
In Golden Hours
```

If privacy matters:

```text
Private
```

If processing:

```text
Understanding…
```

---

## 11.6 Material Detail — Audio

Show:

```text
Voice · 02:14
```

During transcription:

```text
Transcribing…
```

When ready:

```text
Transcript ready
```

---

## 11.7 Material Detail — Document / Note

Show:

```text
Note · 3 pages
```

or:

```text
Document · Private
```

If being analyzed:

```text
Extracting ideas…
```

---

## 11.8 Material Detail — Video

Show:

```text
Video · 01:42
```

or:

```text
8 moments found
```

Use moment count only if genuinely generated and useful.

---

## 11.9 Collection View

Show:

```text
Golden Hours · 24
```

or:

```text
24 materials
```

If selection mode:

```text
4 selected
```

---

## 11.10 Explore

Default:

```text
For your current work
```

If scoped:

```text
For A Life in Moments
```

If looking at collaborators:

```text
People for this project
```

Avoid engagement metrics.

---

## 11.11 Search

Show:

```text
18 results
```

or:

```text
Creations · 6
```

If searching:

```text
Searching…
```

Do not repeat the query if it is already visible in the search field.

---

## 11.12 Creation View — General

Strong default:

```text
v4 · Private
```

Alternatives:

```text
v2 · Draft
Finished · Private
Published · Instagram
```

This is one of the best uses of the center area.

---

## 11.13 Creation — In Progress

Show:

```text
v4 · In progress
```

If autosave occurs:

```text
Autosaved
```

After 1–2 seconds return to:

```text
v4 · In progress
```

---

## 11.14 Creation — Finished

Show:

```text
Finished · Private
```

If rights are notable:

```text
Finished · All rights reserved
```

Keep it short.

---

## 11.15 Creation — Published

Show:

```text
Published · Instagram
```

If multiple destinations:

```text
Published · 3 channels
```

If scheduled:

```text
Scheduled · 7:30 PM
```

---

## 11.16 Creative Studio — Writing

Default:

```text
Autosaved
```

When multiple collaborators:

```text
Autosaved · 2 here
```

When offline:

```text
Offline · Saved locally
```

When generating/refining:

```text
Refining…
```

Do not show word count in the navbar unless word count is materially relevant.

---

## 11.17 Creative Studio — Image

Default:

```text
Autosaved
```

During edit:

```text
Editing v3
```

If collaborators:

```text
2 here
```

Do not show image dimensions unless requested.

---

## 11.18 Creative Studio — Video

Show:

```text
01:42 · v5
```

During render:

```text
Rendering 62%
```

During autosave:

```text
Autosaved
```

Render status takes priority.

---

## 11.19 Creative Studio — Audio

Show:

```text
02:14 · v3
```

During export:

```text
Exporting…
```

During collaboration:

```text
2 listening
```

Use collaboration wording appropriate to the medium if reliable.

---

## 11.20 Context View

Show:

```text
6 materials · 3 people
```

If a tab is selected:

```text
Materials · 6
```

or:

```text
People · 3
```

Avoid showing 3+ counts at once.

---

## 11.21 Transform Creation

Show:

```text
From v4
```

After selection:

```text
Trailer · from v4
```

During generation:

```text
Creating trailer…
```

---

## 11.22 Creative Quality Review

Show:

```text
4 suggestions
```

After selection:

```text
2 selected
```

After apply:

```text
New version created
```

Then return to the normal Creation status.

---

## 11.23 Version History

Show:

```text
5 versions
```

When one selected:

```text
v3 · 24 Sep
```

Compare mode:

```text
v3 ↔ v5
```

This is a high-value creative use of the center area.

---

## 11.24 Lineage

Show:

```text
3 sources · 4 derivatives
```

When a node is selected:

```text
Created from v2
```

or:

```text
2 derivatives
```

---

## 11.25 Rights & License

Show the most important rights state:

```text
You own this
```

or:

```text
Personal use
```

or:

```text
Exclusive license
```

If a request is pending:

```text
License request pending
```

Do not show legal detail in the navbar.

---

## 11.26 Share

Show:

```text
Private
```

or:

```text
Unlisted
```

or:

```text
Public
```

If link expiration is set:

```text
Unlisted · 7 days
```

---

## 11.27 Publish

Show current publish state:

```text
Draft
```

```text
Scheduled · 7:30 PM
```

```text
Publishing…
```

```text
Published
```

This replaces extra status banners where possible.

---

## 11.28 Approval Center

Show:

```text
3 pending
```

When reviewing one:

```text
Publish approval
```

or:

```text
License approval
```

The actual Approve/Decline controls remain directly on the page.

---

## 11.29 Creative Room

Best default:

```text
A Life in Moments · Active
```

Alternative:

```text
4 people · 3 tasks open
```

But prefer current Creation status over task counts.

If live Huddle is active:

```text
Huddle live · 4 people
```

Live state takes priority.

---

## 11.30 Creative Room — No Active Creation

Show:

```text
No active Creation
```

or:

```text
Ready to begin
```

Avoid a long empty-state message in the navbar.

---

## 11.31 Crew Workspace

Show:

```text
4 people · Active
```

If someone is live:

```text
2 here now
```

If work is awaiting review:

```text
1 review waiting
```

Review/live state takes priority.

---

## 11.32 Invite Collaborators

Show:

```text
4 members
```

or:

```text
2 invites pending
```

While searching:

```text
Finding people…
```

---

## 11.33 Tasks & Milestones

Show:

```text
3 open · 1 blocked
```

or:

```text
Next: Friday
```

Prefer the one signal most relevant to current work.

Avoid 4 metrics.

---

## 11.34 Collaborative Editing

Show:

```text
2 collaborators here
```

or:

```text
Autosaved · 2 here
```

If there are unresolved changes:

```text
3 changes to review
```

---

## 11.35 Contribution & Attribution

Show:

```text
6 contributors
```

or:

```text
24 contributions
```

When filtered:

```text
Maya · 8 contributions
```

---

## 11.36 Find Collaborators

Show:

```text
12 matches
```

or:

```text
Available now · 5
```

Only show availability if creator privacy/settings permit it.

---

## 11.37 Huddle Discovery

Show:

```text
5 live now
```

or:

```text
2 starting soon
```

Do not show viewer counts or popularity metrics.

---

## 11.38 Live Huddle

Show:

```text
Live · 12:42 · 4 people
```

This is one of the strongest Context Strip cases.

If network quality degrades:

```text
Connection unstable
```

This temporarily replaces duration/people count.

---

## 11.39 Post-Huddle

Show:

```text
42 min · 4 people
```

If moments were saved:

```text
3 moments saved
```

If a Creation was produced:

```text
1 Creation created
```

---

## 11.40 Me / Living Portfolio

Show:

```text
Creating now: A Life in Moments
```

or, compact:

```text
A Life in Moments · Active
```

If creator is available:

```text
Available to collaborate
```

Current work should normally take priority over profile metrics.

---

## 11.41 My Creations

Show:

```text
18 Creations
```

When filtered:

```text
In progress · 4
```

Selection mode:

```text
3 selected
```

---

## 11.42 Creator Autonomy

Show:

```text
Balanced
```

or:

```text
Approval required
```

More useful than repeating the page title.

If a specific domain is open:

```text
Publishing · Ask first
```

---

## 11.43 Privacy & Security

Show:

```text
Private by default
```

or:

```text
All sessions secure
```

If attention is required:

```text
1 security review
```

Avoid false reassurance if actual security state is not known.

---

## 11.44 Notifications

Show:

```text
4 unread
```

or:

```text
2 need action
```

Prefer actionable count over unread count.

---

## 11.45 CreatorPublish Queue

Show:

```text
3 scheduled
```

or:

```text
Next · 7:30 PM
```

If publishing now:

```text
Publishing 1 of 3
```

---

## 11.46 Publication Derivative

Show:

```text
Instagram · from v4
```

or:

```text
Trailer · from v4
```

Keep source continuity visible.

---

## 11.47 Brand Opportunities

Show:

```text
3 new opportunities
```

or:

```text
2 saved
```

Do not show a creator score.

---

## 11.48 Campaign Brief

Show:

```text
Draft · Due 14 Oct
```

or:

```text
Awaiting approval
```

Rights-critical state may override:

```text
Rights review required
```

---

## 11.49 Commercial Rights Setup

Show:

```text
Commercial · Non-exclusive
```

or:

```text
India · 12 months
```

If incomplete:

```text
2 terms missing
```

---

## 11.50 CreatorMarket Browse

Show:

```text
24 available
```

or filtered:

```text
Photography · 8
```

Avoid fake scarcity.

---

## 11.51 Market Listing Detail

Show:

```text
Active · ₹12,000
```

or:

```text
Draft
```

or:

```text
Paused
```

License type may replace price if more important:

```text
Non-exclusive
```

---

## 11.52 CreatorBusiness

Show one high-value period signal:

```text
Sep · ₹84,200
```

or:

```text
3 payouts pending
```

Do not put 3–4 business KPIs in the navbar.

---

## 11.53 Analytics

Show current scope:

```text
30 days · All platforms
```

or:

```text
A Life in Moments · 30d
```

Do not show a KPI ticker.

---

## 11.54 Connected Apps / Integrations

Show:

```text
5 connected
```

or:

```text
1 needs attention
```

Attention state takes priority.

---

## 11.55 Settings

Show the current section only when useful:

```text
Privacy
```

```text
AI Providers
```

```text
Notifications
```

Otherwise the Context Strip may be omitted.

---

# 12. Context Strip State Priority Matrix

When multiple signals are available, choose the highest-priority one.

```text
Priority 1 — Error / failure
Priority 2 — Offline / sync risk
Priority 3 — Active external action
Priority 4 — Active live state
Priority 5 — Pending decision / approval
Priority 6 — Save / processing state
Priority 7 — Current lifecycle state
Priority 8 — Collaboration presence
Priority 9 — Counts / metadata
```

Example:

Current Creation has:
- v4;
- 2 collaborators;
- autosaved;
- publishing in progress.

Show:

```text
Publishing…
```

Do not show:

```text
v4 · 2 here · Autosaved · Publishing
```

---

# 13. Time-to-Live Rules

Transient status should return to the stable context.

Example:

```text
Saving…
→ Saved
→ after 1.5s
→ v4 · In progress
```

Recommended:

```text
Saved / Autosaved confirmation: 1–2 seconds
Success confirmation: 1.5–2.5 seconds
Error: persists until resolved or dismissed
Live state: persists while true
Processing state: persists while true
```

Avoid rapid status flicker.

---

# 14. Context Strip Information Model

Suggested model:

```ts
type ContextStripTone =
  | "neutral"
  | "active"
  | "success"
  | "warning"
  | "error"
  | "live";

type ContextStripItem = {
  id: string;
  text: string;
  shortText?: string;
  icon?: string;
  tone: ContextStripTone;
  priority: number;
  interactive?: boolean;
  action?: {
    type: "route" | "sheet" | "command";
    target: string;
  };
  expiresAt?: number;
};
```

---

# 15. Context Resolver

The Context Strip should be deterministic.

Conceptual:

```text
resolveContextStrip(context)
  ↓
collect critical states
  ↓
collect active operation state
  ↓
collect live/collaboration state
  ↓
collect lifecycle state
  ↓
collect metadata
  ↓
sort by priority
  ↓
select first
  ↓
optionally attach one secondary compact signal
  ↓
fit to width
```

Do not require CreativeMind to decide routine navbar content.

---

# 16. Suggested Context Inputs

```ts
type NavContext = {
  page: string;
  entityType?: string;
  entityId?: string;
  lifecycle?: string;
  version?: number;
  visibility?: string;

  saveState?: "dirty" | "saving" | "saved" | "offline";
  processingState?: string | null;
  publishState?: string | null;

  participantCount?: number;
  collaboratorCount?: number;
  selectedCount?: number;

  pendingApprovalCount?: number;
  unreadActionCount?: number;

  durationSeconds?: number;
  dueAt?: string | null;

  connectionState?: "good" | "unstable" | "offline";
};
```

---

# 17. Layout Behavior

## Mobile narrow

If there is not enough room:

1. hide icon;
2. use `shortText`;
3. hide secondary signal;
4. truncate only as last resort.

Example:

Full:

```text
Published · Instagram
```

Short:

```text
Published
```

Never wrap.

---

## Tablet / Desktop

The Context Strip may show:

```text
primary signal + one secondary signal
```

Example:

```text
v4 · In progress     Autosaved
```

Still do not turn it into a dashboard.

---

# 18. Icons

Use icons only when they reduce reading time.

Good:

```text
● Live · 12:42
✓ Autosaved
↗ Published
```

Avoid:

```text
five tiny status icons with no labels
```

Text remains primary.

---

# 19. Relationship to Page Title

Do not duplicate the title.

Bad:

```text
Title: A Life in Moments
Context Strip: A Life in Moments
```

Better:

```text
Title: A Life in Moments
Context Strip: v4 · In progress
```

---

# 20. Relationship to Palette

Navbar Context Strip tells:

> **What is happening?**

Palette tells:

> **What can I do next?**

Do not mix these roles.

Example:

Context Strip:

```text
v4 · In progress
```

Palette:

```text
Refine
Transform
References
People
```

---

# 21. Relationship to CreativeMind

CreativeMind insights should not normally occupy the navbar.

Exception:

A short unresolved CreativeMind signal may appear on Home:

```text
1 idea waiting
```

Tapping it can open the insight.

Do not show:

```text
CreativeMind thinks your scene could be more emotional…
```

inside the navbar.

---

# 22. Relationship to Notifications

Do not use the Context Strip as a notification ticker.

Only show notification-related information when it materially changes the current task.

Good:

```text
2 approvals pending
```

on Approval Center / relevant workflow.

Bad:

```text
3 new notifications
```

on Creative Studio while writing.

---

# 23. Relationship to Autosave

Autosave is one of the highest-value uses.

Recommended behavior:

```text
dirty
→ no message or small dot

saving
→ Saving…

saved
→ Saved
→ after 1.5s revert to stable context
```

Do not permanently display “Autosaved” if a more useful stable status exists.

---

# 24. Relationship to Collaboration Presence

Presence should be shown only when meaningful.

Examples:

```text
2 collaborators here
```

```text
4 people live
```

Do not show:

```text
0 collaborators here
```

If no one else is present, hide the signal.

---

# 25. Relationship to Errors

Navbar is useful for persistent contextual failure.

Examples:

```text
Offline · Saved locally
```

```text
Publish failed
```

```text
Connection unstable
```

Tapping may open details.

Do not show raw error codes.

---

# 26. Accessibility

- Context Strip text must meet contrast requirements.
- Do not rely on status color alone.
- If interactive, it must have >=44px hit area.
- Screen reader label should include the full status.
- Transient messages should not announce excessively.
- Avoid announcing every autosave to screen readers.
- Critical errors should be announced with appropriate live-region behavior.
- Live Huddle duration should not trigger a screen-reader announcement every second.

---

# 27. Performance

The Context Strip should be lightweight.

Do not:
- poll all domains globally;
- fetch analytics merely to populate the navbar;
- trigger expensive CreativeMind calls;
- load private metadata not needed by the page.

Use state already available to the current route/context whenever possible.

For global counts:
- fetch only when the page needs them;
- cache briefly if appropriate;
- do not block page render.

---

# 28. Implementation Architecture

Suggested shared components:

```text
Navbar
  ├── NavbarLeft
  ├── ContextStrip
  └── NavbarRight
```

Suggested files:

```text
packages/ui/src/nav/
  ContextStrip.tsx
  ContextStripItem.tsx

apps/web/src/lib/navigation/
  resolve-context-strip.ts
  context-strip-types.ts
```

Feature/domain modules may supply context state but should not directly render navbar internals.

---

# 29. Per-Page Integration API

Conceptual:

```ts
setNavContext({
  page: "creation",
  lifecycle: "in-progress",
  version: 4,
  visibility: "private",
  saveState: "saved"
});
```

or derive from route/domain state.

Avoid manual free-text strings scattered across components.

Use typed context and a centralized resolver.

---

# 30. Compact Examples

## Creation

```text
‹  A Life in Moments     v4 · Private     ⋯
```

## Studio

```text
‹  Creative Studio       Autosaved        ⋯
```

## Huddle

```text
‹  Independent Film      Live · 12:42     ⋯
```

## Rights

```text
‹  Rights                You own this     ⋯
```

## Publish

```text
‹  Publish               Scheduled 7:30   ⋯
```

## Creative Room

```text
‹  Creative Room         2 here now       ⋯
```

---

# 31. Bad Examples

Do not do:

```text
‹  Creation   v4  Private  Autosaved  2 people  4 materials  ⋯
```

Too much.

Do not do:

```text
‹  Creation      Refine  Share  Publish  Export      ⋯
```

Those are actions, not context.

Do not do:

```text
‹  Creation    CreativeMind: Your work is looking good!   ⋯
```

Too conversational and not useful.

---

# 32. Testing

Add tests for:

```text
Creation stable status
Autosave transient state
Offline override
Publish in-progress override
Huddle live state
Huddle connection warning override
Selection count
Approval pending count
Responsive shortText fallback
Non-interactive strip not focusable
Interactive strip has 44px target
```

---

# 33. Visual QA Checklist

For every navbar:

```text
[ ] Middle area is useful, not decorative
[ ] Only 1 primary context signal
[ ] Maximum 1 secondary signal
[ ] No duplicated page title
[ ] No action buttons disguised as status
[ ] No 2-line wrapping
[ ] No layout shift during status change
[ ] Transitions use simple crossfade only
[ ] Context is correct for current page/state
[ ] Critical states override metadata
[ ] Mobile text remains readable
[ ] Navbar remains compact
```

---

# 34. Claude Code Standing Instruction

Add this to `CLAUDE.md`:

```md
## Adaptive navbar context (owner's standing instruction)

Use the middle area of the Wonder Creator top navbar as a compact, context-aware **Context Strip**.

* Do not leave the center empty when there is useful current-state information.
* Show **one primary context signal**, optionally one compact secondary signal.
* Prefer current state over generic metadata: errors/offline → active operation → live state → pending decision → save/processing → lifecycle → presence → counts.
* Useful examples: `v4 · Private`, `Autosaved`, `Live · 12:42 · 4 people`, `3 selected`, `Published · Instagram`, `Scheduled · 7:30 PM`, `You own this`, `2 collaborators here`.
* The Context Strip is primarily informational, not another toolbar. Do not put navigation or feature actions there.
* Do not duplicate the page title.
* Keep it one line and roughly 120–180px on mobile. Use short text or drop secondary signals rather than wrapping.
* Use only a subtle 120–160ms crossfade when the status changes. No slide/spring animation.
* Use the current route/domain state; do not trigger AI calls or heavy global fetches just to fill the navbar.
* If interactive, the hit target remains >=44px.
* Context Strip tells the creator **what is happening**; the Palette tells them **what they can do next**.
```

---

# 35. Final Rule

Use the navbar center when it can reduce uncertainty.

The test is:

> **If the creator would benefit from knowing this without opening another panel, show it here.**

But also:

> **If the information does not change what the creator understands about the current moment, leave the center quiet.**

The Context Strip should make Wonder Creator feel more intelligent **without making it busier**.
