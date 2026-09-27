-- P1-08 Crew Rights & Permissions: the rights philosophy applied to collaborative work.
-- Guardrail: contribution never implies legal ownership. Everything here is a platform record of assertions,
-- agreements and approvals — not a legal determination — and the UI says so.
-- - A project rights policy (owner-set, versioned in history): how derivatives of project pieces are handled,
--   whether publishing a project piece needs its collaborators' sign-off, the attribution expectation and the
--   written agreement.
-- - Ownership assertions: anyone involved in a piece of the project can record a claim (sole owner, co-owner with an
--   optional share, contributor only, no claim) with a statement; the piece's owner acknowledges or disputes it;
--   the asserter can withdraw. Nothing here changes the piece's rights record automatically.
-- - Publication sign-off: when the project requires it, a piece in the project can't be approved for publishing
--   until each collaborator who can propose or edit, and each co-owner on its rights record, has approved the
--   current version. An objection blocks until withdrawn. Enforced in approve_publication().
-- - A project rights history (policy changes, assertions, responses, sign-offs), immutable.

create table public.project_rights_policies (
  project_id uuid primary key references public.projects(id) on delete cascade,
  derivatives text not null default 'owner_approval' check (derivatives in ('owner_approval', 'crew_allowed', 'not_allowed')),
  publication_signoff boolean not null default false,
  attribution text not null default 'credit_all' check (attribution in ('credit_all', 'as_agreed')),
  agreement text check (agreement is null or char_length(agreement) <= 5000),
  updated_by uuid references public.creators(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index project_rights_policies_updated_by_fk_idx on public.project_rights_policies(updated_by);

create table public.project_rights_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_creator_id uuid references public.creators(id) on delete set null,
  event text not null check (char_length(event) <= 60),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index project_rights_events_project_idx on public.project_rights_events(project_id, created_at desc);
create index project_rights_events_actor_fk_idx on public.project_rights_events(actor_creator_id);
create trigger project_rights_events_immutable before update on public.project_rights_events
  for each row execute function app.prevent_mutation();

create or replace function app.project_rights_log(p_project uuid, p_event text, p_details jsonb)
returns void language sql security definer set search_path = ''
as $$
  insert into public.project_rights_events(project_id, actor_creator_id, event, details) values (p_project, app.current_creator_id(), p_event, coalesce(p_details, '{}'::jsonb));
  select app.record_audit('project_rights.' || p_event, 'project', p_project, coalesce(p_details, '{}'::jsonb), null);
$$;
revoke execute on function app.project_rights_log(uuid, text, jsonb) from public, anon, authenticated;

alter table public.project_rights_policies enable row level security;
create policy project_rights_policies_read on public.project_rights_policies for select to authenticated using (app.can_read_project(project_id));
create policy project_rights_policies_write on public.project_rights_policies for all to authenticated
  using (app.owns_project(project_id))
  with check (app.owns_project(project_id) and updated_by = app.current_creator_id());

alter table public.project_rights_events enable row level security;
create policy project_rights_events_read on public.project_rights_events for select to authenticated using (app.can_read_project(project_id));
revoke insert, update, delete on public.project_rights_events from authenticated;

create or replace function app.audit_rights_policy()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform app.project_rights_log(new.project_id, 'policy_updated', jsonb_strip_nulls(jsonb_build_object(
    'derivatives', new.derivatives, 'publication_signoff', new.publication_signoff, 'attribution', new.attribution,
    'agreement_changed', case when tg_op = 'INSERT' or new.agreement is distinct from old.agreement then true end)));
  return new;
end $$;
create trigger project_rights_policies_audit after insert or update on public.project_rights_policies
  for each row execute function app.audit_rights_policy();
revoke execute on function app.audit_rights_policy() from public, anon, authenticated;

-- Ownership assertions ------------------------------------------------------------------------------------------------
create table public.ownership_assertions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  claim text not null check (claim in ('sole_owner', 'co_owner', 'contributor_only', 'no_claim')),
  share_percent numeric(5, 2) check (share_percent is null or (share_percent > 0 and share_percent <= 100)),
  statement text not null check (char_length(statement) between 1 and 2000),
  status text not null default 'asserted' check (status in ('asserted', 'acknowledged', 'disputed', 'withdrawn')),
  responded_by uuid references public.creators(id) on delete set null,
  response_note text check (response_note is null or char_length(response_note) <= 1000),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  check (share_percent is null or claim = 'co_owner')
);
create index ownership_assertions_project_idx on public.ownership_assertions(project_id, created_at desc);
create index ownership_assertions_artifact_id_fk_idx on public.ownership_assertions(artifact_id);
create index ownership_assertions_creator_id_fk_idx on public.ownership_assertions(creator_id);
create index ownership_assertions_responded_by_fk_idx on public.ownership_assertions(responded_by);
alter table public.ownership_assertions enable row level security;
create policy ownership_assertions_read on public.ownership_assertions for select to authenticated
  using (app.can_read_project(project_id) or creator_id = app.current_creator_id());
revoke insert, update, delete on public.ownership_assertions from authenticated;

-- Record an assertion about a piece linked to the project (people in the project who worked on the piece).
create or replace function public.assert_ownership(p_project uuid, p_artifact uuid, p_claim text, p_statement text, p_share numeric default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := app.require_creator(); v_id uuid;
begin
  if app.project_role(p_project) is null then raise exception 'not in project' using errcode = '42501'; end if;
  if not exists (select 1 from public.project_items i where i.project_id = p_project and i.artifact_id = p_artifact) then
    raise exception 'piece not in project' using errcode = '22023';
  end if;
  if app.artifact_access(p_artifact) is null and not exists (select 1 from public.contributions c where c.artifact_id = p_artifact and c.contributor_creator_id = v_me) then
    raise exception 'not involved' using errcode = '42501';
  end if;
  if p_claim not in ('sole_owner', 'co_owner', 'contributor_only', 'no_claim') then raise exception 'invalid claim' using errcode = '22023'; end if;
  if p_share is not null and p_claim <> 'co_owner' then raise exception 'share only for co-owner' using errcode = '22023'; end if;
  if exists (select 1 from public.ownership_assertions a where a.artifact_id = p_artifact and a.creator_id = v_me and a.status in ('asserted', 'acknowledged', 'disputed')) then
    raise exception 'already asserted' using errcode = '23505';
  end if;
  insert into public.ownership_assertions(project_id, artifact_id, creator_id, claim, share_percent, statement)
  values (p_project, p_artifact, v_me, p_claim, p_share, trim(p_statement)) returning id into v_id;
  perform app.project_rights_log(p_project, 'assertion_made', jsonb_build_object('assertion', v_id, 'artifact', p_artifact, 'claim', p_claim, 'share', p_share));
  return v_id;
end $$;

-- The piece's owner acknowledges or disputes; the asserter can withdraw.
create or replace function public.respond_ownership_assertion(p_assertion uuid, p_response text, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare a public.ownership_assertions;
begin
  select * into a from public.ownership_assertions where id = p_assertion for update;
  if a.id is null then raise exception 'assertion not found' using errcode = 'P0002'; end if;
  if p_response = 'withdraw' then
    if a.creator_id <> app.current_creator_id() then raise exception 'not allowed' using errcode = '42501'; end if;
    if a.status = 'withdrawn' then return; end if;
    update public.ownership_assertions set status = 'withdrawn', responded_at = now() where id = a.id;
  elsif p_response in ('acknowledge', 'dispute') then
    if not app.owns_artifact(a.artifact_id) then raise exception 'not allowed' using errcode = '42501'; end if;
    if a.status = 'withdrawn' then raise exception 'assertion withdrawn' using errcode = '55000'; end if;
    update public.ownership_assertions set status = case when p_response = 'acknowledge' then 'acknowledged' else 'disputed' end,
      responded_by = app.current_creator_id(), response_note = nullif(trim(p_note), ''), responded_at = now() where id = a.id;
  else
    raise exception 'invalid response' using errcode = '22023';
  end if;
  perform app.project_rights_log(a.project_id, 'assertion_' || case p_response when 'withdraw' then 'withdrawn' when 'acknowledge' then 'acknowledged' else 'disputed' end,
    jsonb_build_object('assertion', a.id, 'artifact', a.artifact_id, 'by', a.creator_id));
end $$;

-- Publication sign-off -------------------------------------------------------------------------------------------------
create table public.publication_signoffs (
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  version_id uuid not null references public.artifact_versions(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  decision text not null check (decision in ('approve', 'object')),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  primary key (artifact_id, version_id, creator_id)
);
create index publication_signoffs_version_id_fk_idx on public.publication_signoffs(version_id);
create index publication_signoffs_creator_id_fk_idx on public.publication_signoffs(creator_id);
alter table public.publication_signoffs enable row level security;
create policy publication_signoffs_read on public.publication_signoffs for select to authenticated using (app.artifact_access(artifact_id) is not null);
revoke insert, update, delete on public.publication_signoffs from authenticated;

-- Who must sign off before a piece can be published: only when a project it's in requires it.
create or replace function app.required_signers(p_artifact uuid)
returns table (creator_id uuid) language sql stable security definer set search_path = ''
as $$
  select distinct s.creator_id from (
    select c.contributor_creator_id as creator_id from public.artifact_contributors c where c.artifact_id = p_artifact and c.access in ('propose', 'edit')
    union
    select o.owner_creator_id from public.rights_records r join public.rights_owners o on o.rights_id = r.id where r.artifact_id = p_artifact and o.owner_creator_id is not null
  ) s
  join public.artifacts a on a.id = p_artifact
  where s.creator_id <> a.creator_id
    and exists (select 1 from public.project_items i join public.project_rights_policies p on p.project_id = i.project_id
                where i.artifact_id = p_artifact and p.publication_signoff)
$$;

create or replace function public.publication_signoff_status(p_artifact uuid)
returns table (creator_id uuid, name text, decision text, note text, decided_at timestamptz) language sql stable security definer set search_path = ''
as $$
  select r.creator_id, c.display_name, s.decision, s.note, s.created_at
  from app.required_signers(p_artifact) r
  join public.creators c on c.id = r.creator_id
  join public.artifacts a on a.id = p_artifact
  left join public.publication_signoffs s on s.artifact_id = p_artifact and s.version_id = a.current_version_id and s.creator_id = r.creator_id
  where app.artifact_access(p_artifact) is not null
$$;

create or replace function public.sign_off_publication(p_artifact uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v uuid; a_project uuid;
begin
  if p_decision not in ('approve', 'object') then raise exception 'invalid decision' using errcode = '22023'; end if;
  if not exists (select 1 from app.required_signers(p_artifact) r where r.creator_id = app.current_creator_id()) then
    raise exception 'no sign-off needed' using errcode = '42501';
  end if;
  select current_version_id into v from public.artifacts where id = p_artifact;
  insert into public.publication_signoffs(artifact_id, version_id, creator_id, decision, note)
  values (p_artifact, v, app.current_creator_id(), p_decision, nullif(trim(p_note), ''))
  on conflict (artifact_id, version_id, creator_id) do update set decision = excluded.decision, note = excluded.note, created_at = now();
  for a_project in select i.project_id from public.project_items i where i.artifact_id = p_artifact and i.kind = 'artifact' loop
    perform app.project_rights_log(a_project, 'publication_' || case when p_decision = 'approve' then 'signed_off' else 'objected' end,
      jsonb_build_object('artifact', p_artifact, 'version', v));
  end loop;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.assert_ownership(uuid, uuid, text, text, numeric)', 'public.respond_ownership_assertion(uuid, text, text)',
    'public.publication_signoff_status(uuid)', 'public.sign_off_publication(uuid, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Publishing now checks the sign-offs (the rest of approve_publication is unchanged).
create or replace function public.approve_publication(p_publication uuid)
returns public.publications language plpgsql security definer set search_path = ''
as $$
declare p public.publications; v uuid;
begin
  select * into p from public.publications where id = p_publication and creator_id = app.current_creator_id() for update;
  if p.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if p.status <> 'draft' then raise exception 'This publication was already approved or closed.' using errcode = '55000'; end if;
  if p.destination_kind = 'webhook' and not exists (select 1 from public.publishing_destinations d where d.id = p.destination_id and d.status = 'active') then
    raise exception 'That destination is no longer connected.' using errcode = '55000';
  end if;
  select current_version_id into v from public.artifacts where id = p.artifact_id and status <> 'archived';
  if v is null then raise exception 'This piece has nothing to publish yet.' using errcode = '55000'; end if;
  if exists (
    select 1 from app.required_signers(p.artifact_id) r
    where not exists (select 1 from public.publication_signoffs s where s.artifact_id = p.artifact_id and s.version_id = v and s.creator_id = r.creator_id and s.decision = 'approve')
  ) then
    raise exception 'Your collaborators need to sign off on this version before it can be published.' using errcode = '55000';
  end if;
  update public.publications
    set approved_at = now(), version_id = v,
        status = case when scheduled_for is not null and scheduled_for > now() then 'scheduled' else 'approved' end
  where id = p.id returning * into p;
  perform app.record_audit('publication.approved', 'publication', p.id,
    jsonb_build_object('artifact_id', p.artifact_id, 'destination', p.destination_kind, 'scheduled_for', p.scheduled_for), null);
  return p;
end $$;

-- Rights summary per piece of a project: readable by everyone in the project (the rights records themselves stay
-- owner/collaborator-only). Licensee names aren't exposed — only counts.
create or replace function public.project_rights_summary(p_project uuid)
returns table (
  artifact_id uuid, title text, owner_id uuid, owner_name text, ownership_kind text, copyright_holder text,
  attribution_required boolean, derivatives_allowed boolean, co_owners jsonb, collaborators jsonb, signoffs jsonb,
  active_licenses int, exclusive_licenses int
) language sql stable security definer set search_path = ''
as $$
  select a.id, a.title, a.creator_id, c.display_name, r.ownership_kind, r.copyright_holder,
    coalesce(r.attribution_required, true), coalesce(r.derivatives_allowed, false),
    coalesce((select jsonb_agg(jsonb_build_object('name', o.owner_name, 'creatorId', o.owner_creator_id, 'share', o.share_percent) order by o.share_percent desc)
              from public.rights_owners o where o.rights_id = r.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('creatorId', ac.contributor_creator_id, 'name', cc.display_name, 'role', ac.role, 'access', ac.access) order by ac.created_at)
              from public.artifact_contributors ac join public.creators cc on cc.id = ac.contributor_creator_id where ac.artifact_id = a.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('creatorId', rs.creator_id, 'name', sc.display_name, 'decision', so.decision, 'note', so.note, 'at', so.created_at))
              from app.required_signers(a.id) rs join public.creators sc on sc.id = rs.creator_id
              left join public.publication_signoffs so on so.artifact_id = a.id and so.version_id = a.current_version_id and so.creator_id = rs.creator_id), '[]'::jsonb),
    (select count(*)::int from public.licenses l where l.rights_id = r.id and l.status = 'active'),
    (select count(*)::int from public.licenses l where l.rights_id = r.id and l.status = 'active' and l.exclusive)
  from public.project_items i
  join public.artifacts a on a.id = i.artifact_id
  join public.creators c on c.id = a.creator_id
  left join public.rights_records r on r.artifact_id = a.id
  where i.project_id = p_project and i.kind = 'artifact' and app.can_read_project(p_project)
  order by a.title
$$;

-- May the caller make a derivative of this piece? The project policy is applied on top of the piece's own record:
-- 'not_allowed' blocks everyone but the owner; 'crew_allowed' lets people in the project adapt pieces they can read;
-- 'owner_approval' (default) defers to the piece's rights record (the owner allows it there or through a license).
create or replace function public.derivative_permission(p_artifact uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when not app.can_read_artifact(a.id) then 'not_found'
    when a.creator_id = app.current_creator_id() then 'allowed'
    when exists (select 1 from public.project_items i join public.project_rights_policies p on p.project_id = i.project_id
                 where i.artifact_id = a.id and p.derivatives = 'not_allowed') then 'project_not_allowed'
    when exists (select 1 from public.project_items i join public.project_rights_policies p on p.project_id = i.project_id
                 where i.artifact_id = a.id and p.derivatives = 'crew_allowed' and app.project_role(i.project_id) is not null) then 'allowed'
    when coalesce((select r.derivatives_allowed from public.rights_records r where r.artifact_id = a.id), false) then 'allowed'
    else 'not_allowed'
  end
  from public.artifacts a where a.id = p_artifact
$$;

do $$
declare f text;
begin
  foreach f in array array['public.project_rights_summary(uuid)', 'public.derivative_permission(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
