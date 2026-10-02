> **Renamed (owner, 2 Oct 2026):** this surface is called **Pulse** in the UI. "Community" now names the Orkut-style
> communities (`docs/communities.md`). Routes, tables, packages and APIs keep the `community` name.

# Community + Open Conversations — implementation contract

Owner spec: [`phases/03-community-open-conversations.md`](phases/03-community-open-conversations.md) (Phase 03 of 5).
Reference board: [`phases/boards/phases-overview-2026-09-29.png`](phases/boards/phases-overview-2026-09-29.png), boards
5–6 and 11. The board is a reference, never a runtime asset.

Community is a creative exchange layer over what already exists: Scrapbook, Creations, Huddles, People and Creative
Rooms. The Open Conversation is the only new thing. There are **no** likes, karma, trending scores, follower-based
ranking (follower counts appear only on the in-app Profile — decisions.md §12),
engagement ranking or infinite scroll.

## Where it lives

* **Explore** has four doors (`components/explore-nav.tsx`): Ideas (`/search`), Materials (`/search?type=material`),
  People (`/discover`) and **Community** (`/community`). The Palette's Explore stays one destination.
* **Community** (`/community`) has four views:
  * **For you**: a fixed mix of conversations, a Scrapbook thought, a live Huddle, help requests, a public Creation and
    people.
  * **Conversations**: live Huddles, then conversations.
  * **Help**: Ask, Critique and Looking for requests that are still open.
  * **People**: people you know first, via `find_collaborators`, plus their Open to….
  * Order is by time within each kind, never by popularity. Conversations and Help page with "Show more"; there is no
    infinite scroll.
* **Home** (Phase 02 slots):
  * **Your question**: new replies to your conversation since you last read it.
  * **You could help**: others' open requests that fit your Open to… or your own Materials, each with why.
  * **Worth hearing**: a conversation you joined with new replies, or one from someone you've worked with.
  * Home still shows only a few signals.

## Data (migration `…061_community.sql`)

* **`open_conversations`**
  * **Fields**: title, body, **intent** (discuss · ask · critique · share_knowledge · looking_for · explore_together)
    and **visibility**.
    * Community and Public: signed-in creators who may see the owner.
    * Limited: only the people added, in `open_conversation_invites`.
  * **Source** (optional): the owner's own Material or Creation, stored as a reference.
  * **Quiet counts** (`reply_count`, `participant_count`, `last_reply_at`), kept by trigger and used for catch-up
    only.
  * **Owner controls** (column grants): title, body, intent, visibility, `closed_at`. `removed_at` is for moderators
    only.
* **`open_conversation_replies`**: an optional attachment, which must be the replier's own. Authors soft-delete their
  own replies. The owner or a moderator removes others' replies through `open_conversation_remove_reply`, which is
  audited.
* **`open_conversation_reads`**: private catch-up state (§13): "Since you last read this · 8 new replies · 3 new
  participants", plus replies from people you've worked with.
* **`open_conversation_links`**: back-references to Huddles and Creative Rooms. They're written only through
  `open_conversation_link`, which checks that the caller can see the conversation and started the Huddle or owns the
  Room.
* **Access** (`app.can_view_conversation`):
  * The owner or a moderator can always see a conversation.
  * Otherwise it must not be removed, there must be no block either way, and it must be Community/Public with the owner
    visible, or Limited with the viewer added.
  * Replies are hidden between blocked pairs.
  * The read policy checks the owner first, so `INSERT … RETURNING` works.
* **Moderation**:
  * `moderation_reports` accepts `open_conversation` and `open_conversation_reply` (`POST /api/v1/reports`).
  * **`creator_mutes`** is private to the muter.
  * **Blocks** reuse `creator_blocks`.
  * **`platform_moderators`** are appointed by the operators (service role) only. `open_conversation_moderate` removes
    or restores a conversation, and it's audited.
  * Starting a conversation or replying is rate-limited per minute and budgeted per hour.
  * Posting, visibility changes, closing, deleting, removals and conversions are all written to `audit_logs`.
* **`creator_open_to`** holds Open to… (§9): feedback · huddles · collaborating · references · mentoring · questions.
  * It's explicit and never inferred.
  * It's readable by anyone who may see the creator, and never across a block.
  * It's shown on the profile and set in Settings → Collaboration.
* **Moments** (Phase 01): `conversation` and `scrapbook_entry` are now live Moment kinds.
  * The owner gets their conversation's Moment by trigger.
  * Any reader may keep **their own** reference to give it one of their DejaVus. The source conversation, its owner's
    Moment and its attribution are never touched.
  * A removed or narrowed conversation narrows every reference, and deleting it deletes them.

## Code

* **`@wonder/creator-community`**:
  * `shared` (vocabulary).
  * `conversations`: create/edit/close/delete, reply, remove, read, detail with catch-up and links, `huddleContext`.
  * `moderation`: mutes, hidden creators, Open to….
  * `feed`: the four views, deterministic reasons, and `homeCommunitySignals`.
* **API**:
  * `GET /api/v1/community`.
  * `POST /api/v1/open-conversations`.
  * `GET|PATCH|DELETE /api/v1/open-conversations/:id` and `…/:id/{replies,close,read,invite,start-huddle,start-creative-room,moderate}`.
  * `…/replies/:replyId` (DELETE own) and `…/replies/:replyId/remove`.
  * `POST /api/v1/reports`, `POST /api/v1/creators/:id/mute`, `GET|PATCH /api/v1/profile/open-to`.
  * Blocking stays at `POST /api/v1/creators/:id/block`.
  * The CreatorTalk routes under `/api/v1/conversations` are untouched.
* **Reasons** are deterministic and plain-language (§11), such as "You're in this conversation", "You have 2 Materials
  that may help" (a word match against your own Materials) and "You worked with Maya before" (a shared crew or
  contribution). There are no percentages and no "people like you".
* **Huddle and Creative Room conversion**:
  * **Start Huddle about this**: the Huddle gets the conversation's title and a short context drawn only from what the
    starter can read. Limited conversations make an invite-only Huddle with their people.
  * **Start Creative Room**: goes through `createProject`, with the brief taken from the conversation.
  * Both are linked back to the conversation. The page shows "Live Huddle about this" (checked through the
    `live_huddle_cards` function, since Huddles are private by design) and "From the Huddle · N Moments you preserved".
* **Rights** (§17):
  * A conversation's subject and each reply's attachment show only if the viewer can open them. Otherwise the page reads
    "About something … keeps private" or "Shared privately".
  * Being publicly visible never makes something free to reuse; Phase 04 enforces this in CreativeStudio.

## Not in this phase

* Scheduled Huddles ("starting in 18 min"): Huddles have no schedule yet, so Community shows *live* Huddles.
* Community prompts (§10).
* Save as reference and Bring to Studio (Phase 04).
* AI summaries and semantic matching (Phase 05).
* A moderator review queue UI.
