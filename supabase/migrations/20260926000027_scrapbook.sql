-- P0.1-14 Scrapbook: reflective fragments (thoughts, reflections, sketches, fragments) with replies.
-- Deliberately not social media: no likes, counts, popularity or trending; feeds are chronological.
-- - Visibility: public (people who can see your profile) or private (only you).
-- - Replies: anyone who can see it, only people you follow, or nobody (read-only). Blocks always apply.
-- - Attachments are the creator's own material or pieces. Attaching is the permission: viewers of the post can
--   see an attached material (title, a short excerpt, and its file through a signed URL), and nothing else of
--   the creator's library. Attached pieces show their title; opening them still follows the piece's own rules.

create table public.scrapbook_posts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  kind text not null default 'thought' check (kind in ('thought', 'reflection', 'sketch', 'fragment')),
  body text not null default '' check (char_length(body) <= 5000),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  reply_policy text not null default 'anyone' check (reply_policy in ('anyone', 'following', 'none')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scrapbook_posts_creator_idx on public.scrapbook_posts(creator_id, created_at desc);
create index scrapbook_posts_public_idx on public.scrapbook_posts(created_at desc) where visibility = 'public';
create trigger scrapbook_posts_touch before update on public.scrapbook_posts
  for each row execute function app.touch_updated_at();

create table public.scrapbook_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.scrapbook_posts(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  material_id uuid references public.creative_materials(id) on delete cascade,
  artifact_id uuid references public.artifacts(id) on delete cascade,
  position int not null default 0,
  check ((material_id is null) <> (artifact_id is null))
);
create index scrapbook_attachments_post_idx on public.scrapbook_attachments(post_id, position);
create index scrapbook_attachments_creator_id_fk_idx on public.scrapbook_attachments(creator_id);
create index scrapbook_attachments_material_id_fk_idx on public.scrapbook_attachments(material_id);
create index scrapbook_attachments_artifact_id_fk_idx on public.scrapbook_attachments(artifact_id);

create table public.scrapbook_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.scrapbook_posts(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index scrapbook_replies_post_idx on public.scrapbook_replies(post_id, created_at);
create index scrapbook_replies_creator_id_fk_idx on public.scrapbook_replies(creator_id);

-- Helpers ----------------------------------------------------------------------------------------------------
create or replace function app.blocked_between(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.creator_blocks b
                 where (b.blocker_creator_id = p_a and b.blocked_creator_id = p_b) or (b.blocker_creator_id = p_b and b.blocked_creator_id = p_a))
$$;

create or replace function app.can_view_scrapbook_post(p_post uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.scrapbook_posts p
    where p.id = p_post and (
      p.creator_id = app.current_creator_id()
      or (p.visibility = 'public' and app.current_creator_id() is not null and app.can_view_creator(p.creator_id)
          and not app.blocked_between(p.creator_id, app.current_creator_id()))
    )
  )
$$;

create or replace function app.can_reply_scrapbook_post(p_post uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select app.can_view_scrapbook_post(p_post) and exists (
    select 1 from public.scrapbook_posts p
    where p.id = p_post and (
      p.creator_id = app.current_creator_id()
      or p.reply_policy = 'anyone'
      or (p.reply_policy = 'following' and exists (select 1 from public.creator_follows f where f.follower_creator_id = p.creator_id and f.followed_creator_id = app.current_creator_id()))
    )
  )
$$;

-- RLS ----------------------------------------------------------------------------------------------------------
alter table public.scrapbook_posts enable row level security;
-- The owner check comes first so a new post is readable in its own INSERT … RETURNING.
create policy scrapbook_posts_read on public.scrapbook_posts for select to authenticated
  using (creator_id = app.current_creator_id() or app.can_view_scrapbook_post(id));
create policy scrapbook_posts_insert on public.scrapbook_posts for insert to authenticated with check (creator_id = app.current_creator_id());
create policy scrapbook_posts_update on public.scrapbook_posts for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy scrapbook_posts_delete on public.scrapbook_posts for delete to authenticated using (creator_id = app.current_creator_id());

alter table public.scrapbook_attachments enable row level security;
create policy scrapbook_attachments_read on public.scrapbook_attachments for select to authenticated using (app.can_view_scrapbook_post(post_id));
create policy scrapbook_attachments_insert on public.scrapbook_attachments for insert to authenticated
  with check (
    creator_id = app.current_creator_id()
    and exists (select 1 from public.scrapbook_posts p where p.id = post_id and p.creator_id = app.current_creator_id())
    and (material_id is null or exists (select 1 from public.creative_materials m where m.id = material_id and m.creator_id = app.current_creator_id() and m.security_status = 'clean'))
    and (artifact_id is null or app.owns_artifact(artifact_id))
  );
create policy scrapbook_attachments_delete on public.scrapbook_attachments for delete to authenticated using (creator_id = app.current_creator_id());

alter table public.scrapbook_replies enable row level security;
-- Replies are visible with the post, except between people who have blocked each other.
create policy scrapbook_replies_read on public.scrapbook_replies for select to authenticated
  using (app.can_view_scrapbook_post(post_id) and (creator_id = app.current_creator_id() or not app.blocked_between(creator_id, app.current_creator_id())));
create policy scrapbook_replies_insert on public.scrapbook_replies for insert to authenticated
  with check (creator_id = app.current_creator_id() and app.can_reply_scrapbook_post(post_id));
-- Your own reply, or any reply on your own post (the post's owner moderates).
create policy scrapbook_replies_delete on public.scrapbook_replies for delete to authenticated
  using (creator_id = app.current_creator_id() or exists (select 1 from public.scrapbook_posts p where p.id = post_id and p.creator_id = app.current_creator_id()));

-- What viewers see of attachments: title, a short excerpt and the file path for a signed URL. Nothing else.
create or replace function public.scrapbook_attachment_details(p_posts uuid[])
returns table (post_id uuid, attachment_id uuid, kind text, item_id uuid, title text, item_type text, excerpt text, mime_type text, file_path text, can_open boolean)
language sql stable security definer set search_path = ''
as $$
  select a.post_id, a.id, 'material', m.id, coalesce(m.title, 'Untitled'), m.type::text, left(coalesce(m.text_content, ''), 500),
         so.mime_type, case when so.security_status = 'clean' then so.path end, m.creator_id = app.current_creator_id()
  from public.scrapbook_attachments a
  join public.creative_materials m on m.id = a.material_id
  left join public.storage_objects so on so.id = m.storage_object_id
  where a.post_id = any(p_posts[1:100]) and app.can_view_scrapbook_post(a.post_id)
  union all
  select a.post_id, a.id, 'artifact', r.id, r.title, r.artifact_type, null, null, null, app.can_read_artifact(r.id)
  from public.scrapbook_attachments a
  join public.artifacts r on r.id = a.artifact_id
  where a.post_id = any(p_posts[1:100]) and app.can_view_scrapbook_post(a.post_id)
$$;
revoke execute on function public.scrapbook_attachment_details(uuid[]) from public, anon;
grant execute on function public.scrapbook_attachment_details(uuid[]) to authenticated;

-- Viewers of a post may read the files attached to it (to create signed URLs), and only those. The check runs
-- as a definer function: the viewer can't (and mustn't) read the author's material rows themselves.
create or replace function app.can_read_scrapbook_file(p_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.storage_objects so
    join public.creative_materials m on m.storage_object_id = so.id
    join public.scrapbook_attachments a on a.material_id = m.id
    where so.bucket = 'creator-media' and so.path = p_name and so.security_status = 'clean' and app.can_view_scrapbook_post(a.post_id)
  )
$$;
create policy "creator media via scrapbook" on storage.objects for select to authenticated
  using (bucket_id = 'creator-media' and app.can_read_scrapbook_file(name));

-- Reports can point at posts and replies.
alter table public.moderation_reports drop constraint moderation_reports_context_type_check;
alter table public.moderation_reports add constraint moderation_reports_context_type_check
  check (context_type in ('huddle', 'profile', 'artifact', 'message', 'scrapbook_post', 'scrapbook_reply'));

-- Audit: posting, deleting and changing who can see or reply.
create or replace function app.audit_scrapbook_post()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.record_audit('scrapbook.posted', 'scrapbook_post', new.id, jsonb_build_object('visibility', new.visibility, 'replies', new.reply_policy), null);
  elsif tg_op = 'DELETE' then
    perform app.record_audit('scrapbook.deleted', 'scrapbook_post', old.id, '{}'::jsonb, null);
    return old;
  elsif new.visibility is distinct from old.visibility or new.reply_policy is distinct from old.reply_policy then
    perform app.record_audit('scrapbook.settings', 'scrapbook_post', new.id, jsonb_build_object('visibility', new.visibility, 'replies', new.reply_policy), null);
  end if;
  return new;
end $$;
create trigger scrapbook_posts_audit after insert or update or delete on public.scrapbook_posts
  for each row execute function app.audit_scrapbook_post();
revoke execute on function app.audit_scrapbook_post() from public, anon, authenticated;

-- Whether the caller may reply (for showing or hiding the reply box; the insert policy is what enforces it).
create or replace function public.scrapbook_can_reply(p_post uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select app.can_reply_scrapbook_post(p_post) $$;
revoke execute on function public.scrapbook_can_reply(uuid) from public, anon;
grant execute on function public.scrapbook_can_reply(uuid) to authenticated;
