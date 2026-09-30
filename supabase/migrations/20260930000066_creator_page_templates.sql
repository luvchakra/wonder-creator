-- Creator Page templates (owner spec "Creator Page Template System", 30 Sep 2026): one curated public page, five visual
-- lenses. The template and its per-template settings are presentation only; the page's content is unchanged by them.

alter table public.creator_pages
  add column template_id text not null default 'soft_gradient'
    check (template_id in ('immersive_artistic', 'minimal_editorial', 'cinematic_dark', 'creative_collage', 'soft_gradient')),
  -- Settings kept per template ({"cinematic_dark": {...}, ...}) so switching away and back restores them.
  add column template_settings jsonb not null default '{}'
    check (jsonb_typeof(template_settings) = 'object' and pg_column_size(template_settings) <= 4096);

-- Cards now carry an excerpt for work read as text (poems, essays, stories), so a text-only Creation renders as
-- typography — never as a stand-in photograph.
create or replace function app.public_card(w public.published_works)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'slug', w.slug, 'featured', w.featured,
    'title', r.snapshot->>'title', 'creationType', r.manifest->>'creationType', 'typeLabel', r.snapshot->>'typeLabel',
    'experience', r.manifest->>'experience', 'descriptor', r.manifest->>'descriptor',
    'coverObjectId', coalesce(r.manifest->>'coverObjectId', r.manifest->>'posterObjectId'),
    'durationSeconds', r.manifest->'durationSeconds', 'itemCount', r.manifest->'itemCount',
    'excerpt', case when r.manifest->>'experience' in ('read', 'journey') then left(r.snapshot->>'content', 320) end,
    'poem', coalesce((r.manifest->>'poem')::boolean, false),
    'publishedAt', r.published_at, 'artifactId', w.artifact_id)
  from public.published_revisions r where r.id = w.current_revision_id
$$;
revoke execute on function app.public_card(public.published_works) from public, anon, authenticated;

-- The page's publication-safe payload for one creator — shared by the public read and the owner's preview, so the two
-- can never differ. Only what the creator published or explicitly put on the page leaves here.
create or replace function app.creator_page_payload(p_creator uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'creator', jsonb_build_object('id', c.id, 'handle', c.handle, 'name', c.display_name, 'bio', c.bio,
      'location', case when c.show_location then c.location end, 'avatarObjectId', c.avatar_object_id,
      'roles', coalesce((select jsonb_agg(x.value order by x.position) from (select d.value, d.position from public.creator_disciplines d where d.creator_id = c.id order by d.position limit 4) x), '[]')),
    'isPublished', coalesce(p.is_published, false),
    'templateId', coalesce(p.template_id, 'soft_gradient'),
    'templateSettings', coalesce(p.template_settings, '{}'),
    'headline', p.headline, 'intro', p.intro, 'sections', coalesce(p.sections, '[]'), 'links', coalesce(p.links, '[]'),
    'works', coalesce((select jsonb_agg(app.public_card(w) order by w.featured desc, w.updated_at desc)
      from public.published_works w where w.creator_id = c.id and w.visibility = 'public' and w.unpublished_at is null and w.current_revision_id is not null), '[]'),
    'dejavus', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'description', d.description,
        'count', (select count(*) from public.published_works w join public.moment_references m on m.entity_type = 'creation' and m.entity_id = w.artifact_id and m.deleted_at is null
                  join public.dejavu_moments dm on dm.moment_id = m.id and dm.dejavu_id = d.id
                  where w.creator_id = c.id and w.visibility = 'public' and w.unpublished_at is null and w.current_revision_id is not null)
          + (select count(*) from unnest(p.public_moment_ids) pm join public.moment_references m on m.entity_type = 'scrapbook_entry' and m.entity_id = pm and m.deleted_at is null
             join public.dejavu_moments dm on dm.moment_id = m.id and dm.dejavu_id = d.id),
        -- A representative picture from what is public in it: a public work's cover, else a chosen Moment's image.
        'coverObjectId', coalesce(
          (select coalesce(r.manifest->>'coverObjectId', r.manifest->>'posterObjectId') from public.published_works w
             join public.published_revisions r on r.id = w.current_revision_id
             join public.moment_references m on m.entity_type = 'creation' and m.entity_id = w.artifact_id and m.deleted_at is null
             join public.dejavu_moments dm on dm.moment_id = m.id and dm.dejavu_id = d.id
             where w.creator_id = c.id and w.visibility = 'public' and w.unpublished_at is null
               and coalesce(r.manifest->>'coverObjectId', r.manifest->>'posterObjectId') is not null
             order by w.featured desc, w.updated_at desc limit 1),
          (select mm.storage_object_id::text from unnest(p.public_moment_ids) pm
             join public.scrapbook_posts s on s.id = pm and s.creator_id = c.id and s.visibility = 'public'
             join public.moment_references m on m.entity_type = 'scrapbook_entry' and m.entity_id = pm and m.deleted_at is null
             join public.dejavu_moments dm on dm.moment_id = m.id and dm.dejavu_id = d.id
             join public.scrapbook_attachments a on a.post_id = pm
             join public.creative_materials mm on mm.id = a.material_id and mm.type in ('image', 'sketch') and mm.storage_object_id is not null
             limit 1))))
      from public.dejavus d where d.id = any(p.public_dejavu_ids) and d.creator_id = c.id and d.archived_at is null), '[]'),
    'moments', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'body', s.body, 'kind', s.kind, 'createdAt', s.created_at,
        'imageObjectId', (select mm.storage_object_id from public.scrapbook_attachments a join public.creative_materials mm on mm.id = a.material_id and mm.type in ('image', 'sketch') and mm.storage_object_id is not null where a.post_id = s.id order by a.position limit 1))
        order by s.created_at desc)
      from public.scrapbook_posts s where s.id = any(p.public_moment_ids) and s.creator_id = c.id and s.visibility = 'public'), '[]'),
    'conversations', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'replyCount', o.reply_count, 'createdAt', o.created_at) order by o.created_at desc)
      from public.open_conversations o where o.creator_id = c.id and o.visibility = 'public' and o.removed_at is null and o.closed_at is null), '[]'),
    'openTo', coalesce((select to_jsonb(t.preferences) from public.creator_open_to t where t.creator_id = c.id), '[]')
  )
  from public.creators c left join public.creator_pages p on p.creator_id = c.id
  where c.id = p_creator
$$;
revoke execute on function app.creator_page_payload(uuid) from public, anon, authenticated;

create or replace function public.public_creator_page(p_handle text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case when p.is_published then app.creator_page_payload(c.id) end
  from public.creators c join public.creator_pages p on p.creator_id = c.id
  where c.handle = lower(p_handle)
$$;
revoke execute on function public.public_creator_page(text) from public;
grant execute on function public.public_creator_page(text) to anon, authenticated;

-- The owner's own preview: exactly what the public page would show, before (or without) publishing it.
create or replace function public.creator_page_preview()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select app.creator_page_payload(app.current_creator_id()) where app.current_creator_id() is not null
$$;
revoke execute on function public.creator_page_preview() from public, anon;
grant execute on function public.creator_page_preview() to authenticated;
