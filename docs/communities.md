# Communities

Owner brief, 2 Oct 2026: interest-based communities, with topics and posts, in the spirit of Orkut. Owner, 3 Oct 2026:
Public, Unlisted and Private communities; only members add anything; communities easy to find from Home.
Built from what already exists. No new community tables, no new global navigation, no likes, follower counts or ranking.

## Terms

| Orkut term | What it is in Wonder Creator |
|---|---|
| Community | A Creative Room (`projects`) with `community_privacy` set: `public`, `unlisted` or `private` |
| Members | The room's crew (`crew_members`, `status = 'active'`) |
| Owner · Moderators | The crew's `owner` · `admin` members |
| Forum | The Open Conversations linked to the room (`open_conversation_links`, `kind = 'project'`) |
| Topic · Post | An Open Conversation · its replies |
| Huddles | Live Huddles started from the community's topics (the name stays Huddle) |
| Creations | Work members shared with the room's crew |

UI terms change in the presentation layer only. Tables, routes and APIs keep their names. The older open space for
conversations, asks and people (`/pulse`, the `creator-community` package) is called **Pulse** in the UI from
2 Oct 2026, so "Community" means only these communities.

## Rules

* **Privacy** (owner, 3 Oct 2026; migration 081 replaces 077's "always public"):
  * **Public**: listed and searchable (`community_list`); anyone signed in sees it and joins.
  * **Unlisted**: never listed or searched; anyone with the link sees it and joins. Its topics open from a link but are
    never listed to non-members (Pulse filters them with `open_conversations_unlisted_for_me`).
  * **Private**: only members (and people its hosts invited) see it; others get "not found". People join by
    invitation (the crew invite; joining accepts it). Its topics are members-only (`can_view_conversation`).
  * Only the owner opens a room as a community or changes its privacy (`community_set_privacy`, audited
    `community.opened` / `community.privacy_changed`). A community stays one; it can go Private. `projects.visibility`
    stays as a mirror (`discoverable` exactly when Public).
* **Members only** (owner, 3 Oct 2026: "do not allow someone to add anything in a community unless they have joined
  it"). Starting a topic, posting, sharing a Creation in a post and starting a Huddle from a topic all need membership
  of a community the topic is in, enforced in the database (`can_reply_conversation`, `open_conversation_link`); the
  app asks `open_conversation_can_add` and offers **Join** instead of a reply box. Huddles from an Unlisted or Private
  community's topic are invite-only, inviting the topic's people.
* **Topics stay with their community.** A `limited` topic can't join a community, and a topic in one can't be narrowed
  to `limited`.
* **Ordinary rooms are unchanged.** Rooms aren't communities until their owner opens one. Reads of the `projects` table
  stay owner + crew only.
* **Safe fields only.** Non-members see a community through security-definer functions (`community_list`,
  `community_card`, `community_members`) that return its name, what it's about, cover, owner and members. Budget, rights
  notes and goals stay with the crew. Nobody blocked by, or blocking, the owner sees the community.
* **Join.** `community_join` adds a member (Public, Unlisted, or an invited person for Private), creating the crew if
  needed. Someone the hosts removed can't rejoin. Leaving uses `crew_leave`; the owner can't leave.
* **Topics.** Members start topics (`startTopic`, then `open_conversation_link`). Members can link only their own topics.
* **Moderation.** The owner and moderators take a topic out of the forum (`community_remove_topic`; the topic stays with
  its author) and remove posts in its topics (`open_conversation_remove_reply`, audited `by: community_host`).
* **Profile picture** (owner, 2 Oct 2026). Every community has a face: the picture its owner or a moderator chose
  (migration 080, `community_set_avatar`; it must be the setter's own clean image, made a 512px square WebP with
  metadata stripped), or a painted monogram. It shows on the community page (hosts change it from the camera on the
  picture), in community lists and beside "In ‹community›" on topics, and can be chosen when starting a community.
* **No popularity.** Lists are ordered by latest activity. No likes, follower counts, trending or ranking.

## Where it lives

* Database: migrations `20261002000077_communities.sql`, `…080_community_avatar.sql`, `20261003000081_community_privacy.sql`;
  tests `tests/db/communities.test.ts`.
* Domain: `packages/creator-community/src/communities.ts`.
* API: `/api/v1/communities` (list, start with `privacy`), `/api/v1/communities/:id` (read; PATCH `{privacy}` opens a
  room as a community or changes its privacy), `join`, `leave`,
  `topics`, `topics/:topicId` (remove). Flag `communities_enabled`.
* UI: Explore › Pulse › **Communities** (`/pulse?filter=communities`, search, Your communities, Discover);
  `/communities/[id]` (Forum · Creations · Huddles · Members; the owner's privacy pill beside Start a topic); the room
  owner's **Open as a community…** (with the privacy choice); a topic shows **In ‹community›** above its title.
* Home (owner, 3 Oct 2026: "make communities easier to find from home", "rename Worth hearing to Communities"): a
  **Communities** section — what's new in one of your communities (a lively topic first; else the conversation, live
  Huddle or thought that used to be "Worth hearing"), your communities as a row of faces (`community_mine`), and
  Discover. With none yet, one invitation: "Find people who make what you make". You could help names the community.
* Palette (`page: "community"`): members get Share a Creation here, Chat & Huddle, Open Creative Room, All communities.
  Start a topic is the page's own primary action, so it isn't repeated in the Palette.
* E2E: `e2e/communities.spec.ts`.
