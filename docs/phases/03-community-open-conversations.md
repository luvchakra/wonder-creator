# Wonder Creator — Phase 03
## Community + Open Conversations

**Sequence:** 3 of 5
**Depends on:** Phase 01 Moments/DejaVu, Phase 02 Home contracts
**Blocks:** Full Community → CreativeStudio workflows

(Owner spec, supplied 29 Sep 2026. Reference board: `boards/phases-overview-2026-09-29.png`, boards 5–6, 11.)

## 1. Goal

Add Community as a creative exchange layer over existing Wonder Creator features. Do not build a second social network.

Community should primarily curate and connect existing entities: People, Scrapbook, Creations, Huddles,
collaboration/help opportunities, Projects / Creative Rooms, Open Conversations.

> See what creators are making, thinking about, asking for, and offering — then bring useful things back into the creative flow.

Community's job: help creativity move between people.

## 2. Where Community lives

No new permanent navigation destination. Place inside Explore (Ideas · Materials · People · Community). Home
selectively pulls Community signals into: Worth hearing, You could help, Huddle starting soon, Replies to your question.

## 3. Information architecture

Primary filters (keep them small): **For you** (curated mix of public Scrapbook entries, selected public Creations,
relevant Open Conversations, Huddles, help requests, collaboration opportunities and people) · **Conversations** (Open
Conversations + relevant Huddles) · **Help** (questions, critique requests, references needed, collaboration requests) ·
**People** (creators connected to current interests/work).

## 4. Community objects

Community should not duplicate domain objects. A card references one of: Scrapbook entry, Creation, Huddle, Person, Open
Conversation, Collaboration request, Creative Room / Project opportunity, Community prompt — each with a Moment reference
when appropriate.

## 5. Open Conversations

A public/community asynchronous conversation entity. Scrapbook = share a thought; Open Conversation = discuss an idea
publicly; Huddle = discuss it live; Creative Room = make something together.

```ts
type ConversationIntent = "discuss" | "ask" | "critique" | "share_knowledge" | "looking_for" | "explore_together";

interface OpenConversation {
  id: string; creatorId: string; title: string; body?: string; intent: ConversationIntent;
  visibility: "community" | "public" | "limited"; sourceEntityType?: string; sourceEntityId?: string;
  replyCount: number; participantCount: number; createdAt: string; updatedAt: string; closedAt?: string | null;
}

interface OpenConversationReply {
  id: string; conversationId: string; creatorId: string; body: string; attachmentType?: string;
  attachmentEntityId?: string; createdAt: string; updatedAt: string; deletedAt?: string | null;
}
```

Create Moment references for conversations and replies where useful.

## 6. Conversation intentions

Discuss — explore an idea · Ask — seek advice · Critique — request constructive feedback · Share knowledge —
technique/process/experience · Looking for — reference, Material, skill, collaborator · Explore together — open-ended
exploration. Intent should be visible but not visually dominant.

## 7. Community card patterns

Scrapbook (quote + photo; Save as reference · Reply) · Help ("Arjun could use some help … [Give feedback]") · Huddle
("Huddle starting in 18 min … 5 creators joining [Join]") · Looking for ("Priya is looking for … CreativeMind found 2 of
your Materials that may help. [See them]").

## 8. Avoid conventional social mechanics

No follower counts, like counts, karma, trending scores, infinite scroll or engagement ranking. Primary interactions:
Reply, Save, Help, Join, Bring to Studio, Invite to Huddle, Collaborate. Appreciation can exist later, but should not
define ranking.

## 9. Open to… on Profile

Explicit availability: Giving feedback · Huddles · Collaborating · Sharing references · Mentoring · Being asked a
question. Can help surface opportunities. Do not infer them automatically.

## 10. Community prompts

Optional shared theme ("THIS WEEK — Things we almost forgot"). Contribute a Material, Scrapbook thought, Creation, Open
Conversation or Huddle. No leaderboard. No winner.

## 11. Personalization

Deterministic relationships first: same DejaVu; same Project; same collaborator; same topic chosen by user; explicit
Open to… preferences. Human-readable explanations ("Related to your carousel", "You have Material that may help", "You
worked with Maya before"). No percentage matches or "people like you". Semantic ranking comes in Phase 05.

## 12. Home integration

Populate Phase 02 slots: Worth hearing (a relevant conversation), You could help (a help opportunity, "You already have
2 related Materials"), Your question ("7 replies since yesterday … [Catch up]"), Starting soon (a relevant Huddle,
[Join]). Home still renders only a few selected signals.

## 13. Long conversations

Deterministic catch-up: unread reply count, participant count, replies since last read, replies by known collaborators.
Prepare API/model fields for later AI summaries. Fallback: "Since you last read this — 8 new replies · 3 new
participants". Phase 05 adds semantic summaries.

## 14. Huddle conversion

"Start Huddle about this": pass title, conversation id, selected context/replies, permitted excerpts; store the
back-reference. After the Huddle: "From the Huddle — 3 Moments preserved", which can be saved into the conversation,
Materials, CreativeStudio later, or Scrapbook.

## 15. Conversation → collaboration

"Start Creative Room" using existing infrastructure. Open Conversation → Huddle → People → Creative Room / Project →
Creations. No duplicate collaboration model.

## 16. Community + DejaVu

A user may attach their own DejaVu to a public Moment; this never modifies the source creator's metadata, stays private
to the tagging user's world, and keeps source attribution intact.

## 17. Rights and provenance

Every external/public item carries: source creator, source entity, source URL when external, visibility, reuse
permission state if known, attribution requirement if known. Publicly viewable is never free to reuse. Phase 04 enforces
this when bringing content into CreativeStudio.

## 18. Moderation

From launch: report; mute creator; block creator; remove own reply; conversation owner controls; moderator removal;
spam/rate limiting; visibility changes; audit logging. For Critique, make it explicit that critique was requested.

## 19. Suggested API

```text
GET  /pulse · /pulse/conversations · /pulse/help · /pulse/people
POST /conversations · GET /conversations/:id · POST /conversations/:id/replies · PATCH /conversations/:id
POST /conversations/:id/close · /conversations/:id/start-huddle · /conversations/:id/start-creative-room
POST /reports · /creators/:id/mute · /creators/:id/block
GET/PATCH /me/open-to
```

## 20. UI rules

Compact cards. No giant feed header. No large persistent composer; creating a conversation can be a sheet. Max one
primary CTA per card; secondary actions in the fan menu / More. Four first-level filters. No oversized avatars or
engagement counts. Do not visually reward popularity.

## 21. Tests

Conversations: create/edit/close, reply, limited visibility, blocked user, report, Huddle conversion, Project/Creative
Room conversion. Community: filters, empty state, muted creator hidden, private content excluded, Home surfaces one
relevant item, DejaVu on a public Moment remains user-local. Permissions: cannot reuse a private excerpt, cannot access
a blocked conversation, a visibility change invalidates the Community card, a deleted reply leaves Moment aggregation.

## 22. Acceptance criteria

Community inside Explore; For You / Conversations / Help / People work; Open Conversations created and replied to;
intentions exist; Conversation → Huddle; Conversation → Creative Room/Project via existing collaboration
infrastructure; Home Worth hearing shows a relevant conversation; Home You could help shows a help opportunity; Profile
Open to… exists; Community items can be added to the user's DejaVu without mutating source ownership; moderation basics
exist; no follower/karma/trending system.

## 23. Do not do in this phase

Full Community → Working Table intake, Ask Community from CreativeStudio, source-fragment selection from replies, AI
long-conversation summaries, semantic opportunity matching, automatic DejaVu assignment.

## 24. Handoff to Phase 04

Phase 04 connects Community to the CreativeStudio Working Table, Ask Community, Bring to Studio, Save as reference,
rights/provenance enforcement, and DejaVu-based Studio intake.
