-- P1-16 Campaign Domain Foundation (plan §37): the pieces a brand collaboration needs, and no more —
-- a campaign brief, invitations to creators who are open to brand work, proposed deliverables, status, the usage
-- rights the campaign needs, a link to a collaboration workspace (a Creative Room), and approval state.
-- No payments, contracts or legal automation. Every state change is a deliberate human action through the functions
-- below (who may do what is enforced here, not in the UI); nothing auto-executes.

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_creator_id uuid not null references public.creators(id) on delete cascade,
  brand_name text not null check (char_length(brand_name) between 1 and 80),
  title text not null check (char_length(title) between 1 and 120),
  brief text not null check (char_length(brief) between 1 and 4000),
  -- What the campaign needs to be allowed to do with the work (channels, duration, territory, exclusivity…).
  usage_rights text not null check (char_length(usage_rights) between 1 and 1000),
  channels text[] not null default '{}' check (cardinality(channels) <= 12),
  due_on date,
  status text not null default 'draft' check (status in ('draft', 'open', 'in_progress', 'completed', 'cancelled')),
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_owner_idx on public.campaigns(owner_creator_id, created_at desc);
create trigger campaigns_touch before update on public.campaigns for each row execute function app.touch_updated_at();

create table public.campaign_invitations (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'accepted', 'declined', 'withdrawn')),
  note text check (note is null or char_length(note) <= 1000),
  response_note text check (response_note is null or char_length(response_note) <= 1000),
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (campaign_id, creator_id)
);
create index campaign_invitations_creator_idx on public.campaign_invitations(creator_id, invited_at desc);

create table public.campaign_deliverables (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  proposed_by uuid not null references public.creators(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text check (description is null or char_length(description) <= 2000),
  format text check (format is null or char_length(format) <= 60),
  due_on date,
  artifact_id uuid references public.artifacts(id) on delete set null,
  status text not null default 'proposed' check (status in ('proposed', 'agreed', 'submitted', 'approved', 'changes_requested', 'withdrawn')),
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaign_deliverables_campaign_idx on public.campaign_deliverables(campaign_id, created_at);
create trigger campaign_deliverables_touch before update on public.campaign_deliverables for each row execute function app.touch_updated_at();

-- The caller's relation to a campaign: owner, creator (accepted), invited, or null.
create or replace function app.campaign_role(p_campaign uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when exists (select 1 from public.campaigns c where c.id = p_campaign and c.owner_creator_id = app.current_creator_id()) then 'owner'
    else (select case i.status when 'accepted' then 'creator' when 'invited' then 'invited' else null end
          from public.campaign_invitations i where i.campaign_id = p_campaign and i.creator_id = app.current_creator_id())
  end
$$;
revoke execute on function app.campaign_role(uuid) from public, anon;
grant execute on function app.campaign_role(uuid) to authenticated;

alter table public.campaigns enable row level security;
alter table public.campaign_invitations enable row level security;
alter table public.campaign_deliverables enable row level security;

create policy campaigns_read on public.campaigns for select to authenticated using (owner_creator_id = app.current_creator_id() or app.campaign_role(id) is not null);
create policy campaigns_insert on public.campaigns for insert to authenticated
  with check (owner_creator_id = app.current_creator_id() and status in ('draft', 'open') and (project_id is null or app.owns_project(project_id)));
create policy campaigns_update on public.campaigns for update to authenticated
  using (owner_creator_id = app.current_creator_id())
  with check (owner_creator_id = app.current_creator_id() and (project_id is null or app.owns_project(project_id)));
create policy campaigns_delete on public.campaigns for delete to authenticated using (owner_creator_id = app.current_creator_id() and status = 'draft');

create policy campaign_invitations_read on public.campaign_invitations for select to authenticated
  using (creator_id = app.current_creator_id() or app.campaign_role(campaign_id) = 'owner');
create policy campaign_deliverables_read on public.campaign_deliverables for select to authenticated
  using (creator_id = app.current_creator_id() or app.campaign_role(campaign_id) = 'owner');
-- Invitations and deliverables change only through the functions below.

-- Invite a creator who has opted into brand work (P1-15). Not blocked, not yourself.
create or replace function public.campaign_invite(p_campaign uuid, p_creator uuid, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); c public.campaigns;
begin
  select * into c from public.campaigns where id = p_campaign for update;
  if c.id is null or c.owner_creator_id <> v_me then raise exception 'only the campaign''s owner can invite' using errcode = '42501'; end if;
  if c.status not in ('draft', 'open', 'in_progress') then raise exception 'this campaign is closed' using errcode = '55000'; end if;
  if p_creator = v_me then raise exception 'you run this campaign' using errcode = '22023'; end if;
  if not app.can_view_creator(p_creator) or app.blocked_between(v_me, p_creator) then raise exception 'creator not found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.brand_profiles b where b.creator_id = p_creator and b.open_to_brands) then
    raise exception 'this creator isn''t open to brand work' using errcode = '42501';
  end if;
  insert into public.campaign_invitations(campaign_id, creator_id, status, note, invited_at, responded_at, response_note)
  values (p_campaign, p_creator, 'invited', nullif(trim(p_note), ''), now(), null, null)
  on conflict (campaign_id, creator_id) do update set status = 'invited', note = excluded.note, invited_at = now(), responded_at = null, response_note = null
  where public.campaign_invitations.status in ('declined', 'withdrawn');
  if c.status = 'draft' then update public.campaigns set status = 'open' where id = p_campaign; end if;
end $$;

create or replace function public.campaign_withdraw_invite(p_campaign uuid, p_creator uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if app.campaign_role(p_campaign) is distinct from 'owner' then raise exception 'only the campaign''s owner can withdraw' using errcode = '42501'; end if;
  update public.campaign_invitations set status = 'withdrawn', responded_at = now() where campaign_id = p_campaign and creator_id = p_creator and status = 'invited';
  if not found then raise exception 'invitation not found' using errcode = 'P0002'; end if;
end $$;

create or replace function public.campaign_respond(p_campaign uuid, p_accept boolean, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator();
begin
  update public.campaign_invitations set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now(), response_note = nullif(trim(p_note), '')
  where campaign_id = p_campaign and creator_id = v_me and status = 'invited';
  if not found then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  if p_accept then update public.campaigns set status = 'in_progress' where id = p_campaign and status in ('draft', 'open'); end if;
end $$;

-- Either side proposes a deliverable for an accepted creator; the other side agrees.
create or replace function public.campaign_propose_deliverable(p_campaign uuid, p_creator uuid, p_title text, p_description text default null, p_format text default null, p_due_on date default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_role text := app.campaign_role(p_campaign); v_id uuid;
begin
  if v_role = 'creator' and p_creator <> v_me then raise exception 'you can only propose your own deliverables' using errcode = '42501'; end if;
  if v_role is null or v_role not in ('owner', 'creator') then raise exception 'not part of this campaign' using errcode = '42501'; end if;
  if not exists (select 1 from public.campaign_invitations i where i.campaign_id = p_campaign and i.creator_id = p_creator and i.status = 'accepted') then
    raise exception 'that creator hasn''t joined this campaign' using errcode = '22023';
  end if;
  if (select status from public.campaigns where id = p_campaign) in ('completed', 'cancelled') then raise exception 'this campaign is closed' using errcode = '55000'; end if;
  insert into public.campaign_deliverables(campaign_id, creator_id, proposed_by, title, description, format, due_on)
  values (p_campaign, p_creator, v_me, trim(p_title), nullif(trim(p_description), ''), nullif(trim(p_format), ''), p_due_on)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.campaign_agree_deliverable(p_deliverable uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); d public.campaign_deliverables; v_role text;
begin
  select * into d from public.campaign_deliverables where id = p_deliverable for update;
  if d.id is null then raise exception 'deliverable not found' using errcode = 'P0002'; end if;
  v_role := app.campaign_role(d.campaign_id);
  if d.status <> 'proposed' then raise exception 'only a proposal can be agreed' using errcode = '55000'; end if;
  -- The other side agrees: the owner agrees to a creator's proposal, the creator to the owner's.
  if d.proposed_by = v_me or not ((v_role = 'owner') or (v_role = 'creator' and d.creator_id = v_me)) then
    raise exception 'the other side agrees to a proposal' using errcode = '42501';
  end if;
  update public.campaign_deliverables set status = 'agreed' where id = p_deliverable;
end $$;

-- The creator submits one of their own Creations for an agreed deliverable (or after changes were requested).
create or replace function public.campaign_submit_deliverable(p_deliverable uuid, p_artifact uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); d public.campaign_deliverables;
begin
  select * into d from public.campaign_deliverables where id = p_deliverable for update;
  if d.id is null or d.creator_id <> v_me then raise exception 'deliverable not found' using errcode = 'P0002'; end if;
  if d.status not in ('agreed', 'changes_requested') then raise exception 'agree on this deliverable first' using errcode = '55000'; end if;
  if not exists (select 1 from public.artifacts a where a.id = p_artifact and a.creator_id = v_me) then raise exception 'that Creation isn''t yours' using errcode = '42501'; end if;
  update public.campaign_deliverables set status = 'submitted', artifact_id = p_artifact, review_note = null where id = p_deliverable;
end $$;

-- The campaign's owner approves or asks for changes. Approval is always a human decision.
create or replace function public.campaign_review_deliverable(p_deliverable uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare d public.campaign_deliverables;
begin
  select * into d from public.campaign_deliverables where id = p_deliverable for update;
  if d.id is null then raise exception 'deliverable not found' using errcode = 'P0002'; end if;
  if app.campaign_role(d.campaign_id) is distinct from 'owner' then raise exception 'only the campaign''s owner reviews' using errcode = '42501'; end if;
  if d.status <> 'submitted' then raise exception 'nothing submitted to review' using errcode = '55000'; end if;
  if not p_approve and nullif(trim(p_note), '') is null then raise exception 'say what should change' using errcode = '22023'; end if;
  update public.campaign_deliverables set status = case when p_approve then 'approved' else 'changes_requested' end, review_note = nullif(trim(p_note), '') where id = p_deliverable;
end $$;

-- What the campaign's owner may see of a submitted Creation: its title, type and current version — only while it's
-- submitted, under changes or approved, and only through this function (no broader artifact access).
create or replace function public.campaign_submission(p_deliverable uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('title', a.title, 'type', a.artifact_type, 'version', v.version_number, 'content', left(v.content, 20000))
  from public.campaign_deliverables d
  join public.campaigns c on c.id = d.campaign_id
  join public.artifacts a on a.id = d.artifact_id
  left join public.artifact_versions v on v.id = a.current_version_id
  where d.id = p_deliverable and d.status in ('submitted', 'approved', 'changes_requested')
    and (c.owner_creator_id = app.current_creator_id() or d.creator_id = app.current_creator_id())
$$;
revoke execute on function public.campaign_submission(uuid) from public, anon;
grant execute on function public.campaign_submission(uuid) to authenticated;

revoke all on function public.campaign_invite(uuid, uuid, text), public.campaign_withdraw_invite(uuid, uuid), public.campaign_respond(uuid, boolean, text),
  public.campaign_propose_deliverable(uuid, uuid, text, text, text, date), public.campaign_agree_deliverable(uuid),
  public.campaign_submit_deliverable(uuid, uuid), public.campaign_review_deliverable(uuid, boolean, text) from public, anon;
grant execute on function public.campaign_invite(uuid, uuid, text), public.campaign_withdraw_invite(uuid, uuid), public.campaign_respond(uuid, boolean, text),
  public.campaign_propose_deliverable(uuid, uuid, text, text, text, date), public.campaign_agree_deliverable(uuid),
  public.campaign_submit_deliverable(uuid, uuid), public.campaign_review_deliverable(uuid, boolean, text) to authenticated;
