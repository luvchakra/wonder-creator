# Wonder Creator — UI Interaction Minimalism Specification

**Status:** Owner-approved standing UI direction  
**Date:** 27 September 2026  
**Audience:** Claude Code / engineering / design  
**Applies to:** all Wonder Creator screens and responsive breakpoints

---

# 1. Product Direction

Wonder Creator must reduce visual and interaction complexity.

The current experience has too many:
- buttons;
- animated transitions;
- possible actions visible at the same time;
- UI elements competing for attention;
- transitions between intermediate states.

The new rule is:

> **One important thing should be obvious. Everything else should appear only when it becomes relevant.**

Wonder Creator should feel calm and predictable.

The UI must not make the creator think about navigating the application.

---

# 2. Primary Interaction Rule

Every screen should have:

```text
1 dominant action or task
0–2 secondary visible actions
everything else contextual / progressive / hidden until needed
```

Maximum visible high-emphasis actions on a normal mobile screen:

```text
1 primary
2 secondary
```

Do not place 5–8 equally weighted actions on a page.

---

# 3. Action Hierarchy

Use three levels only.

## Level 1 — Primary

The most likely / important next action.

Examples:

```text
Continue Creating
Create
Publish
Save
Approve
Join Huddle
Start Creation
```

Only one primary action should normally be visually prominent.

## Level 2 — Secondary

At most two actions that are commonly needed in the current context.

Examples:

```text
Transform
Share
Invite
Compare
Add Material
```

These should be visually quieter than the primary.

## Level 3 — Contextual / deferred

Everything else goes into:
- Palette;
- More;
- bottom sheet;
- contextual sheet;
- object overflow;
- progressive disclosure.

Examples:

```text
Versions
Rights history
Archive
Export
Metadata
Advanced settings
Commercial options
Integrations
Audit details
```

---

# 4. Most-Frequent Action Rule

On each page, identify:

```text
the single action users will perform most often
```

That action should:
- remain in a stable location;
- be visually strongest;
- not move between layouts unnecessarily;
- not require opening a menu;
- not be replaced by transient CreativeMind suggestions.

Examples:

```text
Creation in progress      → Continue Creating
Creative Studio           → Continue editing / current tool
Live Huddle               → live controls remain visible
Approval Detail           → Approve / Decline remain visible
Publish Review            → Publish
Material Detail           → Create with this
Creative Room             → Open / Continue current Creation
```

---

# 5. Minimal Transition Rule

UI transitions should clarify spatial continuity, not decorate the product.

Use transitions only when they help answer:

```text
Where did this come from?
Where did this go?
What changed?
```

If a transition does not answer one of these questions, remove it.

---

# 6. Approved Transition Types

Keep only a small set of predictable transitions.

## 6.1 Page push / back

For navigation between hierarchical screens:

```text
150–220ms
small horizontal movement
subtle fade
```

Use consistently.

## 6.2 Sheet rise / dismiss

For:
- contextual detail;
- filters;
- More;
- meTalk;
- compact forms.

```text
180–240ms
small vertical movement
```

## 6.3 Palette reveal

This is the signature interaction and may remain slightly more expressive.

```text
200–280ms
soft fan/open
minimal stagger
```

Do not animate every individual element excessively.

## 6.4 Content update

For:
- status changes;
- inserted Creation;
- new Material;
- CreativeMind insight.

Prefer:

```text
fade / crossfade
120–180ms
```

No large slide.

## 6.5 Immersive media expansion

Creation preview → full-screen player/editor may use a restrained shared-element / scale transition.

Only use if implementation remains smooth.

---

# 7. Remove These Transition Patterns

Do not use:

- transition on every card tap;
- animated page backgrounds;
- multiple sequential entrance animations;
- bouncing cards;
- large spring overshoot;
- rotating controls;
- cards flying between positions;
- auto-scrolling sections after every action;
- repeated modal → page → sheet → modal chains;
- elaborate animated loaders when a simple progress indicator works;
- animated section reveals merely because they exist.

---

# 8. Transition Budget Per User Action

A normal user action should trigger at most:

```text
1 major UI transition
```

Example — good:

```text
Tap Material
→ Material Detail opens
```

Example — bad:

```text
Tap Material
→ card expands
→ page slides
→ header fades
→ CreativeMind panel animates
→ Palette moves
```

Avoid choreography.

---

# 9. Stable Layout Rule

The interface should not reorganize dramatically as state changes.

Prefer:

```text
same screen
same primary object
same primary action location
small contextual update
```

over:

```text
new screen
new layout
new controls
new action location
```

---

# 10. Progressive Reveal Rule

Secondary actions appear when one of these conditions is true:

```text
1. User selects an object
2. User opens Palette / More
3. User reaches a lifecycle state where the action becomes relevant
4. User requests advanced detail
5. A consequential action requires explicit review
```

Do not show future-stage actions prematurely.

Example:

An in-progress Creation should not prominently show:

```text
License
Market
Analytics
Commercial Rights
```

These appear only when relevant.

---

# 11. Button Count Rule

For normal mobile pages:

```text
Visible prominent buttons: max 3
Primary: max 1
```

This does not include:
- tiny standard media controls;
- inline text links;
- form field controls;
- tabs;
- required approve/decline pair.

If more than 3 prominent buttons are visible, redesign the page.

---

# 12. Prefer One Control Over Multiple Equivalent Controls

Bad:

```text
[Refine]
[Transform]
[Bring Material]
[References]
[People]
[Versions]
[Share]
```

Better:

```text
[Continue Creating]

Transform   Share

Palette → all remaining contextual actions
```

---

# 13. Palette Relationship

The Palette is the main mechanism for keeping pages clean.

Do not use it as a permanent feature list.

Contextual Palette:

```text
3–4 actions
```

Global Palette:

```text
max 6 destinations
```

The page should not duplicate every Palette action as visible buttons.

If an action is already visible prominently on the page, generally do not repeat it in the first-level Palette.

---

# 14. CreativeMind Relationship

CreativeMind must not create additional UI clutter.

Default:

```text
one insight
one suggested action
```

Do not show:
- several suggestion cards;
- multiple floating prompts;
- persistent assistant panel;
- chat bubbles;
- animated AI badges across the page.

CreativeMind should appear only when it adds meaningful context.

---

# 15. meTalk Relationship

meTalk should be a temporary interaction.

Flow:

```text
invoke meTalk
→ speak/type intent
→ confirm only if needed
→ action/result
→ meTalk UI disappears
```

Avoid:

```text
open chat page
→ conversation thread
→ result card
→ open result
```

The creator should return directly to their work.

---

# 16. Avoid Intermediate Screens

Before adding a new screen, ask:

> Can this be a sheet, inline change, or direct transition?

Prefer:

```text
Creation
→ Transform sheet
→ choose format
→ result
```

over:

```text
Creation
→ Transform landing page
→ format page
→ configuration page
→ progress page
→ result page
```

Keep the flow short.

---

# 17. Creation Flow

Recommended:

```text
Home / Material / Explore
→ New Creation
→ Creative Studio
→ Creation
```

Avoid excessive setup screens.

If input is sufficient, start creating immediately.

Only ask for additional configuration when it materially affects the result.

---

# 18. Material Flow

Recommended:

```text
Materials
→ Material Detail
→ Create with this
→ Creative Studio
```

Do not insert a generic “Choose what to do” screen.

---

# 19. Transform Flow

Recommended:

```text
Creation
→ Transform
→ choose one transformation
→ optional compact instruction
→ generate
→ new Creation
```

Do not require a separate settings page unless advanced configuration is explicitly opened.

---

# 20. Publish Flow

Recommended:

```text
Creation
→ Publish
→ destination + essential settings
→ Review
→ Publish
```

Do not create separate pages for:
- destination;
- caption;
- visibility;
- scheduling

unless the complexity of a provider genuinely requires it.

Use compact sections on one screen.

---

# 21. Rights / License Flow

Recommended:

```text
Creation
→ Rights
→ current state
→ Create / Request License
→ compact form
→ Review
```

Do not expose all legal dimensions until the creator enters the license flow.

---

# 22. Huddle Flow

Recommended:

```text
Huddles
→ Join
→ Live Huddle
```

For request-only Huddles:

```text
Huddles
→ Request to Join
→ pending state on same card
→ notification when accepted
→ Live Huddle
```

Avoid a separate request-confirmation page unless necessary.

---

# 23. Creative Room Flow

Recommended:

```text
Creative Room
→ current Creation / next step
```

The room should not force navigation through:
- overview;
- tasks;
- files;
- people;
- timeline

before reaching the current work.

Most often-used content appears immediately.

---

# 24. Page-by-Page Primary Action Guidance

## Home

Primary:

```text
Continue current Creation
```

If no current Creation:

```text
Create
```

Secondary:

```text
Materials
Explore
```

Everything else in Palette.

---

## Materials

Primary:

```text
Open selected/recent Material
```

or if empty:

```text
Bring Material
```

Secondary:

```text
Search
Capture
```

Collections/Explore via Palette.

---

## Material Detail

Primary:

```text
Create with this
```

Secondary:

```text
Find related
Add to Collection
```

Share/Edit/Archive under More.

---

## Creation — In Progress

Primary:

```text
Continue Creating
```

Secondary:

```text
Transform
Share
```

Bring Material / References / People / Versions via Palette.

---

## Creation — Finished

Primary:

```text
Share
```

or Publish if publishing is the current explicit workflow.

Secondary:

```text
Create from this
Publish
```

License / Export / Rights under Palette/More.

---

## Creative Studio

Primary:

```text
the actual editing interaction
```

Do not show a giant CTA over the editor.

Secondary:

```text
Refine
Transform
```

Contextual actions via Palette.

---

## Transform

Primary:

```text
Create transformation
```

Secondary:

```text
change format
use reference
```

---

## Creative Quality

Primary:

```text
Apply Selected
```

Secondary:

```text
Compare
Try another direction
```

---

## Versions

Primary:

```text
Compare
```

Secondary:

```text
Restore
New version
```

---

## Rights

Primary:

```text
Manage / Create License
```

Secondary:

```text
Rights History
```

---

## Share

Primary:

```text
Copy / Share
```

Secondary:

```text
Invite
Download
```

---

## Publish

Primary:

```text
Publish
```

Secondary:

```text
Schedule
Preview
```

---

## Approval Detail

Primary actions:

```text
Approve
Decline
```

These are an intentional two-button exception because the decision requires equal clarity.

Other actions go under More.

---

## Creative Room

Primary:

```text
Continue current Creation
```

If none:

```text
Start Creation
```

Secondary:

```text
People
Huddle
```

Tasks/Timeline/Rights/etc. via Palette.

---

## Crew

Primary:

```text
Open current Creation
```

Secondary:

```text
Invite
Huddle
```

Activity/Contributions/Roles under More.

---

## Huddle Discovery

Primary on card:

```text
Join
```

Page-level primary:

```text
Start Huddle
```

Do not add separate prominent My Huddles / Upcoming buttons; use compact tabs.

---

## Live Huddle

Primary UI:

```text
the conversation itself
```

Essential persistent controls only:

```text
Mute
Camera
Chat
Leave
```

Everything else in Palette.

---

## Me

Primary:

```text
Open featured/current Creation
```

Secondary:

```text
Edit Profile
My Creations
```

Settings / Business / Brand via Palette/More.

---

## Settings

No prominent button unless the current setting requires Save.

Use compact rows.

Palette can be hidden.

---

## Notifications

No page-level CTA.

Each notification has only the action required by that notification.

---

## CreatorPublish

Primary:

```text
Publish a Creation
```

Other destinations as tabs/rows.

---

## Brand Opportunities

Primary per opportunity:

```text
Open
```

Apply appears only in detail.

---

## Campaign

Primary depends on state:

```text
Review
Accept / Decline
Submit Deliverable
```

Only the current state action should be prominent.

---

## Market

Browse page:
- no giant CTA;
- Create Listing in Palette.

Listing detail:
- state-specific primary: Activate / Pause / Respond.

---

## CreatorBusiness

No primary CTA.

This is a read-focused utility screen.

Export stays secondary.

---

## Analytics

No primary CTA.

Filters are compact controls.

Open Creation is secondary/contextual.

---

# 25. Transition Guidelines by Screen Type

## Creative pages

Use:
- direct state change;
- subtle fade;
- shared object continuity where useful.

## Utility pages

Use:
- near-instant navigation;
- minimal motion.

## Live / media pages

Avoid transitions that interfere with playback.

## Forms

Use:
- no decorative transitions;
- only validation feedback and compact section expansion.

---

# 26. Loading Behavior

Avoid animated loading spectacles.

Prefer:

```text
small skeleton
progress line
single status text
```

For Creation generation:

```text
Creating…
```

with compact stage/status only if the operation is genuinely long.

Do not animate through 8 elaborate stages unless the user needs that information.

---

# 27. Empty States

Use:

```text
1 short sentence
1 primary action
optional subtle artwork
```

Avoid:
- full-screen illustration;
- three action buttons;
- explanatory paragraph;
- animated decorative elements.

---

# 28. Error States

Use:

```text
What happened
What the user can do now
one primary recovery action
```

Example:

```text
Couldn’t publish to Instagram.
Your Creation is safe.

Retry
```

Secondary technical detail behind More.

---

# 29. Confirmation Rules

Only ask for confirmation when:
- destructive;
- financial;
- rights-changing;
- external consequence;
- difficult to reverse.

Do not ask “Are you sure?” for ordinary creative actions.

Examples with confirmation:

```text
Delete
Publish externally if required by autonomy
Transfer rights
Purchase
Dissolve Crew
Leave unsaved destructive state
```

Examples without confirmation:

```text
Refine
Transform
Add reference
Open Studio
Create version
Save Material
```

---

# 30. Consistency Rule

The most frequent primary action on a page must remain in the same location across states where practical.

Do not:
- move Continue from top to bottom;
- move Save from header to Palette;
- alternate between floating and inline controls without reason.

Stable placement reduces cognitive load.

---

# 31. Visual Emphasis Rule

Use visual emphasis sparingly.

At any moment:

```text
1 high-emphasis element
2 medium-emphasis elements maximum
```

Everything else:
- quiet text;
- icon;
- row;
- secondary control.

Avoid multiple purple filled buttons.

---

# 32. Color Rule

Primary purple should usually identify:
- the one primary action;
- active state;
- Palette signature.

If five things are purple, nothing is primary.

---

# 33. Claude Code Implementation Checklist

For every screen:

```text
[ ] One primary action identified
[ ] Primary action is stable and obvious
[ ] No more than two visible secondary high-level actions
[ ] No more than three prominent buttons total
[ ] Secondary actions moved to Palette / More / sheet
[ ] No duplicate page + Palette actions without reason
[ ] No unnecessary intermediate screen
[ ] Transition count per action <= 1 major transition
[ ] Motion is <= 280ms in normal flows
[ ] Utility pages use minimal motion
[ ] CreativeMind shows at most one prominent insight
[ ] meTalk is temporary
[ ] Empty state has one main action
[ ] Error state has one main recovery action
[ ] Confirmations only for consequential actions
[ ] Layout does not shift dramatically after routine updates
[ ] Reduced motion respected
```

---

# 34. E2E UX Tests

Test these paths for unnecessary transitions and buttons:

```text
Home → Continue Creation
Home → Create → New Creation
Materials → Material → Create with this
Creation → Continue Creating
Creation → Transform → new Creation
Creation → Share
Creation → Publish
Creative Room → current Creation
Huddles → Join
Live Huddle → Leave
Approval → Approve
Rights → Create License
Brand Opportunity → open → respond
```

For each path record:

```text
number of screens
number of major transitions
number of visible prominent buttons per screen
number of confirmations
```

Target:

```text
minimum screens
minimum transitions
minimum visible actions
```

without hiding required consequential decisions.

---

# 35. Final Product Standard

Wonder Creator should feel like:

> **the work is always in front of me, and the next thing I need is obvious.**

Not:

> **the application is constantly showing me what else it can do.**

The governing interaction rule is:

> **Keep the most important action visible. Keep everything else quiet until it becomes relevant.**

## Fewer buttons (owner, 4 Oct 2026)

"Reduce the number of buttons on main page, if required show in palette, reduce options on palette as well. Make this a
rule for all other pages." The rule (CLAUDE.md › Fewer buttons) supersedes the counts above where they differ:

- A section's title is its link ("My Scrapbook ›"); no "All X" / "See all" rows. A card is one link; no second link inside.
- Setup invitations (e.g. Connect sources) live where the setting lives, not on content pages.
- Palette: **3** contextual actions then More…; **4** global destinations — Create · Materials · Explore · Me (Huddles is
  a door in Explore).

Home, first pass: "All scraps", "All my creations" and "All testimonials" rows became their section titles; From Pulse's
"Explore ›" became its title; "From your world · Connect sources" shows only when a source has found something.
