-- P1-18 CreatorMarket Foundation (plan §39): the architecture for offering licenses to a Creation — not a marketplace.
-- A listing is a creator's offer of a license on their own Creation: what is licensed (use, exclusivity, territory,
-- duration, channels, derivatives, credit), price metadata, quantity/edition, availability and state. There are no
-- purchases, payments or payouts here; the app keeps all of it behind a feature flag until the transaction path is
-- production-ready (plan §39 "P1 UI"). Every state change goes through one function that decides who may act and
-- whether the Creation is eligible, and records a domain event.

create table public.market_listings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  summary text check (summary is null or char_length(summary) <= 1000),
  license_type text not null check (license_type in ('personal', 'commercial', 'editorial', 'promotional', 'educational', 'internal')),
  exclusive boolean not null default false,
  territory text not null default 'Worldwide' check (char_length(territory) between 1 and 120),
  duration_days int check (duration_days is null or duration_days between 1 and 36500),
  usage_channels text[] not null default '{}' check (app.valid_usage_channels(usage_channels)),
  derivatives_allowed boolean not null default false,
  attribution_required boolean not null default true,
  -- Price metadata only: Wonder Creator doesn't take payments.
  price_amount numeric(14, 2) check (price_amount is null or (price_amount >= 0 and price_amount < 1e12)),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  -- Quantity: null = open (non-exclusive); an edition sells a set number; an exclusive offer is one.
  edition_size int check (edition_size is null or edition_size between 1 and 100000),
  editions_taken int not null default 0 check (editions_taken >= 0),
  available_from date,
  available_until date,
  state text not null default 'draft' check (state in ('draft', 'listed', 'paused', 'withdrawn', 'sold_out')),
  listed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((price_amount is null) = (currency is null)),
  check (available_until is null or available_from is null or available_until >= available_from),
  check (not exclusive or edition_size is null or edition_size = 1),
  check (edition_size is null or editions_taken <= edition_size)
);
create index market_listings_creator_idx on public.market_listings(creator_id, updated_at desc);
create index market_listings_artifact_idx on public.market_listings(artifact_id);
create index market_listings_listed_idx on public.market_listings(listed_at desc) where state = 'listed';
create trigger market_listings_touch before update on public.market_listings for each row execute function app.touch_updated_at();

-- Eligibility — the single authority (@wonder/creator-studio/market words each reason in INELIGIBLE_REASON): what must
-- be true of the Creation and its rights record before an offer can be listed. Returns the reasons it can't (empty =
-- eligible). Facts only.
create or replace function app.market_ineligibility(p_listing public.market_listings)
returns text[] language plpgsql stable security definer set search_path = ''
as $$
declare a public.artifacts; r public.rights_records; v_total numeric; v_reasons text[] := '{}';
begin
  select * into a from public.artifacts where id = p_listing.artifact_id;
  select * into r from public.rights_records where artifact_id = p_listing.artifact_id;
  if a.id is null or a.creator_id <> p_listing.creator_id then return array['not_owner']; end if;
  if a.status not in ('final', 'published') then v_reasons := array_append(v_reasons, 'not_finished'); end if;
  if r.id is null then return array_append(v_reasons, 'no_rights_record'); end if;
  if r.ownership_kind = 'transferred' then v_reasons := array_append(v_reasons, 'ownership_transferred'); end if;
  select coalesce(sum(share_percent), 0) into v_total from public.rights_owners where rights_id = r.id;
  if v_total <> 100 then v_reasons := array_append(v_reasons, 'ownership_incomplete'); end if;
  if nullif(trim(r.copyright_holder), '') is null then v_reasons := array_append(v_reasons, 'no_copyright_holder'); end if;
  if p_listing.license_type = 'commercial' and r.commercial_use = 'not_offered' then v_reasons := array_append(v_reasons, 'commercial_not_offered'); end if;
  if p_listing.derivatives_allowed and not r.derivatives_allowed then v_reasons := array_append(v_reasons, 'derivatives_not_allowed'); end if;
  -- An exclusive offer can't sit beside a live license of the same use, nor beside another live exclusive offer.
  if p_listing.exclusive and exists (
    select 1 from public.licenses l where l.rights_id = r.id and l.status = 'active' and l.license_type = p_listing.license_type and (l.ends_on is null or l.ends_on >= current_date)
  ) then v_reasons := array_append(v_reasons, 'active_license_conflict'); end if;
  if exists (
    select 1 from public.market_listings m where m.artifact_id = p_listing.artifact_id and m.id <> p_listing.id and m.state = 'listed'
      and m.license_type = p_listing.license_type and (m.exclusive or p_listing.exclusive)
  ) then v_reasons := array_append(v_reasons, 'listing_conflict'); end if;
  if p_listing.available_until is not null and p_listing.available_until < current_date then v_reasons := array_append(v_reasons, 'availability_ended'); end if;
  return v_reasons;
end $$;
revoke execute on function app.market_ineligibility(public.market_listings) from public, anon, authenticated;

alter table public.market_listings enable row level security;
-- The creator sees their own listings; anyone who can see a Creation sees its live offers.
create policy market_listings_read on public.market_listings for select to authenticated
  using (creator_id = app.current_creator_id() or (state = 'listed' and app.can_read_artifact(artifact_id)));
-- Drafts are the creator's to write, on their own Creations; state changes go through market_set_listing_state().
create policy market_listings_insert on public.market_listings for insert to authenticated
  with check (creator_id = app.current_creator_id() and app.owns_artifact(artifact_id) and state = 'draft' and listed_at is null and editions_taken = 0);
create policy market_listings_update on public.market_listings for update to authenticated
  using (creator_id = app.current_creator_id() and state in ('draft', 'paused'))
  with check (creator_id = app.current_creator_id() and app.owns_artifact(artifact_id) and state in ('draft', 'paused'));
create policy market_listings_delete on public.market_listings for delete to authenticated
  using (creator_id = app.current_creator_id() and state = 'draft');
-- Terms are editable while a draft or paused; state, dates of listing and editions taken are not client-writable.
revoke update on public.market_listings from authenticated;
grant update (title, summary, license_type, exclusive, territory, duration_days, usage_channels, derivatives_allowed, attribution_required,
  price_amount, currency, edition_size, available_from, available_until) on public.market_listings to authenticated;

-- The one way a listing changes state: draft → listed ⇄ paused → withdrawn (withdrawn is final). Listing requires
-- eligibility; every change is a domain event and an audit entry.
create or replace function public.market_set_listing_state(p_listing uuid, p_state text)
returns public.market_listings language plpgsql security definer set search_path = ''
as $$
declare m public.market_listings; v_reasons text[];
begin
  select * into m from public.market_listings where id = p_listing for update;
  if m.id is null or m.creator_id <> app.current_creator_id() then raise exception 'listing not found' using errcode = 'P0002'; end if;
  if p_state not in ('listed', 'paused', 'withdrawn') then raise exception 'unknown state' using errcode = '22023'; end if;
  if m.state = 'withdrawn' then raise exception 'this listing was withdrawn' using errcode = '55000'; end if;
  if m.state = p_state then return m; end if;
  if p_state = 'paused' and m.state <> 'listed' then raise exception 'only a live listing can be paused' using errcode = '55000'; end if;
  if p_state = 'listed' then
    if m.state not in ('draft', 'paused') then raise exception 'this listing can''t be listed now' using errcode = '55000'; end if;
    v_reasons := app.market_ineligibility(m);
    if cardinality(v_reasons) > 0 then raise exception 'not eligible: %', array_to_string(v_reasons, ',') using errcode = '22023'; end if;
  end if;
  update public.market_listings set state = p_state, listed_at = case when p_state = 'listed' then coalesce(listed_at, now()) else listed_at end
  where id = p_listing returning * into m;
  perform app.record_event('MarketListingStateChanged', 'market_listing', m.id, jsonb_build_object('state', p_state, 'artifactId', m.artifact_id, 'licenseType', m.license_type, 'exclusive', m.exclusive));
  perform app.record_audit('market.listing_' || p_state, 'market_listing', m.id, jsonb_build_object('artifactId', m.artifact_id));
  return m;
end $$;
revoke execute on function public.market_set_listing_state(uuid, text) from public, anon;
grant execute on function public.market_set_listing_state(uuid, text) to authenticated;

-- What's missing before a listing could go live (for the creator's own drafts).
create or replace function public.market_listing_readiness(p_listing uuid)
returns text[] language sql stable security definer set search_path = ''
as $$
  select app.market_ineligibility(m) from public.market_listings m where m.id = p_listing and m.creator_id = app.current_creator_id()
$$;
revoke execute on function public.market_listing_readiness(uuid) from public, anon;
grant execute on function public.market_listing_readiness(uuid) to authenticated;
