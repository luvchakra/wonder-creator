# Wonder Creator — Context-Aware Palette Specification

**Status:** Product Council–aligned interaction specification  
**Date:** 27 September 2026  
**Audience:** Claude Code / engineering / design  
**Scope:** Mobile-first contextual Palette system across Wonder Creator  
**Related terminology:** Creation, Creative Studio, CreativeMind, meTalk, Creative Room

---

# 1. Purpose

This document defines the **context-aware Palette system** for Wonder Creator.

The Palette replaces the conventional permanent navigation bar and should never become a disguised sidebar or full application sitemap.

Its purpose is simple:

> **Show only the actions and destinations that make sense from the creator’s current context.**

The Palette must help Wonder Creator feel like a creative studio rather than a software dashboard.

The creator should not have to think:

> “Which module am I in?”

They should think:

> “What can I do with what I’m working on right now?”

---

# 2. Core Product Decision

The Palette has two modes.

## 2.1 Global Palette

Used on neutral surfaces such as Home or when the creator explicitly wants to move elsewhere.

Default first-level destinations:

```text
Home
Create
Materials
Huddles
Explore
Me
```

The global Palette should contain **no more than 6 first-level items**.

`Create` opens a small secondary Palette:

```text
New Creation
Bring Material
Capture
meTalk
```

`Explore` is where discovery of ideas, people, Huddles, collections and creative possibilities begins.

`People` should **not** be a permanent global first-level item. It appears under Explore or contextually when collaboration matters.

## 2.2 Contextual Palette

Once the creator enters an object or workflow, the Palette becomes contextual.

Examples:

```text
Photo Material
→ Create with this
→ Find related
→ Add to Collection
→ Explore possibilities
```

```text
Creation in progress
→ Continue Creating
→ Bring Material
→ Refine
→ People
```

```text
Finished Creation
→ Create from this
→ Share
→ Publish
→ License
```

The contextual Palette should usually show **3–4 primary items**.

If more actions exist, use:

```text
More…
```

---

# 3. Design Principle

The Palette should answer:

> **What is the next meaningful thing I can do here?**

It should not answer:

> “What features exist in Wonder Creator?”

This distinction is mandatory.

---

# 4. Maximum Menu Density

## 4.1 First-level contextual Palette

Recommended:

```text
3–4 items
```

Maximum:

```text
5 items
```

If a context needs more than 5, move secondary items under `More…`.

## 4.2 Global Palette

Maximum:

```text
6 items
```

## 4.3 Create sub-palette

Recommended:

```text
New Creation
Bring Material
Capture
meTalk
```

Templates may live under `More…` or inside New Creation.

---

# 5. Actions That Should Never Be Hidden in Palette

The following controls should stay directly on the screen where they are consequential or expected:

```text
Back
Save
Cancel
Approve
Decline
Delete
Leave Huddle
Play / Pause
Mute
Camera on/off
Form submit
Search
Filter
Sort
Pagination / tab selection
```

These are direct interaction controls, not contextual creative actions.

---

# 6. Context Priority Logic

Palette items should be selected according to this priority:

```text
1. Primary action on the current object
2. Most likely next creative action
3. Relevant contextual collaboration action
4. Relevant continuity action
5. Optional More…
```

Never prioritize a utility or administrative action over the creator’s work unless the current page is itself a utility flow.

---

# 7. Lifecycle-Aware Palette

The Palette must react not only to page route, but also to the lifecycle state of the current Creation.

## 7.1 Idea / early exploration

```text
Bring Material
Explore
meTalk
People
```

## 7.2 Creation in progress

```text
Continue Creating
Bring Material
Refine
References
```

More:

```text
People
Versions
Transform
```

## 7.3 Creation ready for review

```text
Review
Refine
Compare Versions
People
```

## 7.4 Creation finished

```text
Create from this
Share
Publish
License
```

More:

```text
Export
Versions
Rights
Collaborate
```

## 7.5 Creation published

```text
Transform
Analytics
Share
Rights
```

More:

```text
Create derivative
Publication history
Archive
```

---

# 8. Global Palette

Used from Home or via explicit `Go to…`.

## First level

```text
Home
Create
Materials
Huddles
Explore
Me
```

## Create submenu

```text
New Creation
Bring Material
Capture
meTalk
```

Optional:

```text
Templates
```

## Explore submenu

Prefer entering Explore as a dedicated discovery page rather than immediately exposing another long menu.

Potential discovery categories:

```text
Ideas
People
Huddles
Collections
Creative possibilities
```

---

# 9. Page-by-Page Palette Specification

## 9.1 Home Canvas

**Palette**

```text
Create
Materials
Explore
Huddles
Me
```

**Do not show**

```text
Home
People
Business
Rights
Publish
Settings
```

Home is a calm point of departure, not a menu hub.

---

## 9.2 Create Menu

**Palette**

```text
New Creation
Bring Material
Capture
meTalk
```

**Optional More**

```text
Templates
```

This menu represents: **“I want to make something.”**

---

## 9.3 Empty Canvas

**Palette**

```text
Add Material
Capture
meTalk
Choose Format
```

**More**

```text
Use Template
References
```

**Do not show**

```text
Huddles
Me
Business
Publish
Rights
```

---

## 9.4 Materials / Inspiration Wall

**Palette**

```text
Bring Material
Capture
Collections
Explore
```

**More**

```text
Go to…
```

**Keep directly on page**

```text
Search
Filters
Sort
View mode
```

---

## 9.5 Material Detail — Photo

**Palette**

```text
Create with this
Find related
Add to Collection
Explore possibilities
```

**More**

```text
Share
Edit details
Download original
Archive
```

**Keep out of Palette**

```text
Delete
```

Delete remains in overflow / dangerous-actions area.

---

## 9.6 Material Detail — Audio / Voice

**Palette**

```text
Create with this
Use words / Transcribe
Find related
Add to Collection
```

**More**

```text
Edit details
Download
Archive
```

---

## 9.7 Material Detail — Note / Document

**Palette**

```text
Create with this
Extract ideas
Find related
Add to Collection
```

**More**

```text
Edit
Share
Archive
```

---

## 9.8 Material Detail — Video

**Palette**

```text
Create with this
Extract moments
Find related
Add to Collection
```

**More**

```text
Edit details
Download
Archive
```

---

## 9.9 Collection View

**Palette**

```text
Create from Collection
Add Material
Explore Related
```

**More**

```text
Rename
Share
Archive
```

**Keep directly on page**

```text
Search
Sort
View mode
```

---

## 9.10 Explore / Creative Discovery

When nothing is selected:

```text
Create
Save to Materials
People
```

When a specific possibility is selected:

```text
Create from this
Save
Find related
```

**More**

```text
Surprise me
Go to…
```

**Keep directly on page**

```text
Search
Category filters
```

---

## 9.11 Search

For selected result:

```text
Open
Create from result
Save / Collect
Explore related
```

**More**

```text
Go to…
```

**Keep directly on page**

```text
Search field
Filters
Entity type chips
Sort
```

---

## 9.12 Creation View

**Palette**

```text
Refine
Transform
Context
Share
```

**More**

```text
Versions
Rights
Publish
Export
```

---

## 9.13 Creation View — In Progress

```text
Continue Creating
Bring Material
Refine
People
```

**More**

```text
Transform
Versions
References
```

Do not prioritize:

```text
Publish
License
Analytics
```

---

## 9.14 Creation View — Finished

```text
Create from this
Share
Publish
License
```

**More**

```text
Export
Collaborate
Versions
Rights
```

---

## 9.15 Creation View — Published

```text
Transform
Analytics
Share
Rights
```

**More**

```text
Create derivative
Publication history
Archive
```

---

## 9.16 Creative Studio — Writing

```text
Refine
Bring Material
References
Transform
```

**More**

```text
Versions
People
Share
```

Keep editor controls directly in the editor:

```text
Selection tools
Formatting
Undo/redo
Save state
```

---

## 9.17 Creative Studio — Image

```text
Refine
Bring Material
References
Transform
```

**More**

```text
Versions
People
Share
```

Keep directly in editor:

```text
Crop
Zoom
Pan
Basic image controls
```

---

## 9.18 Creative Studio — Video

```text
Refine
Bring Material
References
People
```

**More**

```text
Transform
Versions
Share
```

Keep directly in editor:

```text
Play
Pause
Timeline
Clip selection
Audio controls
```

---

## 9.19 Creative Studio — Audio / Music

```text
Refine
Bring Material
References
Transform
```

**More**

```text
Lyrics / Notes
Versions
People
```

Keep directly in editor:

```text
Playback
Track controls
Waveform navigation
```

---

## 9.20 Context View

```text
Add Material
Add Person
Add Reference
Explore Connections
```

**More**

```text
Notes
Related Creations
```

---

## 9.21 Transform Creation

```text
Choose another format
Add instruction
Use References
```

**More**

```text
View Lineage
```

Keep transformation options and Create/Generate CTA directly on the page.

---

## 9.22 Creative Quality Review

```text
Apply Selected
Try Another Direction
Compare
```

**More**

```text
Return to Studio
```

Keep individual suggestions and selection controls directly visible.

---

## 9.23 Version History

```text
Create New Version
Compare
Restore
```

**More**

```text
Lineage
```

Keep version list, selector and current marker directly visible.

---

## 9.24 Lineage

When a node is selected:

```text
Open Source
Open Derivative
Create from this
```

**More**

```text
Rights History
```

Keep graph navigation and node selection directly on the page.

---

## 9.25 Rights & License

```text
Create License
Request / Review License
Rights History
```

**More**

```text
Commercial Rights
Attribution
```

Keep actual rights terms, ownership details and license terms directly visible.

---

## 9.26 Share

```text
Copy Link
Invite People
Download
```

**More**

```text
Embed
```

Keep directly on page:

```text
Public / Private / Unlisted
Expiration
Recipient scope
```

---

## 9.27 Publish

```text
Prepare Publication
Schedule
Publish
```

**More**

```text
Publication History
```

Keep directly on page:

```text
Destination
Caption
Visibility
Platform settings
```

---

## 9.28 Approval Center

```text
Go to Creation
View Context
```

**More**

```text
Go to…
```

Keep directly on each approval:

```text
Approve
Decline
Edit
```

---

## 9.29 Creative Room

```text
Create
Bring Material
People
Huddle
```

**More**

```text
Tasks
Timeline
Rights
Approvals
```

---

## 9.30 Creative Room — No Active Creation

```text
Start Creation
Bring Material
Invite People
Start Huddle
```

**More**

```text
Room Settings
```

---

## 9.31 Creative Room — Active Creation

```text
Open Studio
Bring Material
People
Huddle
```

**More**

```text
Tasks
Timeline
```

---

## 9.32 Crew Workspace

```text
Invite
Start Huddle
Open Creation
Activity
```

**More**

```text
Contributions
Roles
```

---

## 9.33 Invite Collaborators

```text
Find People
Invite Existing Contact
```

Keep directly on page:

```text
Send Invite
Role
Permissions
Message
```

---

## 9.34 Tasks & Milestones

```text
New Task
New Milestone
Open Timeline
```

**More**

```text
CreativeMind Plan
```

Keep directly on page:

```text
Status filters
Task movement
Assignee
Due date
```

---

## 9.35 Collaborative Editing

```text
Comment
Bring Material
Create Version
Huddle
```

**More**

```text
People
Contributions
```

Keep direct editing controls in the editor.

---

## 9.36 Contribution & Attribution

```text
View by Person
View by Version
Export Credits
```

**More**

```text
Rights
```

---

## 9.37 Find Collaborators

When a creator is selected:

```text
Invite Selected
Save Person
View Relationship
```

**More**

```text
Start Huddle
```

Keep directly on page:

```text
Search
Filters
Availability
Discipline filters
```

---

## 9.38 Huddle Discovery

```text
Start Huddle
My Huddles
Upcoming
```

**More**

```text
Explore People
```

Keep directly on Huddle cards:

```text
Join
Request to Join
Remind Me
```

---

## 9.39 Live Huddle

```text
Invite
Share Material
Save Moment
Open Creation
```

**More**

```text
Huddle Details
```

Keep permanently visible:

```text
Mute
Camera
Chat
Leave
```

---

## 9.40 Post-Huddle

```text
Save as Material
Create from this
Continue with People
```

**More**

```text
Start another Huddle
```

---

## 9.41 Me / Living Portfolio

```text
Edit Profile
My Creations
Collections
Settings
```

**More**

```text
Brand Opportunities
Business
```

Keep directly on profile:

```text
Current work
Themes
Recent Creations
Live presence
```

---

## 9.42 My Creations

```text
New Creation
Continue
Explore
```

Keep directly on page:

```text
Filters
Sort
Status tabs
```

---

## 9.43 Creator Autonomy

```text
Reset Defaults
View Approvals
```

**More**

```text
Learn about Autonomy
```

Keep autonomy selectors and domain settings directly visible.

---

## 9.44 Privacy & Security

```text
Audit Log
Export Data
```

**More**

```text
Connected Apps
```

Keep directly on page:

```text
Privacy controls
Data controls
Delete Account
Session controls
```

---

## 9.45 Notifications

```text
Notification Settings
```

**More**

```text
Go to…
```

Keep directly on notification items:

```text
Open
Approve
Decline
Review
```

---

## 9.46 CreatorPublish Queue

```text
Publish a Creation
```

**More**

```text
Publication History
```

Keep queue tabs, filters, Drafts and Published directly on the page.

---

## 9.47 Publication Derivative

```text
Edit
Create Another
Publish
```

**More**

```text
Open Source Creation
```

---

## 9.48 Brand Opportunities

```text
My Preferences
Saved Opportunities
```

**More**

```text
Go to…
```

Keep `Apply`, `Decline` and `Open` directly on opportunity cards.

---

## 9.49 Campaign Brief

```text
Open Creative Room
View Rights
People
```

**More**

```text
Activity
```

Keep directly on page:

```text
Accept
Decline
Counter
Submit Deliverable
```

---

## 9.50 Commercial Rights Setup

```text
View Creation
Rights History
```

Keep directly on page:

```text
Save
Cancel
Usage Type
Territory
Duration
Exclusivity
Attribution
Derivative permissions
```

---

## 9.51 CreatorMarket Browse

```text
My Listings
Inquiries
Create Listing
```

**More**

```text
Saved
```

Keep search, filters, categories and sort directly on the page.

---

## 9.52 Market Listing Detail

```text
Edit Listing
Pause / Activate
View Creation
```

**More**

```text
Rights
Inquiries
```

Keep price, license, availability and listing status directly on page.

---

## 9.53 CreatorBusiness

```text
Transactions
Payouts
Export
```

**More**

```text
Go to…
```

Keep earnings tabs, date filters and revenue filters directly on page.

---

## 9.54 Analytics

```text
Choose Creation
Compare
Export
```

**More**

```text
Open Publication
```

Keep metric controls, date range and platform filter directly on page.

---

## 9.55 Connected Apps / Integrations

```text
Connect App
Manage Connections
```

**More**

```text
Data Controls
```

Keep `Connect`, `Disconnect`, `Reconnect`, `Configure` directly on provider rows.

---

## 9.56 Settings

Preferred Palette:

```text
Home
Me
```

or suppress the Palette entirely.

Settings already provides hierarchical navigation. The Palette should not compete with it.

---

# 10. Medium-Specific Context Rules

## Photo

Favor:

```text
Create with this
Find related
Transform
Add to Collection
```

## Audio / Voice

Favor:

```text
Create with this
Transcribe
Use words
Find related
```

## Video

Favor:

```text
Create with this
Extract moments
Transform
Find related
```

## Writing / Note

Favor:

```text
Create with this
Extract ideas
Transform
Find related
```

## Existing Creation

Favor:

```text
Refine
Transform
Context
Share
```

---

# 11. Role-Aware Context Rules

The Palette must respect permissions.

A viewer should not see:

```text
Edit
Publish
Change Rights
Delete
Invite
```

unless authorized.

A collaborator may see:

```text
Comment
Contribute
Open Studio
Huddle
```

but not necessarily:

```text
License
Publish
Commercial Rights
Delete
```

The Palette must never expose an action that server/domain authorization will reject.

UI hiding is not a security boundary.

---

# 12. Autonomy-Aware Context Rules

CreativeMind may propose actions, but Palette availability must respect the creator's autonomy policy.

If Publishing is:

```text
Ask for approval
```

then tapping Publish should lead to:

```text
Prepare → Review → Approval
```

not direct execution.

If a domain is:

```text
Never
```

the Palette should not offer automatic execution.

Instead it may offer:

```text
Prepare draft
View options
```

---

# 13. Palette Action Classes

Every Palette action should belong to one of these classes:

```text
NAVIGATION
CREATE
TRANSFORM
CONTEXT
COLLABORATION
SHARE
PUBLISH
RIGHTS
UTILITY
DANGEROUS
```

`DANGEROUS` actions should generally **not** appear in the first-level Palette.

Examples:

```text
Delete
Remove collaborator
Revoke license
Dissolve Crew
Delete account
```

---

# 14. Priority Scoring Model

Claude Code may implement contextual selection deterministically.

Suggested conceptual scoring:

```text
primary current-object action          +100
current lifecycle next-step             +90
current media-type relevance            +80
active collaboration relevance          +70
recent creator intent relevance         +60
continuity action                       +50
utility action                          +30
administrative action                   +20
dangerous action                       -100
irrelevant/unavailable                -1000
```

This does not require AI.

Prefer deterministic rules.

CreativeMind can suggest priorities, but should not override permission/autonomy rules.

---

# 15. Suggested Palette Configuration Model

```ts
type PaletteContext = {
  page:
    | "home"
    | "materials"
    | "material-detail"
    | "creation"
    | "studio"
    | "creative-room"
    | "huddle"
    | "profile"
    | "settings"
    | "publish"
    | "rights"
    | "market"
    | "business"
    | "analytics";

  entityType?:
    | "photo"
    | "audio"
    | "video"
    | "note"
    | "document"
    | "creation"
    | "collection"
    | "room";

  lifecycle?:
    | "idea"
    | "in-progress"
    | "review"
    | "finished"
    | "published"
    | "archived";

  role?: string;
  permissions: string[];
  autonomy: Record<string, string>;
  selection?: string | null;
};
```

Palette output:

```ts
type PaletteModel = {
  primary: PaletteItem[];
  more?: PaletteItem[];
  globalFallback?: boolean;
};
```

---

# 16. Suggested Palette Item Model

```ts
type PaletteItem = {
  id: string;
  label: string;
  icon: string;
  actionType:
    | "route"
    | "command"
    | "sheet"
    | "modal"
    | "external"
    | "approval";

  permission?: string;
  autonomyDomain?: string;
  lifecycle?: string[];
  entityTypes?: string[];
  disabledReason?: string;
};
```

Do not put business logic directly inside UI components.

---

# 17. Palette Resolution Function

Conceptual behavior:

```text
resolvePalette(context)
  ↓
load page rules
  ↓
apply entity-type rules
  ↓
apply lifecycle rules
  ↓
apply role / permissions
  ↓
apply autonomy constraints
  ↓
remove duplicates
  ↓
rank primary actions
  ↓
limit first level to 4
  ↓
move secondary actions to More…
  ↓
return PaletteModel
```

---

# 18. Palette UX Behavior

## Closed

Display the painter's Palette artwork in the lower-right safe area.

## Open

- softly blur/dim background;
- fan menu inward/upward;
- 3–4 primary actions;
- optional `More…`;
- no scroll for normal contextual menu.

## More

May open:
- a compact secondary fan; or
- a small bottom sheet.

Do not expand the first fan into 10+ items.

## Global fallback

Contextual Palette may include:

```text
Go to…
```

which opens the 6-item global Palette.

---

## 18.1 Preview bubble (owner board "Fan + Preview Bubble — Combined state", 28 Sep 2026)

* Leaves are label-only pills. What an action does lives in a **preview bubble**: a compact card (icon, label, one plain sentence) floating just above the previewed leaf — below it when the fan opens downward — on the trigger's side.
* One leaf is previewed at a time: on hover (mouse), on keyboard focus, or after a **long press** (~420ms) on touch. A long press never activates the leaf; the next tap does. The previewed leaf takes the selected (accent-soft) tint.
* The trigger stays in front of every page surface (z 44: above the header, the mini player and the Studio bars); only modal sheets and the open Palette sit above it.
* The bubble is descriptive only (`aria-hidden`); each leaf carries the same sentence through `aria-describedby`, so screen readers get it without the bubble.
* The bubble fades in over 150ms and appears instantly under reduced motion. Closing the Palette or switching views (More…, Go to…, Create) drops it.
* Board: `boards/palette-fan-preview-bubble-2026-09-28.png`. The painted Vector Kit palette stays the trigger (the board's disc is reference only).

# 19. Motion

Opening:

```text
220–320 ms
```

Item stagger:

```text
20–35 ms
```

Motion should feel:
- tactile;
- soft;
- organic.

Avoid:
- bounce-heavy animation;
- rotating the whole screen;
- exaggerated physics.

Respect:

```text
prefers-reduced-motion
```

---

# 20. Accessibility

Palette trigger:

```text
aria-label="Open creative palette"
```

When open:
- focus moves into Palette;
- focus remains trapped while fully open;
- Escape closes on keyboard/web;
- outside tap closes;
- menu items use semantic buttons/list/menu roles;
- labels remain text, not icon-only.

Screen reader announcement:

```text
Creative Palette opened.
4 actions available.
```

On close:

```text
Creative Palette closed.
```

---

# 21. Responsive Behavior

## Mobile

- lower-right anchor;
- fan inward/upward;
- 3–4 actions;
- thumb reachable.

## Large mobile

Same model, slightly increased spacing.

## Tablet

Palette can expand into a wider fan or compact floating panel.

Do not turn it into a permanent sidebar automatically.

## Desktop

Palette may remain in the corner or become a contextual floating tool.

Do not reintroduce a giant left navigation tree simply because space exists.

---

# 22. Direct Actions vs Palette Actions

Use this rule:

> **If the user is currently looking at the thing they are acting on, the direct action should usually remain visible on the thing itself.**

Examples:

Huddle card:

```text
Join
```

not hidden in Palette.

Approval card:

```text
Approve / Decline
```

not hidden in Palette.

Publish form:

```text
Publish
```

visible as CTA.

Palette should provide **context shifts and creative possibilities**, not hide obvious controls.

---

# 23. CreativeMind Relationship

CreativeMind should not flood the Palette.

CreativeMind can influence:
- ordering;
- one contextual suggestion;
- discovery;
- next-step recommendation.

Example:

```text
Palette
Refine
Bring Material
References
People
```

Separate contextual insight:

```text
CreativeMind noticed:
The father’s voice note may strengthen this scene.
[Use it]
```

Do not put `Ask CreativeMind` everywhere.

---

# 24. meTalk Relationship

meTalk is a creator input mode.

It should appear when:
- starting;
- changing direction;
- describing intent;
- giving natural-language instruction.

Global Create Palette:

```text
meTalk
```

In Creative Studio, it may also be invoked via press/hold on the Palette trigger or a contextual voice action.

meTalk should not remain as a permanent menu item on every screen.

---

# 25. Examples of Good Contextual Palettes

## Photo Material

```text
Create with this
Find related
Add to Collection
Explore possibilities
```

## Writing Creation

```text
Refine
Bring Material
References
Transform
```

## Finished Creation

```text
Create from this
Share
Publish
License
```

## Creative Room

```text
Create
Bring Material
People
Huddle
```

## Live Huddle

```text
Invite
Share Material
Save Moment
Open Creation
```

## Analytics

```text
Choose Creation
Compare
Export
```

---

# 26. Examples of Bad Palettes

Do not do this:

```text
Home
Creation
Materials
Huddles
Me
New Creation
Bring Material
Capture
meTalk
Explore
People
Settings
Rights
Publish
Business
```

This is a sidebar disguised as a Palette.

Do not do this on a photo:

```text
Home
Business
Analytics
Huddles
Rights
Publish
People
```

Do not do this on Rights:

```text
Capture
meTalk
Explore
Huddles
New Creation
```

---

# 27. Migration Guidance

Migrate in this order:

```text
1. Implement Global Palette
2. Implement Create submenu
3. Remove permanent bottom nav
4. Implement Creation contextual Palette
5. Implement Material contextual Palette
6. Implement Creative Studio Palette
7. Implement Creative Room Palette
8. Implement Huddle Palette
9. Implement Profile / Me Palette
10. Convert utility screens to minimal Palettes
```

---

# 28. Feature Flags

Recommended:

```text
palette_v2
palette_contextual
palette_lifecycle
palette_no_bottom_nav
```

---

# 29. Analytics / Telemetry

Track:

```text
palette_opened
palette_closed
palette_item_selected
palette_more_opened
palette_global_opened
palette_context_resolved
```

Useful dimensions:

```text
page
entity_type
lifecycle
role
item_id
position
```

Do not log private creative content.

---

# 30. Test Matrix

Minimum E2E coverage:

```text
Home → Create Palette → New Creation
Home → Materials
Material Photo → Create with this
Material Audio → Transcribe
Creation In Progress → Continue Creating
Creation Finished → Publish
Creative Studio → Transform
Creative Room → Huddle
Live Huddle → Save Moment
Profile → Settings
Rights → Create License
Publish → Prepare Publication
Market → Create Listing
Analytics → Choose Creation
```

---

# 31. Permission Tests

Verify:

```text
Viewer does not see Edit
Viewer does not see Publish
Viewer does not see Rights mutation
Collaborator sees Comment
Owner sees Rights
Owner sees Publish
Revoked member loses contextual actions
```

---

# 32. Lifecycle Tests

Verify Palette changes when:

```text
Idea → In Progress
In Progress → Review
Review → Finished
Finished → Published
Published → Archived
```

No route reload should be required if lifecycle state updates in place.

---

# 33. Mobile Acceptance Criteria

For every page:

```text
[ ] Palette shows no more than 4 primary contextual actions
[ ] More… exists only when required
[ ] Global destinations do not leak into every context
[ ] Palette is thumb reachable
[ ] Palette does not cover important content unnecessarily
[ ] Back / Save / Cancel remain direct
[ ] Dangerous actions are not first-level
[ ] Context respects lifecycle
[ ] Context respects media type
[ ] Context respects permissions
[ ] Context respects autonomy
[ ] Reduced motion supported
[ ] Screen reader labels present
[ ] No horizontal overflow at 320 px
```

---

# 34. Final Product Model

The creator’s mental model should remain:

```text
Home
Create
Materials
Explore
Huddles
Me
```

Everything else should emerge from context.

Examples:

```text
Creation
→ Refine
→ Transform
→ Share
→ Publish
```

```text
Material
→ Create with this
→ Find related
→ Collect
```

```text
Creative Room
→ Create
→ Bring
→ People
→ Huddle
```

```text
Finished Creation
→ Share
→ Publish
→ License
```

The Palette therefore behaves like a **creative instrument**, not a menu.

---

# 35. Product Standard

The governing rule for future Palette additions is:

> **If removing the Palette item would make the current moment less useful, keep it.  
> If it merely exposes another feature of Wonder Creator, hide it until it becomes relevant.**
