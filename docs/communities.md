# Communities

Owner brief, 2 Oct 2026: interest-based communities anyone can join, with topics and posts, in the spirit of Orkut.
Built from what already exists. No new community tables, no new global navigation, no likes, follower counts or ranking.

## Terms

| Orkut term | What it is in Wonder Creator |
|---|---|
| Community | A Creative Room (`projects`) with `visibility = 'discoverable'` |
| Members | The room's crew (`crew_members`, `status = 'active'`) |
| Owner · Moderators | The crew's `owner` · `admin` members |
| Forum | The Open Conversations linked to the room (`open_conversation_links`, `kind = 'project'`) |
| Topic · Post | An Open Conversation · its replies |
| Huddles | Live Huddles started from the community's topics (the name stays Huddle) |
| Creations | Work members shared with the room's crew |

UI terms change in the presentation layer only. Tables, routes and APIs keep their names.

## Rules

* **Always public** (owner, 2 Oct 2026). A room can be opened as a community; it can never be made private again (a
  database trigger refuses it). Topics in a community are public: new ones are created `public`, a `limited` topic can't
  join a community, and a topic in one can't be narrowed to `limited`.
* **Private rooms are unchanged.** Rooms default to `private`. Reads of the `projects` table stay owner + crew only.
* **Safe fields only.** Non-members see a community through security-definer functions (`community_list`,
  `community_card`, `community_members`) that return its name, what it's about, cover, owner and members. Budget, rights
  notes and goals stay with the crew. Nobody blocked by, or blocking, the owner sees the community.
* **Open join.** `community_join` adds anyone signed in as a member, creating the crew if needed. Someone the hosts
  removed can't rejoin. Leaving uses `crew_leave`; the owner can't leave.
* **Topics.** Members start topics (`startTopic`: a public Open Conversation, then `open_conversation_link`). Members can
  link only their own topics.
* **Moderation.** The owner and moderators take a topic out of the forum (`community_remove_topic`; the topic stays with
  its author) and remove posts in its topics (`open_conversation_remove_reply`, audited `by: community_host`).
* **No popularity.** Lists are ordered by latest activity. No likes, follower counts, trending or ranking.

## Where it lives

* Database: `supabase/migrations/20261002000077_communities.sql`; tests `tests/db/communities.test.ts`.
* Domain: `packages/creator-community/src/communities.ts`.
* API: `/api/v1/communities` (list, start), `/api/v1/communities/:id` (read, open as a community), `join`, `leave`,
  `topics`, `topics/:topicId` (remove). Flag `communities_enabled`.
* UI: Explore › Community › **Communities** (`/community?filter=communities`, search, Your communities, Discover);
  `/communities/[id]` (Forum · Creations · Huddles · Members); the room owner's **Open as a community…**; a topic shows
  **In ‹community›** above its title. Home's Worth hearing and You could help name the community.
* Palette (`page: "community"`): members get Share a Creation here, Chat & Huddle, Open Creative Room, All communities.
  Start a topic is the page's own primary action, so it isn't repeated in the Palette.
* E2E: `e2e/communities.spec.ts`.
