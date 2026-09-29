-- CreatorPublish — public home + type-aware published work (docs/creator-publish.md,
-- docs/phases/06-creatorpublish-type-aware.md).
--
-- Publish into your own space first, then share the link anywhere. Publishing snapshots a *published revision* — the
-- public page never shows the mutable working Creation — under a stable URL (/p/<handle>/<slug>) that survives
-- updates. The Creator Page is curated separately from the in-app Profile: nothing appears on it unless the creator put
-- it there. Signed-out readers reach only publication-safe fields, through the security-definer functions at the end.

-- ---------------------------------------------------------------------------------------------- Published works
create table public.published_works (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null unique references public.artifacts(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$'),
  -- Private: only the creator. Unlisted: anyone with the URL. Public: also on the Creator Page. Visibility is not reuse.
  visibility text not null default 'public' check (visibility in ('private', 'unlisted', 'public')),
  -- Presentation choices only (experience, treatment, theme, which context to show, rights toggles, conversation).
  settings jsonb not null default '{}' check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 4096),
  featured boolean not null default false,
  current_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unpublished_at timestamptz,
  unique (creator_id, slug)
);
create index published_works_creator_idx on public.published_works(creator_id, updated_at desc);
create trigger published_works_touch before update on public.published_works for each row execute function app.touch_updated_at();

-- A frozen public revision: the manifest (how it's experienced) and a snapshot of exactly what readers see, with the
-- rights and provenance as they were when published. Immutable, like versions.
create table public.published_revisions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.published_works(id) on delete cascade,
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  revision_number int not null check (revision_number >= 1),
  version_id uuid references public.artifact_versions(id) on delete set null,
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object' and pg_column_size(manifest) <= 8192),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) <= 2000000),
  rights_snapshot jsonb not null default '{}' check (jsonb_typeof(rights_snapshot) = 'object' and pg_column_size(rights_snapshot) <= 16384),
  provenance_snapshot jsonb not null default '{}' check (jsonb_typeof(provenance_snapshot) = 'object' and pg_column_size(provenance_snapshot) <= 16384),
  published_at timestamptz not null default now(),
  unique (work_id, revision_number)
);
alter table public.published_works add constraint published_works_current_revision_fk foreign key (current_revision_id) references public.published_revisions(id) on delete set null;

alter table public.published_works enable row level security;
create policy published_works_own on public.published_works for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (creator_id = app.current_creator_id() and app.owns_artifact(artifact_id)
    and (current_revision_id is null or exists (select 1 from public.published_revisions r where r.id = current_revision_id and r.work_id = published_works.id)));

alter table public.published_revisions enable row level security;
create policy published_revisions_read on public.published_revisions for select to authenticated using (creator_id = app.current_creator_id());
create policy published_revisions_insert on public.published_revisions for insert to authenticated
  with check (
    creator_id = app.current_creator_id() and app.owns_artifact(artifact_id)
    and exists (select 1 from public.published_works w where w.id = work_id and w.artifact_id = published_revisions.artifact_id and w.creator_id = app.current_creator_id())
    and (version_id is null or exists (select 1 from public.artifact_versions v where v.id = version_id and v.artifact_id = published_revisions.artifact_id))
  );
revoke update, delete on public.published_revisions from authenticated;

-- --------------------------------------------------------------------------------------------- The Creator Page
create table public.creator_pages (
  creator_id uuid primary key references public.creators(id) on delete cascade,
  is_published boolean not null default false,
  headline text check (headline is null or char_length(headline) <= 120),
  intro text check (intro is null or char_length(intro) <= 1200),
  -- Ordered sections, each on or off: featured, creations, dejavu, moments, conversations, about, open_to, links.
  sections jsonb not null default '[{"section":"featured","enabled":true},{"section":"creations","enabled":true},{"section":"dejavu","enabled":true},{"section":"moments","enabled":false},{"section":"conversations","enabled":false},{"section":"about","enabled":true},{"section":"open_to","enabled":true},{"section":"links","enabled":true}]'
    check (jsonb_typeof(sections) = 'array' and jsonb_array_length(sections) <= 12),
  public_dejavu_ids uuid[] not null default '{}' check (cardinality(public_dejavu_ids) <= 12),
  -- Explicitly chosen public Scrapbook entries ("Moments": glimpses between bigger works).
  public_moment_ids uuid[] not null default '{}' check (cardinality(public_moment_ids) <= 24),
  links jsonb not null default '[]' check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 8 and pg_column_size(links) <= 4096),
  updated_at timestamptz not null default now()
);
create trigger creator_pages_touch before update on public.creator_pages for each row execute function app.touch_updated_at();
alter table public.creator_pages enable row level security;
create policy creator_pages_own on public.creator_pages for all to authenticated
  using (creator_id = app.current_creator_id())
  with check (
    creator_id = app.current_creator_id()
    and not exists (select 1 from unnest(public_dejavu_ids) d where not exists (select 1 from public.dejavus x where x.id = d and x.creator_id = app.current_creator_id()))
    and not exists (select 1 from unnest(public_moment_ids) m where not exists (select 1 from public.scrapbook_posts p where p.id = m and p.creator_id = app.current_creator_id()))
  );

-- ---------------------------------------------------------------------------------------------- Light analytics
-- Daily counts per published work: views, completions (carousel end, video/audio end), shares. No visitor data at all.
create table public.published_work_stats (
  work_id uuid not null references public.published_works(id) on delete cascade,
  day date not null default current_date,
  views int not null default 0,
  completions int not null default 0,
  shares int not null default 0,
  primary key (work_id, day)
);
alter table public.published_work_stats enable row level security;
create policy published_work_stats_own on public.published_work_stats for select to authenticated
  using (exists (select 1 from public.published_works w where w.id = work_id and w.creator_id = app.current_creator_id()));
revoke insert, update, delete on public.published_work_stats from authenticated;

create or replace function public.record_publication_event(p_work uuid, p_kind text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_kind not in ('view', 'complete', 'share') then return; end if;
  if not exists (select 1 from public.published_works w where w.id = p_work and w.visibility in ('public', 'unlisted') and w.unpublished_at is null and w.current_revision_id is not null) then return; end if;
  insert into public.published_work_stats (work_id, day, views, completions, shares)
  values (p_work, current_date, (p_kind = 'view')::int, (p_kind = 'complete')::int, (p_kind = 'share')::int)
  on conflict (work_id, day) do update set
    views = public.published_work_stats.views + excluded.views,
    completions = public.published_work_stats.completions + excluded.completions,
    shares = public.published_work_stats.shares + excluded.shares;
end $$;
revoke execute on function public.record_publication_event(uuid, text) from public;
grant execute on function public.record_publication_event(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------- Public reads
-- Only publication-safe fields leave these functions: what the creator published (the frozen snapshot), their public
-- identity, and what they explicitly put on their page. They never depend on the reader's session.

create or replace function app.public_card(w public.published_works)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'slug', w.slug, 'featured', w.featured,
    'title', r.snapshot->>'title', 'creationType', r.manifest->>'creationType', 'typeLabel', r.snapshot->>'typeLabel',
    'experience', r.manifest->>'experience', 'descriptor', r.manifest->>'descriptor',
    'coverObjectId', coalesce(r.manifest->>'coverObjectId', r.manifest->>'posterObjectId'),
    'durationSeconds', r.manifest->'durationSeconds', 'itemCount', r.manifest->'itemCount',
    'publishedAt', r.published_at, 'artifactId', w.artifact_id)
  from public.published_revisions r where r.id = w.current_revision_id
$$;
revoke execute on function app.public_card(public.published_works) from public, anon, authenticated;

create or replace function public.public_creator_page(p_handle text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case when p.is_published then jsonb_build_object(
    'creator', jsonb_build_object('id', c.id, 'handle', c.handle, 'name', c.display_name, 'bio', c.bio,
      'location', case when c.show_location then c.location end, 'avatarObjectId', c.avatar_object_id),
    'headline', p.headline, 'intro', p.intro, 'sections', p.sections, 'links', p.links,
    'works', coalesce((select jsonb_agg(app.public_card(w) order by w.featured desc, w.updated_at desc)
      from public.published_works w where w.creator_id = c.id and w.visibility = 'public' and w.unpublished_at is null and w.current_revision_id is not null), '[]'),
    'dejavus', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'description', d.description,
        'count', (select count(*) from public.published_works w join public.moment_references m on m.entity_type = 'creation' and m.entity_id = w.artifact_id and m.deleted_at is null
                  join public.dejavu_moments dm on dm.moment_id = m.id and dm.dejavu_id = d.id
                  where w.creator_id = c.id and w.visibility = 'public' and w.unpublished_at is null and w.current_revision_id is not null)
          + (select count(*) from unnest(p.public_moment_ids) pm join public.moment_references m on m.entity_type = 'scrapbook_entry' and m.entity_id = pm and m.deleted_at is null
             join public.dejavu_moments dm on dm.moment_id = m.id and dm.dejavu_id = d.id)))
      from public.dejavus d where d.id = any(p.public_dejavu_ids) and d.creator_id = c.id and d.archived_at is null), '[]'),
    'moments', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'body', s.body, 'kind', s.kind, 'createdAt', s.created_at,
        'imageObjectId', (select mm.storage_object_id from public.scrapbook_attachments a join public.creative_materials mm on mm.id = a.material_id and mm.type in ('image', 'sketch') and mm.storage_object_id is not null where a.post_id = s.id order by a.position limit 1))
        order by s.created_at desc)
      from public.scrapbook_posts s where s.id = any(p.public_moment_ids) and s.creator_id = c.id and s.visibility = 'public'), '[]'),
    'conversations', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'replyCount', o.reply_count, 'createdAt', o.created_at) order by o.created_at desc)
      from public.open_conversations o where o.creator_id = c.id and o.visibility = 'public' and o.removed_at is null and o.closed_at is null), '[]'),
    'openTo', coalesce((select to_jsonb(t.preferences) from public.creator_open_to t where t.creator_id = c.id), '[]')
  ) end
  from public.creators c join public.creator_pages p on p.creator_id = c.id
  where c.handle = lower(p_handle)
$$;
revoke execute on function public.public_creator_page(text) from public;
grant execute on function public.public_creator_page(text) to anon, authenticated;

create or replace function public.public_work(p_handle text, p_slug text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'workId', w.id, 'slug', w.slug, 'visibility', w.visibility, 'settings', w.settings,
    'revision', jsonb_build_object('number', r.revision_number, 'publishedAt', r.published_at),
    'manifest', r.manifest, 'snapshot', r.snapshot, 'rights', r.rights_snapshot, 'provenance', r.provenance_snapshot,
    'creator', jsonb_build_object('handle', c.handle, 'name', c.display_name, 'avatarObjectId', c.avatar_object_id,
      'pagePublished', coalesce((select p.is_published from public.creator_pages p where p.creator_id = c.id), false)),
    'more', coalesce((select jsonb_agg(x.card) from (select app.public_card(o) as card from public.published_works o
      where o.creator_id = c.id and o.id <> w.id and o.visibility = 'public' and o.unpublished_at is null and o.current_revision_id is not null
      order by o.featured desc, o.updated_at desc limit 3) x), '[]'),
    'conversation', (select jsonb_build_object('id', o.id, 'title', o.title, 'replyCount', o.reply_count)
      from public.open_conversations o where o.id = (w.settings->>'conversationId')::uuid and o.removed_at is null and o.visibility in ('community', 'public'))
  )
  from public.creators c
  join public.published_works w on w.creator_id = c.id and w.slug = lower(p_slug)
  join public.published_revisions r on r.id = w.current_revision_id
  where c.handle = lower(p_handle) and w.visibility in ('public', 'unlisted') and w.unpublished_at is null
$$;
revoke execute on function public.public_work(text, text) from public;
grant execute on function public.public_work(text, text) to anon, authenticated;

-- A public DejaVu: editorial, and only what the creator made public — their public published works and the Moments
-- they chose for their page. Private Moments in the same DejaVu stay private.
create or replace function public.public_dejavu(p_handle text, p_dejavu uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'creator', jsonb_build_object('handle', c.handle, 'name', c.display_name),
    'dejavu', jsonb_build_object('id', d.id, 'name', d.name, 'description', d.description),
    'items', coalesce((
      select jsonb_agg(i.item order by i.at) from (
        select m.occurred_at as at, jsonb_build_object('kind', 'creation', 'at', m.occurred_at, 'card', app.public_card(w)) as item
        from public.dejavu_moments dm join public.moment_references m on m.id = dm.moment_id and m.deleted_at is null and m.entity_type = 'creation'
        join public.published_works w on w.artifact_id = m.entity_id and w.creator_id = c.id and w.visibility = 'public' and w.unpublished_at is null and w.current_revision_id is not null
        where dm.dejavu_id = d.id
        union all
        select s.created_at, jsonb_build_object('kind', 'moment', 'at', s.created_at, 'moment', jsonb_build_object('id', s.id, 'body', s.body, 'kind', s.kind,
          'imageObjectId', (select mm.storage_object_id from public.scrapbook_attachments a join public.creative_materials mm on mm.id = a.material_id and mm.type in ('image', 'sketch') and mm.storage_object_id is not null where a.post_id = s.id order by a.position limit 1)))
        from public.dejavu_moments dm join public.moment_references m on m.id = dm.moment_id and m.deleted_at is null and m.entity_type = 'scrapbook_entry'
        join public.scrapbook_posts s on s.id = m.entity_id and s.visibility = 'public' and s.id = any(p.public_moment_ids)
        where dm.dejavu_id = d.id
      ) i), '[]')
  )
  from public.creators c
  join public.creator_pages p on p.creator_id = c.id and p.is_published
  join public.dejavus d on d.id = p_dejavu and d.creator_id = c.id and d.id = any(p.public_dejavu_ids) and d.archived_at is null
  where c.handle = lower(p_handle)
$$;
revoke execute on function public.public_dejavu(text, uuid) from public;
grant execute on function public.public_dejavu(text, uuid) to anon, authenticated;
