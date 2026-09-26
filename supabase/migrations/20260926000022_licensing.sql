-- P0.1-08 License creation & license requests.
-- Licenses gain a mode (free, free with license, paid non-exclusive, limited edition, exclusive), recorded
-- terms (fee, edition size, permitted use) and a licensee creator. Fees are terms on record only: Wonder
-- Creator doesn't take payments here. Other creators can request a license for work they can see; the
-- owner approves, declines or counters; the requester can accept a counter or withdraw. Every step lands in
-- the rights history. Status changes go through these security-definer functions, never direct updates.

-- 1. License terms ----------------------------------------------------------------------------------------
alter table public.licenses
  add column mode text not null default 'free_license' check (mode in ('free', 'free_license', 'paid_nonexclusive', 'limited_edition', 'exclusive')),
  add column fee_amount numeric(12, 2) check (fee_amount is null or fee_amount >= 0),
  add column fee_currency text check (fee_currency is null or fee_currency ~ '^[A-Z]{3}$'),
  add column edition_size int check (edition_size is null or edition_size between 1 and 100000),
  add column permitted_use text check (permitted_use is null or char_length(permitted_use) <= 1000),
  add column licensee_creator_id uuid references public.creators(id) on delete set null;
alter table public.licenses add constraint licenses_mode_terms check (
  (mode <> 'exclusive' or exclusive)
  and (mode <> 'paid_nonexclusive' or (not exclusive and fee_amount is not null and fee_currency is not null))
  and (mode <> 'limited_edition' or edition_size is not null)
);
create index licenses_licensee_creator_id_fk_idx on public.licenses(licensee_creator_id);

-- License terms are private to the owner and the licensee (public work shows its rights summary, not deals).
drop policy licenses_read on public.licenses;
create policy licenses_read on public.licenses for select to authenticated
  using (creator_id = app.current_creator_id() or licensee_creator_id = app.current_creator_id());

-- 2. License requests -------------------------------------------------------------------------------------
create table public.license_requests (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  owner_creator_id uuid not null references public.creators(id) on delete cascade,
  requester_creator_id uuid not null references public.creators(id) on delete cascade,
  proposed_use text not null check (char_length(proposed_use) between 1 and 2000),
  terms jsonb not null check (jsonb_typeof(terms) = 'object' and pg_column_size(terms) <= 8192),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'countered', 'withdrawn')),
  counter_terms jsonb check (counter_terms is null or (jsonb_typeof(counter_terms) = 'object' and pg_column_size(counter_terms) <= 8192)),
  response_note text check (response_note is null or char_length(response_note) <= 1000),
  license_id uuid references public.licenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  check (owner_creator_id <> requester_creator_id)
);
create index license_requests_owner_idx on public.license_requests(owner_creator_id, status, created_at desc);
create index license_requests_requester_idx on public.license_requests(requester_creator_id, created_at desc);
create index license_requests_artifact_id_fk_idx on public.license_requests(artifact_id);
create index license_requests_license_id_fk_idx on public.license_requests(license_id);
-- One open request per requester per piece.
create unique index license_requests_one_open on public.license_requests(artifact_id, requester_creator_id) where status in ('pending', 'countered');
create trigger license_requests_touch before update on public.license_requests
  for each row execute function app.touch_updated_at();

alter table public.license_requests enable row level security;
create policy license_requests_read on public.license_requests for select to authenticated
  using (requester_creator_id = app.current_creator_id() or owner_creator_id = app.current_creator_id());
-- Requests are for work the requester can see and doesn't own, addressed to its owner, and start pending.
create policy license_requests_insert on public.license_requests for insert to authenticated
  with check (
    requester_creator_id = app.current_creator_id()
    and status = 'pending' and counter_terms is null and response_note is null and license_id is null and responded_at is null
    and app.can_read_artifact(artifact_id)
    and exists (select 1 from public.artifacts a where a.id = artifact_id and a.creator_id = owner_creator_id and a.creator_id <> app.current_creator_id())
  );
-- No update/delete policies: changes go through the functions below.

-- 3. Turning terms into a license ------------------------------------------------------------------------
create or replace function app.license_from_terms(p_request public.license_requests, p_terms jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_rights uuid; v_license uuid; v_mode text := coalesce(p_terms->>'mode', 'free_license');
begin
  select id into v_rights from public.rights_records where artifact_id = p_request.artifact_id;
  if v_rights is null then raise exception 'no rights record' using errcode = 'P0002'; end if;
  insert into public.licenses (
    rights_id, creator_id, license_type, mode, licensee_name, licensee_creator_id, permitted_use, exclusive, territory,
    starts_on, ends_on, modification_allowed, derivatives_allowed, resale_allowed, attribution_required,
    fee_amount, fee_currency, edition_size, status
  )
  values (
    v_rights, p_request.owner_creator_id,
    coalesce(p_terms->>'license_type', 'personal'), v_mode,
    (select display_name from public.creators where id = p_request.requester_creator_id), p_request.requester_creator_id,
    left(p_request.proposed_use, 1000),
    coalesce((p_terms->>'exclusive')::boolean, v_mode = 'exclusive'),
    coalesce(nullif(p_terms->>'territory', ''), 'Worldwide'),
    nullif(p_terms->>'starts_on', '')::date, nullif(p_terms->>'ends_on', '')::date,
    coalesce((p_terms->>'modification_allowed')::boolean, false), coalesce((p_terms->>'derivatives_allowed')::boolean, false),
    coalesce((p_terms->>'resale_allowed')::boolean, false), coalesce((p_terms->>'attribution_required')::boolean, true),
    nullif(p_terms->>'fee_amount', '')::numeric, nullif(p_terms->>'fee_currency', ''), nullif(p_terms->>'edition_size', '')::int,
    'active'
  )
  returning id into v_license;
  return v_license;
end $$;
revoke execute on function app.license_from_terms(public.license_requests, jsonb) from public, anon, authenticated;

-- 4. Owner: approve / decline / counter --------------------------------------------------------------------
create or replace function public.respond_license_request(p_request uuid, p_decision text, p_note text default null, p_counter jsonb default null)
returns public.license_requests language plpgsql security definer set search_path = ''
as $$
declare r public.license_requests; v_license uuid;
begin
  select * into r from public.license_requests where id = p_request for update;
  if r.id is null or r.owner_creator_id <> app.current_creator_id() then raise exception 'not found' using errcode = 'P0002'; end if;
  if r.status <> 'pending' then raise exception 'This request has already been answered.' using errcode = '55000'; end if;
  if p_note is not null and char_length(p_note) > 1000 then raise exception 'note too long' using errcode = '22001'; end if;
  if p_decision = 'approve' then
    v_license := app.license_from_terms(r, r.terms);
    update public.license_requests set status = 'approved', license_id = v_license, response_note = p_note, responded_at = now() where id = r.id returning * into r;
  elsif p_decision = 'decline' then
    update public.license_requests set status = 'declined', response_note = p_note, responded_at = now() where id = r.id returning * into r;
  elsif p_decision = 'counter' then
    if p_counter is null or jsonb_typeof(p_counter) <> 'object' then raise exception 'counter terms required' using errcode = '22023'; end if;
    update public.license_requests set status = 'countered', counter_terms = p_counter, response_note = p_note, responded_at = now() where id = r.id returning * into r;
  else
    raise exception 'unknown decision' using errcode = '22023';
  end if;
  return r;
end $$;
revoke execute on function public.respond_license_request(uuid, text, text, jsonb) from public, anon;
grant execute on function public.respond_license_request(uuid, text, text, jsonb) to authenticated;

-- 5. Requester: accept a counter / withdraw ---------------------------------------------------------------
create or replace function public.act_on_license_request(p_request uuid, p_action text)
returns public.license_requests language plpgsql security definer set search_path = ''
as $$
declare r public.license_requests; v_license uuid;
begin
  select * into r from public.license_requests where id = p_request for update;
  if r.id is null or r.requester_creator_id <> app.current_creator_id() then raise exception 'not found' using errcode = 'P0002'; end if;
  if p_action = 'accept_counter' then
    if r.status <> 'countered' then raise exception 'There is no counter-offer to accept.' using errcode = '55000'; end if;
    v_license := app.license_from_terms(r, r.counter_terms);
    update public.license_requests set status = 'approved', license_id = v_license where id = r.id returning * into r;
  elsif p_action = 'withdraw' then
    if r.status not in ('pending', 'countered') then raise exception 'This request is already closed.' using errcode = '55000'; end if;
    update public.license_requests set status = 'withdrawn' where id = r.id returning * into r;
  else
    raise exception 'unknown action' using errcode = '22023';
  end if;
  return r;
end $$;
revoke execute on function public.act_on_license_request(uuid, text) from public, anon;
grant execute on function public.act_on_license_request(uuid, text) to authenticated;

-- 6. Request steps in the rights history -------------------------------------------------------------------
create or replace function app.log_license_request()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_rights uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  select id into v_rights from public.rights_records where artifact_id = new.artifact_id;
  if v_rights is null then return new; end if;
  insert into public.rights_events(rights_id, creator_id, event, details)
  values (v_rights, new.owner_creator_id,
          case when tg_op = 'INSERT' then 'license.requested' else 'license.request_' || new.status end,
          jsonb_build_object('request_id', new.id, 'requester', (select display_name from public.creators where id = new.requester_creator_id),
                             'license_type', coalesce(new.counter_terms, new.terms)->>'license_type', 'mode', coalesce(new.counter_terms, new.terms)->>'mode'));
  return new;
end $$;
create trigger license_requests_log after insert or update on public.license_requests
  for each row execute function app.log_license_request();
revoke execute on function app.log_license_request() from public, anon, authenticated;
