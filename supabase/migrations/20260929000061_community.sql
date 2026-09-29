-- Phase 03 — Community + Open Conversations (docs/community.md, docs/phases/03-community-open-conversations.md).
--
-- Community is an exchange layer over what already exists (Scrapbook, Creations, Huddles, People, Creative Rooms);
-- the one new thing is the Open Conversation: a public, asynchronous discussion of an idea. There are no follower
-- counts, likes, karma or trending scores here, and nothing is ranked by popularity.
--
-- Access: a conversation is seen by signed-in creators who may see its owner (Community / Public), or only by the
-- people it was shared with (Limited); never across a block. Replies are hidden between blocked pairs. Moderation
-- exists from the start: reports, per-viewer mutes, owner controls, and platform moderators who can remove things —
-- every removal is audited.

-- ------------------------------------------------------------------------------------------------ Conversations
create table public.open_conversations (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 140),
  body text check (body is null or char_length(body) <= 5000),
  intent text not null check (intent in ('discuss', 'ask', 'critique', 'share_knowledge', 'looking_for', 'explore_together')),
  visibility text not null default 'community' check (visibility in ('community', 'public', 'limited')),
  -- What it's about, by reference (never a copy): the owner's own Material or Creation.
  source_entity_type text check (source_entity_type is null or source_entity_type in ('material', 'creation')),
  source_entity_id uuid,
  reply_count int not null default 0,
  participant_count int not null default 1,
  last_reply_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  -- A platform moderator took it down (audited); only they and the owner can still see it.
  removed_at timestamptz,
  removed_reason text check (removed_reason is null or char_length(removed_reason) <= 300),
  check ((source_entity_type is null) = (source_entity_id is null))
);
create index open_conversations_recent_idx on public.open_conversations(created_at desc) where removed_at is null;
create index open_conversations_creator_idx on public.open_conversations(creator_id, created_at desc);
create trigger open_conversations_touch before update on public.open_conversations for each row execute function app.touch_updated_at();

-- Limited conversations: who else may see and reply.
create table public.open_conversation_invites (
  conversation_id uuid not null references public.open_conversations(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  invited_at timestamptz not null default now(),
  primary key (conversation_id, creator_id)
);
create index open_conversation_invites_creator_idx on public.open_conversation_invites(creator_id);

create table public.open_conversation_replies (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.open_conversations(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  -- A Material or Creation of the replier's own, by reference.
  attachment_type text check (attachment_type is null or attachment_type in ('material', 'creation')),
  attachment_entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  removed_at timestamptz,
  check ((attachment_type is null) = (attachment_entity_id is null))
);
create index open_conversation_replies_conv_idx on public.open_conversation_replies(conversation_id, created_at);
create index open_conversation_replies_creator_idx on public.open_conversation_replies(creator_id);
create trigger open_conversation_replies_touch before update on public.open_conversation_replies for each row execute function app.touch_updated_at();

-- Catch-up (§13): where each reader got to. Private to the reader.
create table public.open_conversation_reads (
  conversation_id uuid not null references public.open_conversations(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, creator_id)
);

-- Huddles and Creative Rooms that grew out of a conversation (back-references, §14–15).
create table public.open_conversation_links (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.open_conversations(id) on delete cascade,
  kind text not null check (kind in ('huddle', 'project')),
  huddle_id uuid,
  project_id uuid references public.projects(id) on delete cascade,
  started_by uuid not null references public.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((kind = 'huddle' and huddle_id is not null and project_id is null) or (kind = 'project' and project_id is not null and huddle_id is null))
);
create index open_conversation_links_conv_idx on public.open_conversation_links(conversation_id, created_at);

-- ----------------------------------------------------------------------------------------------------- Mutes
-- Muting is private: the muted creator is never told and nothing of theirs changes; they just leave your Community.
create table public.creator_mutes (
  muter_creator_id uuid not null references public.creators(id) on delete cascade,
  muted_creator_id uuid not null references public.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_creator_id, muted_creator_id),
  check (muter_creator_id <> muted_creator_id)
);
alter table public.creator_mutes enable row level security;
create policy creator_mutes_read on public.creator_mutes for select to authenticated using (muter_creator_id = app.current_creator_id());
create policy creator_mutes_insert on public.creator_mutes for insert to authenticated with check (muter_creator_id = app.current_creator_id());
create policy creator_mutes_delete on public.creator_mutes for delete to authenticated using (muter_creator_id = app.current_creator_id());

-- ------------------------------------------------------------------------------------------------- Open to…
-- Explicit availability on a profile (§9). Never inferred. Readable by whoever may see the creator.
create table public.creator_open_to (
  creator_id uuid primary key references public.creators(id) on delete cascade,
  preferences text[] not null default '{}' check (preferences <@ array['feedback', 'huddles', 'collaborating', 'references', 'mentoring', 'questions']::text[]),
  updated_at timestamptz not null default now()
);
create trigger creator_open_to_touch before update on public.creator_open_to for each row execute function app.touch_updated_at();
alter table public.creator_open_to enable row level security;
create policy creator_open_to_read on public.creator_open_to for select to authenticated
  using (creator_id = app.current_creator_id() or (app.can_view_creator(creator_id) and not app.blocked_between(creator_id, app.current_creator_id())));
create policy creator_open_to_insert on public.creator_open_to for insert to authenticated with check (creator_id = app.current_creator_id());
create policy creator_open_to_update on public.creator_open_to for update to authenticated using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());

-- ------------------------------------------------------------------------------------------------ Moderators
-- Platform moderators are appointed by the operators (service role only); the app never grants this.
create table public.platform_moderators (
  creator_id uuid primary key references public.creators(id) on delete cascade,
  appointed_at timestamptz not null default now()
);
alter table public.platform_moderators enable row level security;
create policy platform_moderators_self on public.platform_moderators for select to authenticated using (creator_id = app.current_creator_id());
revoke insert, update, delete on public.platform_moderators from authenticated;

create or replace function app.is_moderator()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.platform_moderators m where m.creator_id = app.current_creator_id()) $$;

-- -------------------------------------------------------------------------------------------------- Access
create or replace function app.can_view_conversation(p_conversation uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.open_conversations c
    where c.id = p_conversation and (
      c.creator_id = app.current_creator_id()
      or app.is_moderator()
      or (
        c.removed_at is null
        and app.current_creator_id() is not null
        and not app.blocked_between(c.creator_id, app.current_creator_id())
        and (
          (c.visibility in ('community', 'public') and app.can_view_creator(c.creator_id))
          or (c.visibility = 'limited' and exists (select 1 from public.open_conversation_invites i where i.conversation_id = c.id and i.creator_id = app.current_creator_id()))
        )
      )
    )
  )
$$;

create or replace function app.can_reply_conversation(p_conversation uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select app.can_view_conversation(p_conversation) and exists (
    select 1 from public.open_conversations c where c.id = p_conversation and c.closed_at is null and c.removed_at is null
  )
$$;

-- A reference the caller may attach: their own Material or Creation.
create or replace function app.owns_community_attachment(p_type text, p_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case p_type
    when 'material' then exists (select 1 from public.creative_materials m where m.id = p_id and m.creator_id = app.current_creator_id())
    when 'creation' then exists (select 1 from public.artifacts a where a.id = p_id and a.creator_id = app.current_creator_id())
    else false
  end
$$;

alter table public.open_conversations enable row level security;
-- The owner check comes first so INSERT … RETURNING works (the definer function can't see the row being inserted).
create policy open_conversations_read on public.open_conversations for select to authenticated using (creator_id = app.current_creator_id() or app.can_view_conversation(id));
create policy open_conversations_insert on public.open_conversations for insert to authenticated
  with check (
    creator_id = app.current_creator_id() and closed_at is null and removed_at is null and reply_count = 0 and participant_count = 1
    and (source_entity_type is null or app.owns_community_attachment(source_entity_type, source_entity_id))
  );
create policy open_conversations_update on public.open_conversations for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy open_conversations_delete on public.open_conversations for delete to authenticated using (creator_id = app.current_creator_id());
-- The owner controls wording, visibility and whether it's open; counts and removal are the system's.
revoke update on public.open_conversations from authenticated;
grant update (title, body, intent, visibility, closed_at) on public.open_conversations to authenticated;

alter table public.open_conversation_invites enable row level security;
create policy open_conversation_invites_read on public.open_conversation_invites for select to authenticated
  using (creator_id = app.current_creator_id() or exists (select 1 from public.open_conversations c where c.id = conversation_id and c.creator_id = app.current_creator_id()));
create policy open_conversation_invites_insert on public.open_conversation_invites for insert to authenticated
  with check (
    exists (select 1 from public.open_conversations c where c.id = conversation_id and c.creator_id = app.current_creator_id())
    and app.can_view_creator(creator_id) and not app.blocked_between(creator_id, app.current_creator_id())
  );
create policy open_conversation_invites_delete on public.open_conversation_invites for delete to authenticated
  using (exists (select 1 from public.open_conversations c where c.id = conversation_id and c.creator_id = app.current_creator_id()));

alter table public.open_conversation_replies enable row level security;
create policy open_conversation_replies_read on public.open_conversation_replies for select to authenticated
  using (
    app.can_view_conversation(conversation_id)
    and (creator_id = app.current_creator_id() or app.is_moderator() or (deleted_at is null and removed_at is null and not app.blocked_between(creator_id, app.current_creator_id())))
  );
create policy open_conversation_replies_insert on public.open_conversation_replies for insert to authenticated
  with check (
    creator_id = app.current_creator_id() and deleted_at is null and removed_at is null
    and app.can_reply_conversation(conversation_id)
    and (attachment_type is null or app.owns_community_attachment(attachment_type, attachment_entity_id))
  );
-- Authors edit or delete (soft) their own replies; owners and moderators remove through open_conversation_remove_reply.
create policy open_conversation_replies_update on public.open_conversation_replies for update to authenticated
  using (creator_id = app.current_creator_id() and removed_at is null) with check (creator_id = app.current_creator_id());
revoke update on public.open_conversation_replies from authenticated;
grant update (body, deleted_at) on public.open_conversation_replies to authenticated;
revoke delete on public.open_conversation_replies from authenticated;

alter table public.open_conversation_reads enable row level security;
create policy open_conversation_reads_own on public.open_conversation_reads for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id() and app.can_view_conversation(conversation_id));

alter table public.open_conversation_links enable row level security;
create policy open_conversation_links_read on public.open_conversation_links for select to authenticated using (app.can_view_conversation(conversation_id));
revoke insert, update, delete on public.open_conversation_links from authenticated;

-- ------------------------------------------------------------------------------------------- Counts (no ranking)
-- Kept for catch-up ("8 new replies · 3 new participants"), never for ordering by popularity.
create or replace function app.open_conversation_recount()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_id uuid := coalesce(new.conversation_id, old.conversation_id);
begin
  update public.open_conversations c set
    reply_count = (select count(*) from public.open_conversation_replies r where r.conversation_id = v_id and r.deleted_at is null and r.removed_at is null),
    participant_count = 1 + (select count(distinct r.creator_id) from public.open_conversation_replies r where r.conversation_id = v_id and r.deleted_at is null and r.removed_at is null and r.creator_id <> c.creator_id),
    last_reply_at = (select max(r.created_at) from public.open_conversation_replies r where r.conversation_id = v_id and r.deleted_at is null and r.removed_at is null)
  where c.id = v_id;
  return null;
end
$$;
create trigger open_conversation_replies_recount after insert or update of deleted_at, removed_at or delete on public.open_conversation_replies
  for each row execute function app.open_conversation_recount();

-- ----------------------------------------------------------------------------------------- Owner + moderator controls
-- The conversation's owner can remove replies in it; a moderator can remove replies or whole conversations. Audited.
create or replace function public.open_conversation_remove_reply(p_reply uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_conv uuid; v_owner uuid; v_author uuid;
begin
  select r.conversation_id, c.creator_id, r.creator_id into v_conv, v_owner, v_author
  from public.open_conversation_replies r join public.open_conversations c on c.id = r.conversation_id where r.id = p_reply;
  if v_conv is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if v_owner <> app.current_creator_id() and not app.is_moderator() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.open_conversation_replies set removed_at = now() where id = p_reply and removed_at is null;
  perform app.record_audit('community.reply_removed', 'open_conversation_reply', p_reply,
    jsonb_build_object('conversation', v_conv, 'by', case when v_owner = app.current_creator_id() then 'owner' else 'moderator' end, 'reason', left(p_reason, 300)), null);
end
$$;

create or replace function public.open_conversation_moderate(p_conversation uuid, p_remove boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not app.is_moderator() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.open_conversations set removed_at = case when p_remove then now() else null end, removed_reason = case when p_remove then left(p_reason, 300) else null end
  where id = p_conversation;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  perform app.record_audit(case when p_remove then 'community.conversation_removed' else 'community.conversation_restored' end, 'open_conversation', p_conversation,
    jsonb_build_object('reason', left(p_reason, 300)), null);
end
$$;

-- Record that a Huddle or Creative Room grew out of a conversation the caller can see, and that it's theirs.
create or replace function public.open_conversation_link(p_conversation uuid, p_kind text, p_target uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not app.can_view_conversation(p_conversation) then raise exception 'not found' using errcode = 'P0002'; end if;
  if p_kind = 'huddle' and not exists (select 1 from public.huddles h where h.id = p_target and h.started_by_creator_id = app.current_creator_id()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_kind = 'project' and not exists (select 1 from public.projects p where p.id = p_target and p.creator_id = app.current_creator_id()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.open_conversation_links (conversation_id, kind, huddle_id, project_id, started_by)
  values (p_conversation, p_kind, case when p_kind = 'huddle' then p_target end, case when p_kind = 'project' then p_target end, app.current_creator_id())
  returning id into v_id;
  perform app.record_audit('community.conversation_' || p_kind, 'open_conversation', p_conversation, jsonb_build_object('target', p_target), null);
  return v_id;
end
$$;

-- Audit what matters for moderation: posting, visibility changes, closing, deleting.
create or replace function app.audit_open_conversation()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.record_audit('community.conversation_started', 'open_conversation', new.id, jsonb_build_object('intent', new.intent, 'visibility', new.visibility), null);
  elsif tg_op = 'UPDATE' and (new.visibility is distinct from old.visibility or new.closed_at is distinct from old.closed_at) then
    perform app.record_audit('community.conversation_settings', 'open_conversation', new.id,
      jsonb_build_object('visibility', new.visibility, 'closed', new.closed_at is not null), null);
  elsif tg_op = 'DELETE' then
    perform app.record_audit('community.conversation_deleted', 'open_conversation', old.id, '{}'::jsonb, null);
  end if;
  return coalesce(new, old);
end
$$;
create trigger open_conversations_audit after insert or update or delete on public.open_conversations for each row execute function app.audit_open_conversation();

-- Reports can point at conversations and their replies.
alter table public.moderation_reports drop constraint moderation_reports_context_type_check;
alter table public.moderation_reports add constraint moderation_reports_context_type_check
  check (context_type in ('huddle', 'profile', 'artifact', 'message', 'scrapbook_post', 'scrapbook_reply', 'open_conversation', 'open_conversation_reply'));

-- ------------------------------------------------------------------------------------------- Moments (Phase 01)
-- A conversation is a Moment for its owner, and anyone who can see it may keep their own reference to it (to give it
-- one of *their* DejaVus) — which never touches the owner's conversation. Same for a public Scrapbook entry.
create or replace function app.moment_entity_visibility(p_type text, p_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select case p_type
    when 'material' then (select case when m.privacy = 'public' then 'public' when m.privacy in ('shared', 'collaborator_only') then 'shared' else 'private' end from public.creative_materials m where m.id = p_id)
    when 'creation' then (
      select case
        when a.privacy = 'public' and a.status in ('final', 'published') then 'public'
        when a.privacy in ('shared', 'collaborator_only') then 'shared'
        else 'private' end
      from public.artifacts a where a.id = p_id)
    when 'conversation' then (
      select case when c.removed_at is not null then 'private' when c.visibility = 'public' then 'public' when c.visibility = 'community' then 'community' else 'shared' end
      from public.open_conversations c where c.id = p_id)
    when 'scrapbook_entry' then (select case when p.visibility = 'public' then 'public' else 'private' end from public.scrapbook_posts p where p.id = p_id)
    else null
  end
$$;

create or replace function app.can_see_moment_entity(p_type text, p_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select case p_type
    when 'material' then exists (select 1 from public.creative_materials m where m.id = p_id)
    when 'creation' then app.can_read_artifact(p_id)
    when 'conversation' then app.can_view_conversation(p_id)
    when 'scrapbook_entry' then app.can_view_scrapbook_post(p_id)
    else false
  end
$$;

create or replace function app.conversation_moment_sync()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_vis text := app.moment_entity_visibility('conversation', new.id);
begin
  insert into public.moment_references (creator_id, entity_type, entity_id, occurred_at, visibility, title, excerpt, preview_kind, subtype)
  values (new.creator_id, 'conversation', new.id, new.created_at, v_vis, left(new.title, 200), left(new.body, 280), 'text', new.intent)
  on conflict (creator_id, entity_type, entity_id) do nothing;
  if tg_op = 'UPDATE' then
    update public.moment_references r set
      title = left(new.title, 200), excerpt = left(new.body, 280), subtype = new.intent,
      visibility = case when app.visibility_rank(r.visibility) > app.visibility_rank(v_vis) then v_vis else r.visibility end
    where r.entity_type = 'conversation' and r.entity_id = new.id;
  end if;
  return new;
end
$$;
create trigger open_conversations_moment after insert or update of title, body, intent, visibility, removed_at on public.open_conversations
  for each row execute function app.conversation_moment_sync();
create trigger open_conversations_moment_delete after delete on public.open_conversations for each row execute function app.entity_moment_delete('conversation');
create trigger scrapbook_posts_moment_delete after delete on public.scrapbook_posts for each row execute function app.entity_moment_delete('scrapbook_entry');
