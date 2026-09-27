> **Superseded in part (27 Sep 2026):** the navigation model here (bottom navigation) is replaced by the owner's UI
> redesign spec, `docs/ui-redesign/spec.md` — no bottom navigation; a corner Creative Palette. The per-story mobile
> rules below still apply where they don't conflict.

# Wonder Creator — Mobile Responsive Screen Guidelines for All Current Stories

**Date:** 27 September 2026  
**Audience:** Claude Code / implementation team  
**Scope:** All currently defined/implemented Wonder Creator stories across V1, P0.1 and P1.  
**Purpose:** Define how every major story must behave on mobile and responsive web without shrinking the desktop UI.

---

# 1. Core Mobile Philosophy

Wonder Creator mobile must be **purpose-built for mobile**, not a compressed desktop layout.

The mobile experience should preserve the product's core identity:

- artist first;
- human first;
- work first;
- context first;
- calm, emotional and editorial;
- creator/work remains the visual focus;
- CreatorBrain appears contextually;
- no conventional enterprise dashboard feel;
- no feature-menu overload;
- no generic social-media gamification.

Mobile should prioritize:
- thumb reach;
- one primary task per screen;
- progressive disclosure;
- voice/camera/media capture;
- vertical artifact browsing;
- focused CreatorBrain interaction;
- live Huddles;
- bottom sheets, full-screen editors and sticky action bars where appropriate;
- clear state transitions.

---

# 2. Global Responsive Breakpoints

Use these as layout intent rather than rigid device assumptions.

```text
XS mobile:      320–374 px
Mobile:         375–479 px
Large mobile:   480–767 px
Tablet:         768–1023 px
Desktop:        1024+ px
```

## Layout rules

### Mobile
- Single primary column.
- Avoid permanent left sidebars.
- Avoid desktop split panes unless content is naturally two-pane and the device is a large foldable/tablet.
- Use bottom navigation for top-level destinations.
- Use top app bar for title/context/back/search/more.
- Use bottom sheets for filters, quick actions, selectors and secondary metadata.
- Use sticky bottom CTA for task completion.

### Tablet
- Allow selective two-pane layouts.
- Side rail may appear only when it materially improves navigation.
- Keep creator/artifact content dominant.

### Desktop
- Preserve established editorial/studio layout.
- Sidebars can exist where already designed, but should remain subordinate to the creative work.

---

# 3. Global Navigation Model

Recommended mobile bottom navigation:

```text
Home
Create
Huddles
Library
Profile
```

Context-specific products such as Projects, Market, Publish, Business and Brand should generally be reached through:
- Home;
- profile/workspace;
- contextual tabs;
- “More” destinations;
- deep links/notifications.

Do not add every feature to bottom navigation.

---

# 4. Global Mobile UI Patterns

## 4.1 Cards
- Full-width or two-column only when cards remain readable at 375 px.
- Minimum tap target: 44×44 px.
- Avoid tiny card menus.
- Put critical action on card body or clear trailing button.

## 4.2 Tabs
- Horizontal scroll for more than 4–5 tabs.
- Keep current selection visible.
- Do not shrink labels below readable sizes.

## 4.3 Bottom sheets
Use for:
- filters;
- sorting;
- artifact actions;
- material actions;
- rights quick actions;
- collaborator selection;
- publish destination selection;
- autonomy decisions;
- export format selection.

## 4.4 Full-screen editors
Use for:
- script editing;
- long text;
- metadata forms;
- rights/license forms;
- project/crew configuration;
- publication preparation.

## 4.5 Media
- Preserve aspect ratio.
- Prefer edge-to-edge media with rounded containment.
- Use immersive full-screen mode for video/image review.
- Never crop critical creative content without an explicit crop mode.

## 4.6 Loading
Never show an empty/frozen page during long work.

Use:
- skeletons for retrieval;
- stage progress for CreatorBrain/generation;
- upload progress for CreatorSend;
- optimistic local state only where rollback is safe.

## 4.7 Offline / weak connection
Mobile must visibly distinguish:
- offline;
- upload queued;
- generation unavailable;
- media session degraded;
- provider unavailable.

## 4.8 Accessibility
- Minimum 44 px touch targets.
- Support dynamic text scaling.
- Maintain WCAG-compliant contrast.
- Do not rely only on color for state.
- Label icons.
- Preserve keyboard access on tablet/web.
- Captions/transcripts where available and permitted.

---

# 5. Brand & Visual Rules on Mobile

Use the supplied Wonder Creator brand system and high-resolution backgrounds.

Do not:
- invent a logo;
- generate replacement artwork;
- use stock imagery as a substitute for supplied brand assets.

Mobile visual language:
- warm neutral canvas;
- restrained lavender/purple actions;
- generous whitespace;
- soft shadows;
- rounded cards;
- subtle botanical decoration;
- artwork/media-first presentation;
- refined typography;
- calm transitions.

Decorative brand elements should never reduce legibility or touch clarity.

---

# 6. Mobile Responsive Story Guidelines


## V1-01 — Onboarding (V1)

### Mobile intent
Provide a warm, low-friction start and get the creator into value quickly.

### Responsive layout
Use a full-screen step flow. One concept per screen. Illustration/background may occupy the upper third; primary copy and CTA remain in the safe thumb area. Progress should be subtle rather than wizard-heavy.

### Navigation
Back, Skip where allowed, and one primary bottom CTA. Avoid a permanent bottom nav until onboarding finishes.

### Primary actions
Continue, Back, Skip, Sign in. Forms should use native keyboard types and auto-scroll the active field into view.

### Content priority
Welcome message, creative promise, identity setup, preferences, completion.

### Special rules
Do not expose platform complexity or module names. Preserve calm studio feeling.

### Mobile acceptance criteria
At 320 px no horizontal scrolling; keyboard never covers the primary CTA; user can resume interrupted onboarding.

---

## V1-02 — Creator Identity Setup (V1)

### Mobile intent
Capture identity, disciplines and basic creative context without feeling like a corporate profile form.

### Responsive layout
Single-column form grouped into compact sections. Profile image uploader at top. Discipline chips wrap naturally. Long descriptions expand inline or into focused editor.

### Navigation
Top back button; sticky Save/Next CTA at bottom.

### Primary actions
Upload/change photo, edit name/handle/bio, add/remove disciplines, location, website.

### Content priority
Identity first; secondary links and advanced fields below the fold.

### Special rules
Do not make follower counts or social metrics part of setup.

### Mobile acceptance criteria
All fields usable with one hand; chips remain tappable; save state survives navigation.

---

## V1-03 — Creative Preferences / Voice (V1)

### Mobile intent
Let creators define tone, style, preserve/avoid rules and creative boundaries.

### Responsive layout
Use visual choice cards and chips. Advanced preference groups collapse. Style references may use horizontally scrollable image cards.

### Navigation
Back + Save/Next. No dense multi-column matrix.

### Primary actions
Select tone/style, add preserve rules, add avoid rules, language/region, experiment outside normal style.

### Content priority
Current choices and what CreatorBrain will preserve.

### Special rules
Creator must be able to understand what each preference changes.

### Mobile acceptance criteria
All selections are readable at 320 px; no tiny checkboxes; unsaved changes warning works.

---

## V1-04 — Home (V1)

### Mobile intent
Create a calm mobile landing surface centered on 'what are you thinking about?'

### Responsive layout
Top greeting, compact identity/avatar, central input, quick capture row, then vertically stacked continuation cards and possibilities.

### Navigation
Bottom nav active on Home. Search/notifications may sit in top bar.

### Primary actions
Write, Talk, Add files, Add link, Take photo. Continue artifact/project. Open live Huddle.

### Content priority
Input and recent creative journey appear before discovery/promotional content.

### Special rules
Do not convert Home into dashboard widgets.

### Mobile acceptance criteria
Primary creation input visible without scrolling on common mobile heights; cards are swipe-friendly but not carousel-only.

---

## V1-05 — Creative Material / Library (V1)

### Mobile intent
Browse and access raw creative material.

### Responsive layout
Default to single-column list or compact two-column visual grid depending media type. Use sticky filter/search bar. Categories in horizontal scroll.

### Navigation
Library in bottom nav; back from material detail returns to prior filter state.

### Primary actions
Search, filter, sort, add material, select multiple, open material.

### Content priority
Recent/relevant material before metadata-heavy controls.

### Special rules
Mixed media types need recognizable thumbnails/icons and duration/type labels.

### Mobile acceptance criteria
Filter state persists; grid/list switch works; no card metadata truncation that hides type/source.

---

## V1-06 — CreatorSend (V1)

### Mobile intent
Capture or import anything into Wonder Creator.

### Responsive layout
Use source tabs or segmented control: Upload, Camera, Voice, Link. Recent sends below. Upload queue presented as stacked cards.

### Navigation
Back from capture returns to queue safely. Bottom CTA sends selected material to CreatorBrain when ready.

### Primary actions
Upload file, record audio/video, paste URL, take photo, retry, cancel, view processing.

### Content priority
Capture/import first, processing state second.

### Special rules
Mobile should exploit camera/mic/file picker natively.

### Mobile acceptance criteria
Large uploads show progress; app handles background/resume where platform permits; failure is recoverable.

---

## V1-07 — CreatorTalk (V1)

### Mobile intent
Provide a focused conversational interface to the platform.

### Responsive layout
Full-height conversation with composer pinned above keyboard. Attachments appear as horizontal strip. Generated directions use vertically stacked cards.

### Navigation
Back to previous context; optional conversation list via sheet/drawer, not permanent sidebar.

### Primary actions
Send text/voice, attach material, choose generated direction, open artifact, continue conversation.

### Content priority
Current creator request and CreatorBrain response.

### Special rules
Avoid cluttering chat with every platform tool. Show context only when relevant.

### Mobile acceptance criteria
Composer remains reachable with keyboard; message streaming is stable; attachments can be previewed.

---

## V1-08 — CreatorBrain Conversation / Creative Agent (V1)

### Mobile intent
Let CreatorBrain understand context and guide creation without becoming a generic chatbot.

### Responsive layout
Conversation-first screen with context summary cards that collapse. Recommendations are large tappable action cards. Agent/run state appears inline.

### Navigation
Back to source artifact/material/project. Context drawer opens as bottom sheet.

### Primary actions
Ask, clarify, choose direction, inspect context, approve governed action, open generated artifact.

### Content priority
Intent, possible directions, next actions.

### Special rules
Do not expose hidden chain-of-thought. Explain decisions at a product level only.

### Mobile acceptance criteria
User can correct intent; context edits are clear; governed actions cannot bypass approval.

---

## V1-09 — Creative Discovery (V1)

### Mobile intent
Help creators discover what existing material could become.

### Responsive layout
Use one-column recommendation cards with strong image/media preview. Category chips horizontally scroll.

### Navigation
Back; search; optional 'Surprise me' action in top bar.

### Primary actions
Open direction, save, ask why, create from direction.

### Content priority
Top 3–5 strong possibilities first; long-tail suggestions below.

### Special rules
Do not rank creators or ideas with vanity scoring.

### Mobile acceptance criteria
Recommendations remain legible without hover; rationale available by tap.

---

## V1-10 — Multimodal Creation (V1)

### Mobile intent
Combine photos, audio, video, documents, links and existing artifacts into one creation brief.

### Responsive layout
Material strip or stacked source cards at top, creation brief in main body, settings in collapsible sections, sticky Create CTA.

### Navigation
Back preserves draft. Source picker opens full-screen or bottom sheet.

### Primary actions
Add/remove/reorder inputs, edit brief, choose type/tone/duration/aspect ratio, Create.

### Content priority
Selected material + brief + primary generation action.

### Special rules
Do not force every setting before creation; sensible defaults are allowed.

### Mobile acceptance criteria
Reordering works by accessible controls, not drag-only; source count and type remain visible.

---

## V1-11 — Artifact Studio (V1)

### Mobile intent
Create, edit and refine an artifact on mobile.

### Responsive layout
Use focused editor. One primary content area. Tool actions move into horizontal toolbar or bottom sheet. For scripts/text, full-screen editor; for media, preview first.

### Navigation
Back to artifact; tabs such as Script/Storyboard/Visuals become horizontally scrollable.

### Primary actions
Edit, rewrite, expand, shorten, change tone, attach reference, ask CreatorBrain, save/share.

### Content priority
Artifact content first; guidance/tools second.

### Special rules
Never squeeze desktop side panels beside content. Convert them to sheets or tabs.

### Mobile acceptance criteria
Autosave status visible; tool invocation never obscures editor; version creation is traceable.

---

## V1-12 — Artifact View (V1)

### Mobile intent
Present an artifact as a complete creative object.

### Responsive layout
Hero preview at top; title/status/creator next; tabbed detail sections below. Actions in sticky bottom bar or overflow.

### Navigation
Back; tabs for Details, Versions, Lineage, References, Rights.

### Primary actions
Edit, Transform, Create derivative, Share, Download, Manage rights.

### Content priority
Artifact itself before analytics/metadata.

### Special rules
Public/private state and rights status must be obvious.

### Mobile acceptance criteria
All primary actions reachable without hunting; immersive media opens full-screen.

---

## V1-13 — Version History (V1)

### Mobile intent
Review and restore artifact history.

### Responsive layout
Version timeline as stacked list. Compare opens dedicated full-screen compare view; on narrow screens use before/after toggle or swipe rather than side-by-side text columns.

### Navigation
Back to artifact; Compare and Restore actions contextual.

### Primary actions
Open version, compare, restore, create new version.

### Content priority
Version label, timestamp, change summary, current indicator.

### Special rules
Restore must require confirmation and create traceable history.

### Mobile acceptance criteria
Comparison works at 320 px without unreadable split columns.

---

## V1-14 — Artifact Lineage (V1)

### Mobile intent
Show how material and artifacts relate over time.

### Responsive layout
Default to vertical lineage timeline/tree on mobile. Tap node for detail sheet. Complex graph can have pinch/zoom secondary view.

### Navigation
Back to artifact. 'View graph' may enter immersive canvas.

### Primary actions
Open source/derivative, create from this, inspect contributor/source info.

### Content priority
Current artifact and immediate parent/children first.

### Special rules
Do not force a desktop graph into a tiny viewport.

### Mobile acceptance criteria
All nodes reachable via list alternative for accessibility.

---

## V1-15 — Reference Shelf (V1)

### Mobile intent
Save and reuse inspiration.

### Responsive layout
Grid/list with collection chips. Detail opens full-screen preview with notes/tags and 'Use in creation'.

### Navigation
Library/contextual entry; collection filter via horizontal chips.

### Primary actions
Add reference, new collection, search, tag, use in creation.

### Content priority
Visual preview and collection context.

### Special rules
Retain source/provenance details.

### Mobile acceptance criteria
Links/media previews degrade gracefully; creator can trace source.

---

## V1-16 — Creative Quality System (V1)

### Mobile intent
Review quality checks and improve work.

### Responsive layout
Artifact preview first, quality checks as collapsible list, suggestions as cards. Use bottom CTA for selected changes.

### Navigation
Back to Studio/View. Tabs collapse into segmented control.

### Primary actions
Select suggestions, apply, regenerate, inspect warning.

### Content priority
Actionable issues over raw scoring.

### Special rules
Quality system advises; never silently rewrites authored content.

### Mobile acceptance criteria
Selection state is clear; applying changes creates new traceable version.

---

## V1-17 — Creative Memory (V1)

### Mobile intent
Show what Wonder Creator remembers about the creator.

### Responsive layout
Use tabs/segmented sections: About Me, Preferences, Past Work, Themes, People, Memories. Cards stacked vertically.

### Navigation
Profile/settings entry. Back preserves tab.

### Primary actions
Add/edit/delete memory where allowed, inspect source/context, correct memory.

### Content priority
Creator-understandable memory summaries.

### Special rules
Memory must feel controllable and transparent.

### Mobile acceptance criteria
Edit/delete controls reachable; sensitive memory not exposed in lock-screen previews.

---

## V1-18 — Creator Huddle — Live Session (V1)

### Mobile intent
Provide live spontaneous creative conversation.

### Responsive layout
Immersive dark media canvas. 2–4 participant grid; larger rooms prioritize active speaker. Bottom controls fixed.

### Navigation
Leave/back guarded against accidental exit. People/chat/share open side sheet or bottom sheet.

### Primary actions
Mute, camera, share, chat, invite/request, leave.

### Content priority
Participants and live conversation.

### Special rules
Do not overload with project management controls during live session.

### Mobile acceptance criteria
Controls fit one-handed use; network quality state visible; accidental Leave requires confirmation when appropriate.

---

## V1-19 — Live Huddle Discovery (V1)

### Mobile intent
Find live creative conversations.

### Responsive layout
Vertical feed/cards. Strong live badge, topic, participants, tags and Join/Request to Join.

### Navigation
Discover destination with filters in bottom sheet.

### Primary actions
Join, request to join, start Huddle, save/remind where supported.

### Content priority
Currently live conversations first.

### Special rules
No popularity/trending mechanics as primary ranking.

### Mobile acceptance criteria
Cards remain useful without autoplay; joining explains permission/visibility.

---

## V1-20 — Creator Profile + Live Presence (V1)

### Mobile intent
Communicate who the creator is and what they are creating.

### Responsive layout
Hero identity block, live-presence card, tabs for Activity/Created/Collections/Huddles/About. Metrics de-emphasized.

### Navigation
Profile bottom-nav destination.

### Primary actions
Edit profile, join Huddle, message/collaborate when permitted, open artifacts.

### Content priority
Identity/current work/live presence.

### Special rules
Follower counts must not dominate.

### Mobile acceptance criteria
Tabs scroll horizontally; live state updates without page reset.

---

## V1-21 — Creator Relationships & Network (V1)

### Mobile intent
Discover meaningful collaborators by fit.

### Responsive layout
Search + filter sheet; creator cards in vertical list. Disciplines/skills shown as compact chips.

### Navigation
Discover/Network tabs. Profile opens full screen.

### Primary actions
Follow/connect where product allows, invite to Huddle/project, view profile.

### Content priority
Discipline, relevance, availability, shared context.

### Special rules
Avoid universal creator score.

### Mobile acceptance criteria
Filtering usable one-handed; location is optional and privacy-aware.

---

## V1-22 — Rights & Publishing Foundation (V1)

### Mobile intent
Show ownership, copyright, license and publication state.

### Responsive layout
Artifact summary at top; segmented tabs for Ownership, License, Publishing. Rights cards stack vertically.

### Navigation
Back to Artifact. Manage rights/publish actions sticky when appropriate.

### Primary actions
Inspect ownership, request/create license, publishing preferences, history.

### Content priority
Current rights status and restrictions.

### Special rules
Do not imply platform records automatically establish legal ownership.

### Mobile acceptance criteria
Critical legal/rights state never hidden behind tiny tooltip.

---

## V1-23 — Creator Autonomy (V1)

### Mobile intent
Let creators control what CreatorBrain may do.

### Responsive layout
Domain settings as stacked cards/rows; autonomy level selector opens bottom sheet. Explanatory summary at top.

### Navigation
Settings > Autonomy.

### Primary actions
Change level, reset defaults, inspect what each level means.

### Content priority
Consequential domains before minor organization preferences.

### Special rules
Never use ambiguous labels for auto-execution.

### Mobile acceptance criteria
Changes save explicitly and affect future actions only.

---

## V1-24 — Settings, Privacy & Data Control (V1)

### Mobile intent
Give creators understandable control over account, privacy, data and providers.

### Responsive layout
Settings categories as simple list. Sensitive pages open dedicated screens. Avoid dense desktop settings tables.

### Navigation
Profile > Settings; persistent back hierarchy.

### Primary actions
Visibility, AI data controls, export, delete, providers, retention, audit.

### Content priority
Privacy & Security and data controls should be easy to find.

### Special rules
Destructive actions separated and clearly confirmed.

### Mobile acceptance criteria
No horizontal tables; destructive actions require deliberate confirmation.

---

## V1-25 — Search (V1)

### Mobile intent
Find materials, artifacts, people, Huddles and collections quickly.

### Responsive layout
Search field pinned at top; entity tabs scroll horizontally; filters open bottom sheet; results vertical.

### Navigation
Back restores prior destination and query.

### Primary actions
Search, filter, open result, clear recent search.

### Content priority
Best matches by entity context; recent searches optional.

### Special rules
Search respects all permissions.

### Mobile acceptance criteria
Keyboard search does not hide results; filters show active count.

---

## V1-26 — Notifications & Activity (V1 closeout)

### Mobile intent
Keep creators aware of meaningful changes without turning the product into attention bait.

### Responsive layout
Single activity feed, grouped by Today/This Week. Tabs for All, Mentions, Huddles, Collaboration/System as needed.

### Navigation
Bell entry from Home/top bar; back returns to origin.

### Primary actions
Open notification, approve/decline contextual request, mark read, notification settings.

### Content priority
Actionable events first.

### Special rules
No engagement-bait notifications.

### Mobile acceptance criteria
Notifications deep-link to exact context and reflect read state across devices.

---

## P0.1-01 — Creative Material Detail (P0.1)

### Mobile intent
Make every material item a first-class inspectable object.

### Responsive layout
Media preview first; metadata and CreatorBrain understanding in accordions; related artifacts/material below.

### Navigation
Back to Library preserving filters.

### Primary actions
Use in creation, Ask CreatorBrain, add to collection, edit metadata, archive, delete, download.

### Content priority
Preview, description, provenance, privacy, processing state.

### Special rules
Deletion must not destroy artifact provenance.

### Mobile acceptance criteria
Unsupported preview has fallback; actions obey RLS.

---

## P0.1-02 — Material Collections (P0.1)

### Mobile intent
Organize material flexibly.

### Responsive layout
Collection cards in two-column grid where readable, otherwise list. Collection detail uses full-screen grid/list.

### Navigation
Library > Collections.

### Primary actions
Create, rename, archive, add/remove, reorder, use collection in creation.

### Content priority
Cover, title, item count, privacy.

### Special rules
One material may appear in multiple collections.

### Mobile acceptance criteria
Removing from collection never deletes original.

---

## P0.1-03 — CreatorBrain Intent Clarification (P0.1)

### Mobile intent
Clarify only when ambiguity materially affects creation.

### Responsive layout
Inline clarification card in CreatorTalk or focused modal/full-screen step for complex cases.

### Navigation
Return to conversation after answer.

### Primary actions
Choose/edit intended outcome, audience, format, tone, material emphasis.

### Content priority
Missing consequential information only.

### Special rules
No unnecessary interrogation.

### Mobile acceptance criteria
Creator can skip safe assumptions but must explicitly approve consequential ones.

---

## P0.1-04 — Creation Run Progress (P0.1)

### Mobile intent
Make long-running creation understandable.

### Responsive layout
Dedicated run screen with stage list and preview. Current stage prominent; completed stages collapse.

### Navigation
Back may minimize run rather than cancel. Persistent status accessible from notifications.

### Primary actions
Pause/Cancel where supported, retry, view output.

### Content priority
Current stage, current output, remaining/recoverable status.

### Special rules
Never expose hidden chain-of-thought.

### Mobile acceptance criteria
Run survives navigation; duplicate retry avoided.

---

## P0.1-05 — Creative Quality Review & Selective Refinement (P0.1)

### Mobile intent
Let creators apply selected improvements.

### Responsive layout
Preview at top; findings checklist below; selected-change CTA sticky at bottom.

### Navigation
Back to Studio. Compare opens dedicated screen.

### Primary actions
Select/deselect suggestion, preview, apply, regenerate, reject.

### Content priority
Specific actionable suggestions.

### Special rules
Applying changes creates version history.

### Mobile acceptance criteria
No silent overwrite; before/after available.

---

## P0.1-06 — Artifact Transformation Workflow (P0.1)

### Mobile intent
Create a derivative from an existing artifact.

### Responsive layout
Source artifact summary at top; transformation choices as large icon cards; advanced options collapsed.

### Navigation
Back to source artifact.

### Primary actions
Choose transformation, edit instruction, choose format, generate.

### Content priority
Source version and inherited context visible.

### Special rules
Derivative lineage must be preserved.

### Mobile acceptance criteria
Generated derivative opens Artifact View with source link.

---

## P0.1-07 — Rights Detail & Rights History (P0.1)

### Mobile intent
Provide trustworthy rights record and history.

### Responsive layout
Use segmented sections with stacked status cards and chronological history feed.

### Navigation
Artifact > Rights.

### Primary actions
Edit permitted fields, inspect history, add license, review attribution.

### Content priority
Current rights summary first, legal note visible.

### Special rules
Do not imply legal determination.

### Mobile acceptance criteria
History remains readable at small width and is append-only.

---

## P0.1-08 — License Creation & License Request (P0.1)

### Mobile intent
Support direct licensing without full marketplace.

### Responsive layout
Step flow: type → permitted uses → exclusivity/territory/duration → review. Request flow mirrors with proposed use.

### Navigation
Back preserves draft; review screen before activation/request.

### Primary actions
Create, submit request, approve, decline, counter where supported.

### Content priority
License type, use, duration, exclusivity, attribution.

### Special rules
Consequential terms require governed approval.

### Mobile acceptance criteria
No dense legal table; use readable summaries and expandable details.

---

## P0.1-09 — Artifact Share / Download / Export (P0.1)

### Mobile intent
Complete artifact handoff.

### Responsive layout
Share sheet pattern plus dedicated export screen for complex formats.

### Navigation
Artifact action bar.

### Primary actions
Create link, invite collaborator, choose export format, download, revoke share.

### Content priority
Visibility and recipient scope.

### Special rules
Do not leak private source metadata.

### Mobile acceptance criteria
Revoked links stop working; export progress visible.

---

## P0.1-10 — Publishing Setup & Governed Publish (P0.1)

### Mobile intent
Prepare and publish safely.

### Responsive layout
Multi-step mobile flow: Platforms → Details → Review & Schedule → Publish. Each step full-width.

### Navigation
Artifact > Publish. Close/back warns about unsaved draft.

### Primary actions
Select destinations, edit captions, schedule, review, approve/publish.

### Content priority
External destination and final public representation.

### Special rules
Never show success before provider confirmation.

### Mobile acceptance criteria
Failure is destination-specific and retryable.

---

## P0.1-11 — Approval Center (P0.1)

### Mobile intent
Centralize consequential actions awaiting creator review.

### Responsive layout
Vertical list grouped by urgency/domain. Approval detail opens full screen with consequences and exact parameters.

### Navigation
Accessible from notifications/settings and contextual deep links.

### Primary actions
Review, edit, approve, decline, expire/cancel.

### Content priority
What will happen, target, cost/rights impact.

### Special rules
Approval applies only to exact action parameters.

### Mobile acceptance criteria
Actions remain auditable and deep-linkable.

---

## P0.1-12 — Autonomy Approval UX (P0.1)

### Mobile intent
Connect autonomy policy to real execution.

### Responsive layout
Inline blocked-action card in conversation/workflow plus full detail sheet.

### Navigation
Return to initiating context after decision.

### Primary actions
Approve once, decline, edit request, inspect current autonomy setting.

### Content priority
Exact action and consequence.

### Special rules
Do not ask for broad blanket permission when a narrow approval suffices.

### Mobile acceptance criteria
Approval token cannot be reused for materially different action.

---

## P0.1-13 — Huddle Creation / Invitation / Post-Huddle (P0.1)

### Mobile intent
Complete Huddle lifecycle.

### Responsive layout
Creation as compact step form. Invite via creator picker. Post-Huddle summary as separate screen.

### Navigation
Create from Huddles/Project/Profile; ending session leads to summary when applicable.

### Primary actions
Set title/visibility, invite, accept requests, save permitted moments, create material.

### Content priority
People, topic, privacy/recording consent.

### Special rules
No recording/transcription assumption.

### Mobile acceptance criteria
Post-Huddle saves only permitted content and preserves participants/history.

---

## P0.1-14 — Scrapbook Detail & Replies (P0.1)

### Mobile intent
Support reflective public/private creative fragments.

### Responsive layout
Vertical feed; detail page shows post then replies. Compose uses full-width editor sheet.

### Navigation
Profile/Home/Discover entry; bottom nav optional only if Scrapbook becomes major destination.

### Primary actions
Post, reply, delete own, report, block, set reply permissions.

### Content priority
Creative fragment before engagement metadata.

### Special rules
No likes/dislikes/trending/popularity mechanics.

### Mobile acceptance criteria
Replies readable and moderated; privacy setting obvious.

---

## P0.1-15 — Unified Search & Creative Discovery (P0.1)

### Mobile intent
Search across creator context.

### Responsive layout
Search field pinned; entity tabs; filter chips; unified results grouped with clear entity label.

### Navigation
Global search entry from top bar.

### Primary actions
Filter by type/date/project/creator/theme; ask CreatorBrain about result set.

### Content priority
Permission-safe exact and contextual matches.

### Special rules
Do not reveal inaccessible records through counts/snippets.

### Mobile acceptance criteria
Search remains responsive with large result sets; filters survive navigation.

---

## P0.1-16 — AI Provider & BYOK Management (P0.1)

### Mobile intent
Give creators provider control.

### Responsive layout
Provider list with status cards. Key entry on dedicated secure screen. Model preferences use simple selectors.

### Navigation
Settings > AI Providers.

### Primary actions
Connect/validate/rotate/remove key, choose defaults, inspect health.

### Content priority
Provider state, data-use explanation, last validation.

### Special rules
Never display full secret after save.

### Mobile acceptance criteria
Secrets do not appear in logs/client storage; validation errors are clear.

---

## P0.1-17 — Security & Audit Viewer (P0.1)

### Mobile intent
Give creators useful transparency.

### Responsive layout
Security summary cards followed by filterable chronological audit list.

### Navigation
Settings > Privacy & Security > Audit.

### Primary actions
Filter, open event, export, review login/device/security events.

### Content priority
Actor, action, outcome, related entity, time.

### Special rules
No creative content leakage in audit previews.

### Mobile acceptance criteria
Events remain readable without tables; filters accessible by bottom sheet.

---

## P0.1-18 — Mobile Completion Pass (P0.1)

### Mobile intent
Ensure every critical flow is mobile-native.

### Responsive layout
Audit all routes for single-column behavior, thumb actions, keyboard safety, sheets, offline/error states.

### Navigation
Applies platform-wide.

### Primary actions
Not a feature action; this is a release gate.

### Content priority
Critical P0.1 flows.

### Special rules
No desktop-only blockers.

### Mobile acceptance criteria
All key flows tested at 320, 375, 390, 430, 480 px and mobile landscape where relevant.

---

## P1-01 — Project Domain (P1)

### Mobile intent
Introduce a project container without replacing materials/artifacts.

### Responsive layout
Project overview as stacked sections: hero/brief, progress, recent artifacts/material, crew, milestones.

### Navigation
Projects destination via Home/Profile/More; project-specific tab bar may be horizontal.

### Primary actions
Create/edit project, open material/artifact, invite crew, view timeline.

### Content priority
Project purpose and current work.

### Special rules
Keep creative content dominant; avoid generic PM dashboard.

### Mobile acceptance criteria
Project deletion does not delete referenced creator-owned content.

---

## P1-02 — CreatorCrew Core (P1)

### Mobile intent
Create temporary project teams.

### Responsive layout
Crew overview with member list, roles and project context. Member actions in per-row overflow.

### Navigation
Project > Crew.

### Primary actions
Invite, change role where permitted, view member, start Huddle.

### Content priority
Who is involved and why.

### Special rules
Flexible roles; do not hard-code only film roles.

### Mobile acceptance criteria
Leaving/removal preserves contribution/rights history.

---

## P1-03 — Crew Invitations & Membership Lifecycle (P1)

### Mobile intent
Manage invite/pending/accept/decline/leave/remove lifecycle.

### Responsive layout
Invitation cards and detail screen. Pending invites shown separately from active crew.

### Navigation
Notifications deep-link to invitation detail.

### Primary actions
Accept, decline, ask question, cancel invite, leave crew.

### Content priority
Role, project, permissions, rights/compensation note.

### Special rules
Invitation must be scoped and understandable.

### Mobile acceptance criteria
Status updates across devices; expired invite cannot be accepted.

---

## P1-04 — Crew Workspace (P1)

### Mobile intent
Provide shared creative project environment.

### Responsive layout
Use project header + horizontally scrollable sections: Overview, Chat, Tasks, Files, Storyboard, References, Timeline, Rights.

### Navigation
Within Project. Avoid nested permanent sidebars.

### Primary actions
Chat, open tasks, share files, open artifact, start Huddle.

### Content priority
Current creative activity.

### Special rules
Do not emulate enterprise workspace chrome.

### Mobile acceptance criteria
State persists when switching tabs; unread indicators meaningful.

---

## P1-05 — Crew Tasks & Milestones (P1)

### Mobile intent
Coordinate creative work lightly.

### Responsive layout
Default mobile list grouped by status. Board can be optional horizontal columns on large mobile/tablet. Timeline separate.

### Navigation
Project > Tasks.

### Primary actions
Add/edit/assign, change status, link artifact/material, comment.

### Content priority
Current and blocked work.

### Special rules
Not a generic task manager.

### Mobile acceptance criteria
Drag is optional; all moves possible through accessible menu.

---

## P1-06 — Collaborative Artifact Editing (P1)

### Mobile intent
Support multi-creator editing while preserving authorship.

### Responsive layout
Artifact/editor full screen. Comments/activity open bottom sheet. Presence avatars compact at top.

### Navigation
Project/artifact context.

### Primary actions
Comment, propose edit, accept/reject, create version, inspect collaborator history.

### Content priority
Artifact content before collaboration chrome.

### Special rules
Never flatten human contributions.

### Mobile acceptance criteria
Conflicts handled explicitly; offline edits do not silently overwrite.

---

## P1-07 — Contribution & Attribution Ledger (P1)

### Mobile intent
Recognize every contribution.

### Responsive layout
Summary card + chronological contribution list. Attribution and payments-later tabs can scroll horizontally.

### Navigation
Project/Crew > Contributions.

### Primary actions
Inspect contribution, edit description/attribution where permitted, export credits.

### Content priority
Contributor, contribution type, related artifact/version.

### Special rules
Percentages only when explicitly defined; do not invent them.

### Mobile acceptance criteria
Ledger remains accessible and immutable where required.

---

## P1-08 — Crew Rights & Permissions (P1)

### Mobile intent
Apply rights governance to collaborative work.

### Responsive layout
Rights summary per project/artifact, member-specific permission rows, approval requirements in accordions.

### Navigation
Project > Rights.

### Primary actions
Review ownership assertions, permissions, derivative/publication approvals.

### Content priority
Restrictions and required approvals.

### Special rules
Contribution does not automatically equal legal ownership.

### Mobile acceptance criteria
Revoked permissions block future access while preserving attribution.

---

## P1-09 — Crew Dissolution / Project Completion (P1)

### Mobile intent
Close projects safely.

### Responsive layout
Guided checklist screen: unresolved tasks, artifacts, rights, attribution, approvals, archive.

### Navigation
Project overflow > Complete/Archive/Dissolve.

### Primary actions
Resolve item, assign follow-up, confirm completion.

### Content priority
Unresolved rights/contribution issues.

### Special rules
No one-tap destructive dissolution.

### Mobile acceptance criteria
Completion preserves project history and records.

---

## P1-10 — Creator Relationships & Collaboration Intelligence (P1)

### Mobile intent
Find collaborators by project fit.

### Responsive layout
Search/filter screen with creator cards and explainable relevance snippets.

### Navigation
Project > Find collaborators or Discover.

### Primary actions
View profile, shortlist, invite, ask CreatorBrain why relevant.

### Content priority
Skills, discipline, availability, relationship context.

### Special rules
No universal creator score or popularity ranking.

### Mobile acceptance criteria
Recommendations explain source signals; privacy respected.

---

## P1-11 — Collaboration Messaging (P1)

### Mobile intent
Support project-relevant communication.

### Responsive layout
Conversation screen tied to project/artifact. Context chip at top; attachments compact.

### Navigation
Project > Chat or creator interaction.

### Primary actions
Message, attach artifact/material, draft with CreatorBrain, start Huddle.

### Content priority
Current project context.

### Special rules
Sending on creator's behalf follows autonomy.

### Mobile acceptance criteria
Draft vs sent state is obvious.

---

## P1-12 — CreatorPublish v1 (P1)

### Mobile intent
Provide coherent connected publishing.

### Responsive layout
Publishing queue as vertical cards. Prepare flow full-screen. Platform status and schedule visible.

### Navigation
Publish destination accessible from Artifact/Project/More.

### Primary actions
Prepare, customize per platform, schedule, approve, publish, retry.

### Content priority
Artifact + destination + status.

### Special rules
Never mark published before external confirmation.

### Mobile acceptance criteria
Partial failures are destination-specific.

---

## P1-13 — Publication Derivatives (P1)

### Mobile intent
Treat platform adaptations as real derivatives.

### Responsive layout
Source artifact header, derivative cards by platform, edit/review full screen.

### Navigation
Artifact > Publish/Derivatives.

### Primary actions
Generate trailer/carousel/description/thumbnail concept, review, publish.

### Content priority
Source version and destination.

### Special rules
Lineage/rights inherited.

### Mobile acceptance criteria
Every derivative links back to source.

---

## P1-14 — Creator Availability & Collaboration Profile (P1)

### Mobile intent
Let creators describe how they want to collaborate.

### Responsive layout
Profile settings screen with availability toggle, disciplines, preferred project types, location/remote, boundaries.

### Navigation
Profile > Collaboration.

### Primary actions
Edit availability, turnaround, contact preference, optional rates.

### Content priority
Availability and boundaries.

### Special rules
Rates need not be public.

### Mobile acceptance criteria
Visibility controls clear.

---

## P1-15 — Brand Affiliation Foundation (P1)

### Mobile intent
Let creators opt into brand opportunities.

### Responsive layout
Creator-side opportunity preferences and opportunity cards. Avoid brand-dashboard styling.

### Navigation
Profile/More > Brand Opportunities.

### Primary actions
Opt in/out, set niches, commercial boundaries, usage/exclusivity preferences, view opportunity.

### Content priority
Fit and terms, not vanity metrics.

### Special rules
No universal pricing score.

### Mobile acceptance criteria
Sensitive commercial details visibility-controlled.

---

## P1-16 — Campaign Domain Foundation (P1)

### Mobile intent
Represent campaign brief, creator invite, deliverable and approval.

### Responsive layout
Campaign detail screen with brief, deliverables, rights requirements, status timeline and collaboration link.

### Navigation
Brand opportunity/invitation deep link.

### Primary actions
Accept/decline/counter where enabled, submit deliverable, review approval.

### Content priority
Deliverable and rights requirement.

### Special rules
Do not fake legal/payment automation.

### Mobile acceptance criteria
Status transitions auditable.

---

## P1-17 — Commercial Rights Preparation (P1)

### Mobile intent
Prepare artifacts for commercial workflows.

### Responsive layout
Commercial rights editor as guided sections; summary at top.

### Navigation
Artifact/Campaign > Commercial Rights.

### Primary actions
Set commercial use, exclusivity, territory, duration, derivative permission, attribution.

### Content priority
Current commercial constraints.

### Special rules
No automated legal conclusion.

### Mobile acceptance criteria
Conflicting terms trigger warning before save.

---

## P1-18 — CreatorMarket Foundation (P1)

### Mobile intent
Prepare artifact listing/licensing architecture.

### Responsive layout
Marketplace browse uses visual cards; listing creation uses step flow. My Listings separated from public browse.

### Navigation
Market via More/Profile when enabled.

### Primary actions
Create listing, set price/currency/license, activate/pause, view inquiries.

### Content priority
Artifact, license model, price/availability.

### Special rules
Only expose if transaction/licensing path is production-ready.

### Mobile acceptance criteria
Private/unlisted states reliable; no accidental listing.

---

## P1-19 — CreatorBusiness Foundation (P1)

### Mobile intent
Capture creator economic events without becoming accounting software.

### Responsive layout
Overview summary cards + revenue source list + transaction feed. Charts scroll vertically.

### Navigation
Business via Profile/More.

### Primary actions
Inspect earnings, filter transactions, export report where supported.

### Content priority
Revenue sources and recent economic events.

### Special rules
Do not imply tax/accounting completeness.

### Mobile acceptance criteria
Currency formatting locale-aware; negative/refund states clear.

---

## P1-20 — Analytics Foundation (P1)

### Mobile intent
Associate outcomes with artifacts/publications.

### Responsive layout
Top KPI cards in horizontal scroll or 2×2 grid; one chart per section; top artifacts as list.

### Navigation
Analytics via Artifact/Publish/Business/Profile context.

### Primary actions
Change date range, platform, artifact, open source publication.

### Content priority
Reliable connected-platform metrics only.

### Special rules
No invented metrics or universal creator-quality score.

### Mobile acceptance criteria
Charts readable without pinch-zoom; metric definitions accessible.

---

## P1-21 — Integrations & Exports (P1)

### Mobile intent
Connect creative tools and storage providers.

### Responsive layout
Categorized integration list with connection state and concise capability description.

### Navigation
Settings > Integrations.

### Primary actions
Connect, disconnect, configure import/export scope.

### Content priority
Connection state, permissions, last sync.

### Special rules
Use provider branding only according to permitted assets/terms.

### Mobile acceptance criteria
OAuth return works on mobile; reconnect errors recoverable.

---


# 7. Cross-Story Mobile Release Checklist

Before any story is marked mobile-ready:

```text
[ ] Works at 320 px without horizontal overflow
[ ] Works at 375/390/430 px
[ ] Works with browser/app text scaling
[ ] Primary action is thumb reachable
[ ] Keyboard does not cover active fields or CTA
[ ] Safe-area insets handled
[ ] Loading state exists
[ ] Empty state exists
[ ] Error state exists
[ ] Offline/provider-unavailable state handled where relevant
[ ] Back navigation preserves safe state
[ ] Destructive actions require deliberate confirmation
[ ] Permission/RLS checks are server/domain enforced
[ ] Sensitive information excluded from lock-screen previews where applicable
[ ] Media keeps correct aspect ratio
[ ] No desktop sidebar merely squeezed into mobile
[ ] No critical action depends on hover
[ ] No drag-only interaction
[ ] All interactive controls meet touch-target guidance
[ ] Screen-reader labels exist for icons and media controls
[ ] CreatorBrain does not expose hidden chain-of-thought
[ ] Rights/provenance remain visible where materially relevant
[ ] Autonomy/approval gates remain enforced on mobile
```

---

# 8. Responsive Component Mapping

Use consistent transformations when adapting established desktop layouts.

| Desktop pattern | Mobile pattern |
|---|---|
| Left navigation sidebar | Bottom nav, top bar or contextual drawer |
| Right inspector panel | Bottom sheet or dedicated detail screen |
| 3-column workspace | Focused single column with tabs |
| Side-by-side compare | Toggle, swipe compare or sequential before/after |
| Wide data table | Stacked cards/rows with detail drill-in |
| Multi-column card grid | 1-column or readable 2-column grid |
| Permanent filters | Filter button + bottom sheet |
| Hover actions | Visible buttons or overflow menu |
| Desktop modal | Full-screen sheet/page for complex forms |
| Timeline graph | Vertical timeline; optional immersive graph |
| Kanban board | Status-grouped list; optional horizontal board |
| Complex editor toolbar | Horizontal tool strip + More sheet |
| Dense settings matrix | Stacked setting rows/cards |
| Dashboard KPI row | 2×2 grid or horizontal scroll |
| Right-side CreatorBrain | Inline contextual card/sheet |
| Large asset picker | Full-screen picker with tabs/search |

---

# 9. Mobile State Hierarchy

For any screen, prefer this order:

```text
1. Identity/context
2. Current creative work or decision
3. Primary action
4. Relevant supporting context
5. Secondary metadata
6. Advanced settings
```

Never lead with administrative metadata if the creator's work can be shown first.

---

# 10. Claude Code Implementation Rule

For each responsive implementation Claude Code should:

1. inspect the existing desktop component;
2. determine whether the desktop information architecture should remain or transform;
3. reuse domain logic and data contracts;
4. implement mobile layout without duplicating business logic;
5. use CSS/container-query/responsive primitives where appropriate;
6. avoid device-specific hardcoding;
7. preserve deep links;
8. preserve RLS/permissions/autonomy/rights behavior;
9. add mobile E2E coverage;
10. update documentation/progress only after tested behavior exists.

---

# 11. Required Mobile E2E Coverage

Minimum end-to-end scenarios:

1. Onboarding → Home.
2. Capture photo/voice → CreatorSend → material created.
3. Open material → Ask CreatorBrain → create artifact.
4. CreatorTalk → clarify intent → choose direction → artifact.
5. Artifact Studio edit → quality suggestion → new version.
6. Artifact → transform → derivative → lineage.
7. Artifact → share/export.
8. Artifact → rights → license request.
9. Approval Center → approve governed publish action.
10. Create Huddle → invite → join → end → save permitted material.
11. Search → material/artifact/person result → open.
12. Project → Crew → invite → accept → collaborate.
13. Project → task → artifact edit → contribution recorded.
14. Publish → destination-specific success/failure.
15. Privacy/security → audit event visible.
16. BYOK connect/validate/remove without exposing secret.
17. Market/Brand/Business routes only when feature flags and backend readiness permit.

---

# 12. Final Mobile Product Standard

A successful Wonder Creator mobile implementation should feel like:

> **a creative studio that happens to fit in the creator's hand**

—not a desktop dashboard squeezed into a phone.

The creator should be able to capture an idea, understand it, create, refine, collaborate, review rights, approve consequential actions, publish and continue later without learning the product's internal architecture.
