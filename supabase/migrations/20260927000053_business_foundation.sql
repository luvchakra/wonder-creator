-- P1-19 CreatorBusiness Foundation (plan §40): the economic records Wonder Creator's domains produce, kept for the
-- creator — not accounting software. CreatorBusiness *consumes* domain events and never owns artifact, rights,
-- campaign or market truth: a record points back at its source, and its amount comes from the event.
-- Wonder Creator takes no payments, so income starts "expected" and the creator marks it received (payout state).

-- 1. Economic events from the domains that own them ----------------------------------------------------------------
-- A license with a fee becoming active is an economic event of the rights domain.
create or replace function app.emit_license_activated()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') and coalesce(new.fee_amount, 0) > 0 and new.fee_currency is not null then
    perform app.record_event('LicenseActivated', 'license', new.id, jsonb_build_object(
      'ownerCreatorId', new.creator_id,
      'artifactId', (select r.artifact_id from public.rights_records r where r.id = new.rights_id),
      'amount', new.fee_amount,
      'currency', new.fee_currency,
      'licensee', new.licensee_name,
      'licenseType', new.license_type,
      'mode', new.mode
    ));
  end if;
  return new;
end $$;
create trigger licenses_emit_activated after insert or update of status on public.licenses
  for each row execute function app.emit_license_activated();

-- 2. The ledger ------------------------------------------------------------------------------------------------------
create table public.business_records (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  kind text not null check (kind in ('brand_income', 'artifact_sale', 'license_income', 'collaboration_compensation', 'provider_cost', 'payout')),
  direction text not null check (direction in ('in', 'out')),
  amount numeric(14, 2) not null check (amount >= 0 and amount < 1e12),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'expected' check (status in ('expected', 'received', 'paid', 'cancelled')),
  occurred_on date not null default current_date,
  counterparty text check (counterparty is null or char_length(counterparty) <= 120),
  description text check (description is null or char_length(description) <= 300),
  note text check (note is null or char_length(note) <= 1000),
  -- Where it came from: a domain object (never owned here) or the creator's own entry.
  source_type text not null check (source_type in ('license', 'campaign', 'market_listing', 'project', 'provider', 'manual')),
  source_id uuid,
  artifact_id uuid references public.artifacts(id) on delete set null,
  -- The domain event this record was made from; unique, so an event is consumed at most once.
  source_event_id uuid unique references public.domain_events(id) on delete set null,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((direction = 'in') = (kind in ('brand_income', 'artifact_sale', 'license_income', 'collaboration_compensation'))),
  check (status not in ('received') or direction = 'in'),
  check (status not in ('paid') or direction = 'out'),
  check ((source_type = 'manual') = (source_event_id is null))
);
create index business_records_creator_idx on public.business_records(creator_id, occurred_on desc);
create trigger business_records_touch before update on public.business_records for each row execute function app.touch_updated_at();

-- 3. The consumer: domain events → records (idempotent via event_consumptions + the unique source_event_id) --------------
create or replace function app.business_consume_event()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_owner uuid;
begin
  if new.event_type = 'LicenseActivated' then
    v_owner := nullif(new.payload->>'ownerCreatorId', '')::uuid;
    if v_owner is null then return new; end if;
    -- Re-activating the same license isn't new income: one live record per license.
    if not exists (select 1 from public.business_records b where b.source_type = 'license' and b.source_id = new.aggregate_id and b.status <> 'cancelled') then
    insert into public.business_records (creator_id, kind, direction, amount, currency, status, counterparty, description, source_type, source_id, artifact_id, source_event_id)
    values (v_owner, 'license_income', 'in', (new.payload->>'amount')::numeric, upper(new.payload->>'currency'), 'expected',
            left(new.payload->>'licensee', 120), left(initcap(coalesce(new.payload->>'licenseType', '')) || ' license', 300), 'license', new.aggregate_id,
            nullif(new.payload->>'artifactId', '')::uuid, new.id)
    on conflict (source_event_id) do nothing;
    end if;
    insert into public.event_consumptions (consumer, event_id) values ('creator_business', new.id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger domain_events_business after insert on public.domain_events
  for each row execute function app.business_consume_event();

-- 4. Access -----------------------------------------------------------------------------------------------------------
alter table public.business_records enable row level security;
create policy business_records_read on public.business_records for select to authenticated using (creator_id = app.current_creator_id());
-- The creator adds their own entries (brand income, costs, payouts…); records from events come only from the consumer.
create policy business_records_insert on public.business_records for insert to authenticated
  with check (creator_id = app.current_creator_id() and source_type = 'manual' and source_event_id is null and settled_at is null
    and (artifact_id is null or app.owns_artifact(artifact_id)));
create policy business_records_update on public.business_records for update to authenticated
  using (creator_id = app.current_creator_id()) with check (creator_id = app.current_creator_id());
create policy business_records_delete on public.business_records for delete to authenticated
  using (creator_id = app.current_creator_id() and source_type = 'manual');
-- Amounts from events are the source's truth; the creator changes only the status and their note.
revoke update on public.business_records from authenticated;
grant update (status, note) on public.business_records to authenticated;

-- Settling stamps the time; reopening clears it.
create or replace function app.business_settled_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status in ('received', 'paid') and old.status not in ('received', 'paid') then new.settled_at := now();
  elsif new.status not in ('received', 'paid') then new.settled_at := null;
  end if;
  return new;
end $$;
create trigger business_records_settled before update of status on public.business_records
  for each row execute function app.business_settled_at();
