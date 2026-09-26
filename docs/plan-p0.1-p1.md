# Wonder Creator --- Post-V1 P0.1 & P1 Claude Code Implementation Plan

**Date:** 26 September 2026\
**Purpose:** Implementation-ready backlog to give Claude Code **after
the currently identified V1/P0 completion items are closed**.

> This document starts from the existing Wonder Creator product
> decisions. It does not reopen product discovery.
>
> **Assumption for starting this plan:** the current completion list has
> already been closed, including CreatorSend malware scanning, the
> complete notifications experience, final supplied-brand-asset
> integration, and production configuration/verification of AI and
> live-media providers.

------------------------------------------------------------------------

## 1. Product principles that are non-negotiable

Wonder Creator is a creator-first platform built around **Creator +
Creative Material + Artifact**, with **CreatorBrain as the
intelligence/orchestration layer**.

Preserve these principles in every implementation decision:

1.  **Artist first** --- creators should not need to understand internal
    product structure before creating.
2.  **Human first** --- the creator should feel understood, not like
    they are operating enterprise software.
3.  **Work first** --- creative material and artifacts dominate the
    experience.
4.  **Context first** --- continuity between material, artifacts,
    projects, people, rights and outcomes is the moat.
5.  **Artifact first for economics** --- artifacts are the primary
    creative/economic objects.
6.  **CreatorBrain orchestrates; domain modules own truth.**
7.  **Be bold with creativity. Be conservative with consequences.**
8.  **No generic social-media gamification.**
9.  **Architecture remains modular packages, not microservices.**
10. **Security, privacy, permissions, rights, provenance and audit are
    first-class.**

### Branding constraint

Use only supplied Wonder Creator brand assets and supplied
high-resolution backgrounds.

Do **not**: - generate a replacement logo; - redesign the logo; - invent
new brand artwork; - generate replacement botanical/background
imagery; - substitute stock imagery.

If a required asset is missing, record it as an explicit dependency and
stop that asset-dependent implementation.

------------------------------------------------------------------------

# PART A --- P0.1

## 2. P0.1 objective

P0.1 is the **production-hardening and continuity-completion release
immediately after V1**.

It should not introduce the full CreatorCrew, CreatorBrand,
CreatorMarket or CreatorBusiness products.

Its job is to make the existing core feel complete, trustworthy and
connected before larger economic/collaboration systems are layered on
top.

### P0.1 exit condition

A creator should be able to:

**Bring material → have it understood → discover possibilities →
create/refine an artifact → understand provenance/rights → collaborate
safely → share/export/publish through governed actions → return later
and continue with context intact.**

------------------------------------------------------------------------

## 3. P0.1-01 --- Creative Material Detail

### Goal

Make each Creative Material item a first-class inspectable object rather
than only a library card.

### Required capabilities

-   Material detail route/view.
-   Preview appropriate to material type.
-   Original filename/source.
-   Material type and MIME type.
-   Created/imported/captured timestamps.
-   Creator/owner.
-   Description.
-   CreatorBrain-generated understanding.
-   Extracted metadata.
-   Tags/themes/entities where applicable.
-   Related collections.
-   Related artifacts.
-   Related projects/context.
-   Provenance/source URL where applicable.
-   Processing state.
-   Privacy/visibility state.
-   Rights/source notes.
-   Actions:
    -   Use in creation
    -   Ask CreatorBrain
    -   Add to Reference Shelf
    -   Add to collection
    -   Edit metadata
    -   Archive
    -   Delete with governed confirmation
    -   Download/export original where allowed

### Domain requirements

Creative Material remains owned by the library/material domain.
CreatorBrain may enrich it but must not become its source of truth.

### Acceptance criteria

-   Every material card can open a detail view.
-   Material provenance survives artifact creation.
-   Deleting material cannot silently corrupt artifact provenance.
-   Access is protected by RLS/authorization.
-   Unsupported previews degrade gracefully.

------------------------------------------------------------------------

## 4. P0.1-02 --- Material Collections

### Goal

Let creators organize material without forcing rigid project structures.

### Required capabilities

-   Create collection.
-   Rename/archive/delete collection.
-   Add/remove materials.
-   Multi-select material.
-   Collection cover/representative image where available.
-   Collection description.
-   Search/filter within collection.
-   Manual ordering or stable default ordering.
-   Reference collections such as:
    -   Film References
    -   Visual Style
    -   Music Inspiration
    -   Writing References
    -   Locations
    -   People
-   "Use collection in creation."
-   "Ask CreatorBrain about this collection."

### Data model

Collections must reference materials rather than duplicate material
records.

### Acceptance criteria

-   One material can belong to multiple collections.
-   Removing from collection does not delete original material.
-   Collection permissions cannot broaden access to private material
    accidentally.
-   Collection usage is represented in downstream provenance.

------------------------------------------------------------------------

## 5. P0.1-03 --- CreatorBrain Intent Clarification

### Goal

Reduce wrong-generation paths when the creator's request is ambiguous.

### Behavior

CreatorBrain should decide whether it has enough information to proceed.

When clarification is materially useful, ask concise creator-centered
questions such as: - intended outcome; - artifact format; - audience; -
tone; - duration/length; - which supplied material matters most; -
whether to preserve or experiment with the creator's usual style.

### Rules

-   Do not interrogate the creator unnecessarily.
-   Infer safe creative defaults when confidence is sufficient.
-   Consequential assumptions must not be silently made.
-   Display the understood intent in editable form before
    expensive/long-running generation where useful.

### Suggested model

`IntentAssessment` - intent - confidence - missing_information\[\] -
safe_assumptions\[\] - consequential_assumptions\[\] -
clarification_required - recommended_next_action

### Acceptance criteria

-   Ambiguous requests can produce clarification.
-   Clear requests proceed without unnecessary questions.
-   Creator can correct CreatorBrain's interpretation.
-   Corrected intent becomes part of the run context/audit trail.

------------------------------------------------------------------------

## 6. P0.1-04 --- Creation Run Progress

### Goal

Make long-running creation understandable without exposing raw
chain-of-thought.

### Stages

-   Understanding
-   Gathering context
-   Researching, if authorized
-   Planning
-   Generating
-   Critiquing
-   Refining
-   Validating
-   Rendering/finalizing

### UI requirements

Show: - current stage; - useful status message; - progress where
measurable; - cancel/stop where safe; - recoverable error state; -
retry; - completed outputs; - provider-unavailable state.

Do **not** expose hidden reasoning or private chain-of-thought.

### Acceptance criteria

-   Long-running jobs never look frozen.
-   Failed runs preserve useful state.
-   Retry does not create accidental duplicate artifacts.
-   Cancellation has deterministic semantics.

------------------------------------------------------------------------

## 7. P0.1-05 --- Creative Quality Review & Selective Refinement

### Goal

Turn the quality pipeline into an actionable creator workflow.

### Checks may include

-   story structure;
-   character consistency;
-   visual coherence;
-   dialogue quality;
-   pacing;
-   originality considerations;
-   rights/provenance.

### Required interactions

-   Show findings in creator-friendly language.
-   Allow creator to select individual suggestions.
-   Apply selected suggestions only.
-   Preview proposed changes.
-   Regenerate with changes.
-   Preserve a new artifact version.
-   Compare before/after.
-   Allow rejection of suggestions.

### Critical rule

Quality checks advise the creator; they must not silently overwrite
authored work.

### Acceptance criteria

-   Applying quality changes always creates traceable version history.
-   Creator can identify what changed and why.
-   Rights/provenance warnings cannot be hidden by regeneration.

------------------------------------------------------------------------

## 8. P0.1-06 --- Artifact Transformation Workflow

### Goal

Make "Create from this" a complete workflow.

### Required transformations

The system architecture should support transformations such as: - story
→ script; - script → storyboard; - script → social posts/carousel; -
video → trailer; - poem → lyrics; - artifact → artwork/cover concept; -
short film → documentary treatment; - artifact → pitch deck; - artifact
→ podcast script; - artifact → social series.

Not every transformation requires a dedicated model. Use the existing
artifact-generation abstraction.

### Required behavior

-   Select source artifact/version.
-   Select transformation.
-   Add optional instruction.
-   Show inherited context.
-   Generate derivative.
-   Record lineage edge.
-   Preserve source references/contributors/rights.
-   Require creator review before consequential publication.

### Acceptance criteria

Every derivative can answer: - what was I created from? - which source
version? - which material/references contributed? - who contributed? -
what rights constraints followed me?

------------------------------------------------------------------------

## 9. P0.1-07 --- Rights Detail & Rights History

### Goal

Move rights from a summary card into a trustworthy record.

### Required sections

-   Ownership
-   Copyright
-   Licenses
-   Usage rights
-   Attribution
-   Contributors
-   Provenance
-   Rights history
-   Publication history where relevant

### Rights history

Record append-only events such as: - rights record created; - ownership
assertion updated; - license created; - license
accepted/revoked/expired; - attribution changed; - publication
occurred; - derivative created; - rights approval granted/declined.

### Important product rule

The UI must state appropriately that platform records do not themselves
establish legal ownership; legal effect depends on agreements and
jurisdiction.

### Acceptance criteria

-   Rights changes are auditable.
-   Historical rights state is not silently rewritten.
-   Artifact derivative creation checks inherited restrictions.
-   Rights access follows artifact permissions.

------------------------------------------------------------------------

## 10. P0.1-08 --- License Creation & License Request

### Goal

Support creator-controlled licensing before a full marketplace exists.

### License modes

Prepare the domain for: - free; - free with license; - paid
non-exclusive; - limited edition; - exclusive/single-owner.

### License dimensions

-   permitted use;
-   commercial/non-commercial;
-   editorial;
-   educational;
-   promotional;
-   internal;
-   modification;
-   derivative works;
-   attribution;
-   resale;
-   exclusivity;
-   territory;
-   duration.

### Workflow

Creator:
`Artifact → Rights → Create License → Configure Terms → Review → Activate`

Requester:
`Artifact → Request License → Proposed Use → Creator Review → Approve/Decline/Counter → Record Outcome`

### Governance

No acceptance of paid/exclusive/rights-transfer terms should
auto-execute unless the creator's autonomy policy explicitly permits it
and all required legal/commercial checks exist.

------------------------------------------------------------------------

## 11. P0.1-09 --- Artifact Share / Download / Export

### Goal

Complete the artifact lifecycle without requiring publishing.

### Required actions

-   private share link;
-   collaborator share;
-   download;
-   export;
-   embed where supported;
-   copy link;
-   revoke share;
-   expiration where supported.

### Export

Support appropriate formats per artifact type rather than pretending
every artifact supports every format.

### Security

-   Signed/expiring URLs where appropriate.
-   Revocation.
-   Permission checks.
-   Audit events.
-   No leakage of private source material through public derivative
    metadata.

------------------------------------------------------------------------

## 12. P0.1-10 --- Publishing Setup & Governed Publish Action

### Goal

Create the minimum complete publishing layer before full CreatorPublish.

### Scope

-   Connected platform/account registry.
-   Per-artifact publishing destinations.
-   Publishing preparation.
-   Caption/title/description fields.
-   Visibility.
-   Schedule metadata.
-   Creator approval.
-   Publish attempt.
-   Result/failure.
-   Publication history.

### CreatorBrain

May: - suggest platforms; - draft captions; - adapt artifact metadata; -
prepare a publishing plan.

Must follow autonomy settings before external execution.

### Domain events

At minimum: - PublicationPrepared - PublicationApprovalRequested -
PublicationApproved - PublicationAttempted - ArtifactPublished -
PublicationFailed

### Acceptance criteria

-   Publishing is never represented as successful before provider
    confirmation.
-   External IDs/URLs are recorded.
-   Retry is idempotent where possible.
-   Publication outcome enters Creative Context.

------------------------------------------------------------------------

## 13. P0.1-11 --- Approval Center

### Goal

Give governed actions one coherent place to be reviewed.

### Covers

-   collaboration invitations;
-   Huddle join requests where applicable;
-   publishing;
-   licensing;
-   rights changes;
-   external communication;
-   destructive actions;
-   future commerce actions.

### Required states

-   Pending
-   Approved
-   Declined
-   Expired
-   Cancelled
-   Executed
-   Failed

### UI

Approval cards should explain: - what CreatorBrain wants to do; - why; -
target; - consequences; - relevant artifact/project; - rights
implications; - cost if any; - expiration; - approve/decline/edit.

### Acceptance criteria

-   Approval is scoped to the exact proposed action.
-   Approval cannot be reused for materially different parameters.
-   Every approval decision is audited.

------------------------------------------------------------------------

## 14. P0.1-12 --- Autonomy Approval UX

### Goal

Connect domain autonomy settings to real actions.

### Required behavior

When an action is blocked by autonomy policy: 1. create proposed action;
2. show approval request; 3. creator can approve once, decline, or edit;
4. execute only after valid approval; 5. record outcome.

### Domains

-   Creative Generation
-   Research
-   Transformation
-   Organization
-   Collaboration
-   Communication
-   Publishing
-   Commerce
-   Rights
-   Destructive Actions

### Acceptance criteria

Changing autonomy level affects subsequent actions, not retroactively
approved actions.

------------------------------------------------------------------------

## 15. P0.1-13 --- Huddle Creation, Invitation & Post-Huddle

### Goal

Complete the lifecycle around the already-established live Huddle.

### Create

-   title/topic;
-   optional description;
-   visibility;
-   participant/invite rules;
-   optional related material/artifact;
-   start now.

### Invite

-   creator search;
-   invitation;
-   pending/accepted/declined;
-   join request approval.

### End

When Huddle ends: - preserve participant/history metadata; - optionally
save transcript/notes only when permitted; - select moments/material to
save; - create Creative Material from permitted output; - suggest next
actions; - preserve relationship history.

### Privacy

Do not assume recording/transcription consent.

------------------------------------------------------------------------

## 16. P0.1-14 --- Scrapbook Detail & Replies

### Goal

Complete the human creative-expression surface without turning it into
conventional social media.

### Required capabilities

-   post thought/reflection/sketch/fragment;
-   attach permitted creative material;
-   reply;
-   reply permissions;
-   delete own post;
-   report;
-   block;
-   public/read-only/private controls.

### Explicitly do not add

-   likes;
-   dislikes;
-   popularity score;
-   trending score;
-   engagement farming;
-   follower-centric ranking.

### Acceptance criteria

Discovery ranking must not become disguised vanity scoring.

------------------------------------------------------------------------

## 17. P0.1-15 --- Search & Unified Creative Discovery

### Goal

Allow creators to find their own work and relevant platform entities
without building a generic global search engine.

### Searchable entities

-   material;
-   artifacts;
-   conversations;
-   collections;
-   references;
-   creators;
-   Huddles;
-   projects when introduced;
-   Scrapbook where permitted.

### Search dimensions

-   text;
-   type;
-   creator;
-   discipline;
-   date;
-   tags/themes;
-   project/context;
-   visibility/access.

### CreatorBrain integration

Natural-language retrieval may call domain search tools, but
authorization remains in the owning domain.

------------------------------------------------------------------------

## 18. P0.1-16 --- AI Provider & BYOK Management

### Goal

Turn provider abstraction into understandable creator control.

### Required capabilities

-   configured providers;
-   platform-managed provider state;
-   BYOK where supported;
-   encrypted secret storage;
-   key validation;
-   model availability;
-   provider health;
-   default model preferences where product-approved;
-   remove/rotate key;
-   data-use explanation;
-   provider failure state.

### Security

-   Never expose full secret after entry.
-   Never send a BYOK secret to unauthorized logs/analytics.
-   Audit secret lifecycle events without logging the secret itself.

------------------------------------------------------------------------

## 19. P0.1-17 --- Security & Audit Viewer

### Goal

Give creators meaningful transparency without exposing internal security
implementation.

### Audit categories

-   sign-in/security events;
-   material access/share;
-   artifact access/share;
-   publishing;
-   licensing/rights;
-   approvals;
-   autonomy changes;
-   provider configuration;
-   export/deletion;
-   Huddle/collaboration actions.

### Required controls

-   filter;
-   date range;
-   event detail;
-   actor;
-   outcome;
-   related entity;
-   export where appropriate.

------------------------------------------------------------------------

## 20. P0.1-18 --- Mobile Completion Pass

### Goal

Ensure all critical P0.1 workflows have purpose-built mobile
experiences.

### Priority mobile flows

-   material detail;
-   collection add/remove;
-   CreatorBrain clarification;
-   creation progress;
-   quality suggestions;
-   artifact transformation;
-   approval prompts;
-   share/export;
-   Huddle create/invite/end;
-   notifications/approval inbox;
-   privacy/provider controls appropriate for mobile.

### Rule

Do not shrink desktop layouts. Use mobile-native capture, sheets, bottom
actions and focused flows.

------------------------------------------------------------------------

# PART B --- P1

## 21. P1 objective

P1 begins expanding Wonder Creator from a powerful individual creative
environment into a **collaborative creative operating environment**.

The primary P1 product is **CreatorCrew**, supported by stronger
projects, collaboration, rights/contribution tracking and an initial
CreatorPublish layer.

CreatorBrand, CreatorMarket and CreatorBusiness should begin only where
their foundations are necessary for coherent P1 workflows. Do not
prematurely build full marketplaces or financial suites.

------------------------------------------------------------------------

## 22. P1-01 --- Project Domain

### Goal

Introduce an explicit project container without replacing Creative
Material or Artifact.

### Project contains/references

-   brief;
-   goals;
-   status;
-   creator/owner;
-   members;
-   material;
-   references;
-   artifacts;
-   conversations;
-   Huddles;
-   tasks;
-   milestones;
-   rights context;
-   approvals;
-   budget metadata where enabled.

### Suggested statuses

-   Idea
-   Active
-   Paused
-   Completed
-   Archived

### Principles

-   Materials and artifacts remain their own domain objects.
-   A project references them.
-   CreatorBrain can assemble project context.
-   Project deletion must not silently delete owned artifacts/material.

------------------------------------------------------------------------

## 23. P1-02 --- CreatorCrew Core

### Goal

Create temporary project teams for real creative work.

### Workflow

`Create Crew → Define Project → Invite → Pending → Accept / Decline / Ask Question → Collaborate → Complete/Dissolve`

### Crew capabilities

-   crew name;
-   linked project;
-   purpose/brief;
-   members;
-   flexible roles;
-   status;
-   activity;
-   shared material;
-   shared artifacts;
-   conversations;
-   Huddles;
-   permissions.

### Roles

Do not hard-code only conventional production roles. Allow flexible
creator-defined roles while supporting common examples: - director; -
cinematographer; - writer; - musician; - editor; - visual artist; -
designer; - producer.

------------------------------------------------------------------------

## 24. P1-03 --- Crew Invitations & Membership Lifecycle

### Required states

-   invited;
-   pending;
-   accepted;
-   declined;
-   question/request for clarification;
-   active;
-   left;
-   removed.

### Requirements

-   invitation scope;
-   inviter;
-   project/crew context;
-   proposed role;
-   permissions;
-   compensation note if applicable;
-   rights expectations;
-   expiration.

### Exit behavior

When someone leaves/is removed, preserve: - contributions; -
attribution; - rights; - compensation records where present; - history.

------------------------------------------------------------------------

## 25. P1-04 --- Crew Workspace

### Sections

-   Overview
-   Brief
-   Material
-   Artifacts
-   Tasks
-   Calendar/Milestones
-   Conversations
-   Huddles
-   People
-   Rights
-   Approvals
-   Files/References
-   Budget, only when enabled

### UX principle

This must still feel like a creative studio, not Jira or enterprise
project management.

------------------------------------------------------------------------

## 26. P1-05 --- Crew Tasks & Milestones

### Goal

Support creative coordination without becoming a generic task manager.

### Task fields

-   title;
-   description;
-   assignee(s);
-   artifact/material relation;
-   due date;
-   status;
-   dependency;
-   comments/context;
-   approval requirement.

### Suggested statuses

-   To do
-   In progress
-   Review
-   Done
-   Blocked

### CreatorBrain

May: - suggest tasks; - identify missing steps; - draft a production
plan; - summarize progress.

It must not assign commitments to collaborators without appropriate
authorization.

------------------------------------------------------------------------

## 27. P1-06 --- Collaborative Artifact Editing

### Goal

Allow multiple creators to contribute while preserving authorship and
lineage.

### Required capabilities

-   collaborator access;
-   comments/feedback;
-   proposed changes;
-   versions;
-   attribution;
-   activity history;
-   conflict-safe edits appropriate to artifact type;
-   creator approval where required.

### Non-negotiable

Never flatten collaborative contribution history into a single anonymous
"AI generated" artifact.

------------------------------------------------------------------------

## 28. P1-07 --- Contribution & Attribution Ledger

### Goal

Create a durable record of who contributed what.

### Record

-   contributor;
-   contribution type;
-   related material/artifact/version;
-   timestamp;
-   description;
-   attribution requirement;
-   rights relationship;
-   compensation relationship when present.

### Use

This becomes foundational for: - credits; - rights; - licensing; -
collaboration history; - future revenue splits.

------------------------------------------------------------------------

## 29. P1-08 --- Crew Rights & Permissions

### Goal

Apply Wonder Creator's rights philosophy to collaborative work.

### Required capabilities

-   artifact ownership assertions;
-   joint contribution records;
-   contributor permissions;
-   derivative permissions;
-   publication approval requirements;
-   attribution;
-   license restrictions;
-   rights history.

### Guardrail

Do not infer legal ownership merely from contribution. Record
assertions/agreements and clearly distinguish platform records from
legal determinations.

------------------------------------------------------------------------

## 30. P1-09 --- Crew Dissolution / Project Completion

### Workflow

`Complete Project / Dissolve Crew → Review unresolved tasks → Review artifacts → Review rights → Review attribution → Review approvals → Archive`

### Preserve

-   project;
-   artifacts;
-   material references;
-   contribution history;
-   rights;
-   approvals;
-   financial records if any;
-   audit history.

------------------------------------------------------------------------

## 31. P1-10 --- Creator Relationships & Collaboration Intelligence

### Goal

Make creator discovery useful for collaboration rather than popularity.

### Search dimensions

-   discipline;
-   skills;
-   location;
-   interests;
-   experience;
-   availability;
-   existing relationship;
-   project need.

### CreatorBrain capabilities

Examples: - "Find three cinematographers in my network who fit this
project." - Explain why each person is relevant using factual
profile/context signals. - Never produce a universal creator score.

### Guardrail

Avoid popularity ranking as the primary recommendation mechanism.

------------------------------------------------------------------------

## 32. P1-11 --- Collaboration Messaging / Communication

### Goal

Support project-relevant communication.

### Scope

-   direct project/crew conversation;
-   artifact-linked discussion;
-   invitation questions;
-   approval discussion;
-   Huddle handoff;
-   notification integration.

### CreatorBrain

May draft messages. Sending messages is a consequential external action
governed by autonomy.

------------------------------------------------------------------------

## 33. P1-12 --- CreatorPublish v1

### Goal

Expand P0.1 publishing preparation into a coherent publishing domain.

### Capabilities

-   connected platforms;
-   publishing preferences;
-   per-platform preparation;
-   scheduling;
-   publication queue;
-   publication history;
-   status/failures;
-   platform-specific metadata;
-   creator approval;
-   artifact-to-publication relationship.

### CreatorBrain

Can propose: - where to publish; - platform adaptations; -
captions/descriptions; - sequence/schedule.

No autonomous publishing beyond configured creator policy.

------------------------------------------------------------------------

## 34. P1-13 --- Publication Derivatives

### Goal

Treat platform-specific adaptations as derivatives, not disposable text.

Examples: - short film → trailer; - film → Instagram carousel; - poem →
visual post; - article → LinkedIn post; - artifact → YouTube
description; - artifact → thumbnail concept.

### Requirements

-   lineage;
-   source version;
-   publication destination;
-   rights;
-   creator approval;
-   performance link when analytics arrive later.

------------------------------------------------------------------------

## 35. P1-14 --- Creator Availability & Collaboration Profile

### Goal

Let creators indicate how they want to collaborate.

### Fields

-   available/not available;
-   disciplines;
-   preferred project types;
-   collaboration interests;
-   geography/remote;
-   languages;
-   typical turnaround;
-   contact/invitation preference;
-   commercial boundaries;
-   optional rate guidance;
-   rights/exclusivity preferences.

Do not force creators to expose rates publicly.

------------------------------------------------------------------------

## 36. P1-15 --- Brand Affiliation Foundation

### Goal

Prepare for CreatorBrand without building the entire brand marketplace.

### Creator-side capability

Creator may opt into brand opportunities and define: -
niches/categories; - industries; - geography; - languages; -
expertise; - platforms; - availability; - prior collaborations; -
deliverables; - turnaround; - commercial boundaries; - exclusivity
constraints; - usage-right preferences.

### Explicitly defer

Full brand campaign marketplace, automated pricing, payment and
large-scale brand portal can remain beyond this P1 slice unless
separately approved.

------------------------------------------------------------------------

## 37. P1-16 --- Campaign Domain Foundation

### Goal

Establish a domain model capable of later supporting:

`Brand → Campaign → Creator Discovery → Shortlist → Invite → Negotiation → Agreement → Collaboration Workspace → Content → Approval → Publication → Analytics → Payment`

### P1 implementation

Implement only the pieces required for: - campaign brief; - creator
invitation; - proposed deliverable; - status; - usage-right
requirement; - collaboration workspace link; - approval state.

Do not implement unsupported payment/legal automation.

------------------------------------------------------------------------

## 38. P1-17 --- Commercial Rights Preparation

### Goal

Make artifact rights ready for future CreatorMarket/Brand workflows.

### Support

-   commercial-use permission;
-   exclusivity;
-   territory;
-   duration;
-   derivative permission;
-   attribution;
-   usage channels;
-   license status;
-   request/offer lifecycle.

### Guardrail

No universal automated legal conclusions.

------------------------------------------------------------------------

## 39. P1-18 --- CreatorMarket Foundation

### Goal

Create architecture, not a premature full marketplace.

### Domain preparation

-   listing concept;
-   artifact eligibility;
-   license offering;
-   availability;
-   price metadata;
-   currency;
-   exclusive/non-exclusive;
-   quantity/edition where relevant;
-   listing state;
-   seller/creator;
-   rights linkage.

### P1 UI

Only expose this if the underlying transaction/licensing path is
production-ready.

Otherwise keep domain/schema/event preparation behind feature flags.

------------------------------------------------------------------------

## 40. P1-19 --- CreatorBusiness Foundation

### Goal

Capture economic events generated by Wonder Creator domains without
becoming accounting software.

### Initial records

-   brand income;
-   artifact sale;
-   license income;
-   collaboration compensation;
-   platform/provider cost where appropriate;
-   payout state where applicable.

### Principle

CreatorBusiness consumes economic domain events; it should not own
artifact/rights/campaign truth.

------------------------------------------------------------------------

## 41. P1-20 --- Analytics Foundation

### Goal

Associate outcomes with artifacts and publications.

### Initial metrics

Only ingest metrics reliably supplied by connected platforms.

Potential dimensions: - artifact; - derivative; - publication; -
platform; - date; - views; - engagement metrics where provided; -
commercial outcome where available.

### Guardrails

-   Do not invent unavailable metrics.
-   Do not collapse creators into a single "quality" or "value" score.
-   Distinguish platform metrics from Wonder Creator interpretations.

------------------------------------------------------------------------

# PART C --- Cross-cutting engineering requirements

## 42. Architecture

Continue with:

``` text
apps/
└── web/

packages/
├── core/
├── creator-brain/
├── creator-send/
├── creator-talk/
├── creator-studio/
├── creator-library/
├── creator-identity/
├── creator-crew/
├── creator-brand/
├── creator-market/
├── creator-rights/
├── creator-publish/
├── creator-business/
├── creator-scrapbook/
└── module-registry/
```

### Rules

-   One web application.
-   One primary database/Supabase project unless architecture is
    explicitly changed later.
-   Packages, not premature microservices.
-   Domain packages own their records and invariants.
-   Cross-domain coordination through explicit
    services/contracts/events.
-   CreatorBrain calls domain tools; it does not bypass domain
    authorization.

------------------------------------------------------------------------

## 43. Event model additions

Add events only when backed by implemented domain behavior.

Potential P0.1/P1 events:

``` text
MaterialCollectionCreated
MaterialAddedToCollection
MaterialRemovedFromCollection

CreationRunStarted
CreationRunCompleted
CreationRunFailed
ArtifactQualityReviewed
ArtifactTransformed

LicenseCreated
LicenseRequested
LicenseApproved
LicenseDeclined
LicenseExpired

ApprovalRequested
ApprovalApproved
ApprovalDeclined
ApprovalExpired
GovernedActionExecuted
GovernedActionFailed

HuddleInvited
HuddleInvitationAccepted
HuddleMaterialSaved

ArtifactShared
ArtifactShareRevoked
ArtifactExported

PublicationPrepared
PublicationApprovalRequested
PublicationApproved
PublicationAttempted
ArtifactPublished
PublicationFailed

ProjectCreated
ProjectCompleted
CrewCreated
CrewMemberInvited
CrewMemberAccepted
CrewMemberDeclined
CrewMemberLeft
CrewMemberRemoved
CrewDissolved

ContributionRecorded
AttributionUpdated

CampaignCreated
CampaignCreatorInvited
CampaignDeliverableSubmitted
CampaignDeliverableApproved

MarketListingCreated
ArtifactLicensed
ArtifactSold

EconomicEventRecorded
```

Events must not be emitted optimistically for actions that have not
actually completed.

------------------------------------------------------------------------

## 44. CreatorBrain tool boundaries

For every tool define:

-   tool name;
-   owning domain;
-   input schema;
-   output schema;
-   permission requirement;
-   autonomy domain;
-   minimum autonomy level;
-   whether approval is required;
-   idempotency behavior;
-   audit behavior;
-   failure behavior.

### Example categories

**Safe cognitive tools** - search material; - retrieve artifact
context; - search references; - compare versions; - draft
transformation; - critique artifact.

**Governed operational tools** - invite collaborator; - send message; -
publish artifact; - create/accept license; - sell/list artifact; -
change rights; - delete material/artifact; - commit budget.

------------------------------------------------------------------------

## 45. Permissions

At minimum account for:

-   owner;
-   collaborator;
-   crew member;
-   invited/pending member;
-   viewer;
-   public;
-   platform worker/service role.

Permission must be checked at the owning domain boundary, not only in
UI.

------------------------------------------------------------------------

## 46. RLS and security

Every new creator-owned table requires explicit RLS policy review.

Test: - creator A cannot read creator B private records; - creator A
cannot mutate creator B records; - collaborator access is limited to
granted scope; - revoked membership removes future access; - historical
attribution remains without granting ongoing content access; -
service-role paths are server-only; - signed URLs expire correctly; -
secrets never reach client bundles; - audit logs do not contain secrets
or unnecessary creative content.

------------------------------------------------------------------------

## 47. Privacy

New P0.1/P1 features must respect: - private by default; - explicit
visibility; - AI data preferences; - provider controls; - retention; -
export; - deletion; - collaborator access; - consent for Huddle
recording/transcription; - creator-controlled public profile exposure.

------------------------------------------------------------------------

## 48. Rights and provenance

Any feature that creates or transforms an Artifact must propagate: -
source material references; - source artifact/version; - contributors; -
provenance; - relevant rights restrictions; - licenses where
applicable; - publication history.

Never sever lineage merely because a derivative is exported or
published.

------------------------------------------------------------------------

## 49. Observability

Instrument: - request/run ID; - creator/user ID using privacy-safe
identifiers; - domain action; - provider; - model where relevant; -
latency; - status; - error class; - approval ID when applicable; -
artifact/material/project IDs; - retry count.

Do not log: - API secrets; - full private creative content by default; -
hidden chain-of-thought.

------------------------------------------------------------------------

## 50. Testing requirements

Each item should include:

### Unit tests

Domain rules and pure logic.

### Integration tests

Database/RLS/storage/events/provider adapters.

### E2E tests

Critical creator flows on desktop and mobile.

### Security tests

Cross-tenant access, permission escalation, revoked access and
governed-action bypass.

### Failure tests

Provider unavailable, upload failure, generation failure, duplicate
callback, expired approval, revoked share, partial publication failure.

------------------------------------------------------------------------

# PART D --- Implementation order

## 51. Recommended P0.1 sequence

``` text
P0.1-A
Material Detail
→ Collections
→ Search

P0.1-B
Intent Clarification
→ Creation Progress
→ Quality Review
→ Transformations

P0.1-C
Rights Detail
→ License Creation/Request
→ Approval Center
→ Autonomy Approval UX

P0.1-D
Share/Export
→ Publishing Setup
→ Audit Viewer

P0.1-E
Huddle Create/Invite/Post-Huddle
→ Scrapbook Detail/Replies
→ Mobile completion

P0.1-F
Provider/BYOK management
→ security regression
→ performance/accessibility/reliability release gate
```

Do not begin P1 until P0.1 rights, approvals, provenance and permissions
are stable.

------------------------------------------------------------------------

## 52. Recommended P1 sequence

``` text
P1-A
Project Domain
→ CreatorCrew Core
→ Invitations/Membership

P1-B
Crew Workspace
→ Tasks/Milestones
→ Collaborative Artifact Editing
→ Contribution Ledger

P1-C
Crew Rights/Permissions
→ Project Completion/Crew Dissolution

P1-D
Relationship/Collaboration Intelligence
→ Collaboration Communication
→ Availability Profile

P1-E
CreatorPublish v1
→ Publication Derivatives
→ Analytics Foundation

P1-F
Brand Affiliation Foundation
→ Campaign Foundation
→ Commercial Rights Preparation

P1-G
CreatorMarket Foundation
→ CreatorBusiness Foundation
```

------------------------------------------------------------------------

# PART E --- Claude Code execution protocol

## 53. Before implementing each backlog item

Claude Code must:

1.  Inspect the existing repository and reuse established patterns.
2.  Identify the owning domain package.
3.  Identify existing DB tables, migrations, actions, APIs and events
    that overlap.
4.  Identify existing UI before creating a new screen.
5.  Avoid duplicate routes/components/domain concepts.
6.  State dependencies.
7.  State security/RLS impact.
8.  State rights/provenance impact.
9.  State CreatorBrain/autonomy impact.
10. State tests required.

------------------------------------------------------------------------

## 54. Per-item implementation checklist

For each item produce:

``` text
[ ] Scope confirmed
[ ] Existing implementation inspected
[ ] Domain owner identified
[ ] Data model/migration designed
[ ] RLS/permissions designed
[ ] Domain service/actions implemented
[ ] Events implemented
[ ] CreatorBrain tools updated if applicable
[ ] Autonomy/approval checks added if applicable
[ ] Rights/provenance propagation verified
[ ] Desktop UI implemented
[ ] Mobile UI implemented where required
[ ] Empty/loading/error/offline states implemented
[ ] Accessibility checked
[ ] Unit tests
[ ] Integration tests
[ ] E2E tests
[ ] Security regression tests
[ ] Documentation updated
[ ] progress.md updated
```

------------------------------------------------------------------------

## 55. Definition of Done

An item is not "Done" merely because a screen renders.

It is Done only when:

-   domain behavior is implemented;
-   persistence exists where required;
-   authorization/RLS is correct;
-   CreatorBrain uses governed domain tools rather than bypassing rules;
-   autonomy/approval is enforced where applicable;
-   rights/provenance are preserved;
-   error/offline states are honest;
-   mobile behavior is considered;
-   tests pass;
-   audit/events are correct;
-   documentation reflects actual behavior;
-   no mock or fake success state remains in production paths.

------------------------------------------------------------------------

# PART F --- Explicitly deferred beyond this plan

Unless separately approved, do not turn P0.1/P1 into:

-   a generic social network;
-   follower/engagement gamification;
-   a universal creator scoring system;
-   a full accounting product;
-   a full legal-contract automation platform;
-   a speculative marketplace without production-ready rights/payment
    foundations;
-   dozens of microservices;
-   a replacement for Adobe/Figma/DAWs/pro editing tools;
-   an autonomous system that publishes, sells, licenses, contacts third
    parties, transfers rights or deletes work without the creator's
    configured authorization.

------------------------------------------------------------------------

## 56. Final product checkpoint

At the end of P1, Wonder Creator should have evolved from a strong
individual creative environment into a coherent collaborative creative
operating environment:

``` text
Creator
  ↓
Creative Material
  ↓
CreatorBrain understands context and intent
  ↓
Discover / Create / Refine
  ↓
Artifact + Versions + Lineage + Rights
  ↓
Project + CreatorCrew + Contributions
  ↓
Governed Collaboration / Publishing / Licensing
  ↓
Outcomes return to Creative Context
```

The product should still feel like **a calm creative studio centered on
the creator and their work**, not an enterprise dashboard.

------------------------------------------------------------------------

## 57. Source-of-truth rule

If implementation details in the repository conflict with this backlog:

1.  preserve already-approved Wonder Creator product principles;
2.  inspect the current implementation before changing architecture;
3.  do not silently invent missing product requirements;
4.  document the conflict;
5.  choose the smallest compatible change unless a product decision is
    required.

For brand assets, missing supplied assets remain dependencies; never
generate replacements.
