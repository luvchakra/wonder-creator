-- Payments (owner, 2 Oct 2026): Stripe and Razorpay collect licence fees — docs/compliance/payments.md.
--
-- Money truth lives here, written only by the server: the browser never creates, changes or settles an order. Orders
-- are opened through a security-definer function that checks the licence (active, paid, the caller is its owner or
-- licensee) and takes the amount from it, never from the request. Provider webhooks (verified by signature in the
-- app) are applied by `payment_apply_event` — idempotent on the provider's event id — which moves the order, posts a
-- balanced double-entry journal and settles the creator's business record, in one transaction. Ledger and provider
-- events are append-only. Card and bank details never reach us (hosted checkout; PCI DSS SAQ-A scope).

-- ------------------------------------------------------------------------------------------------ helpers
-- Minor units per ISO 4217 currency (Stripe/Razorpay amounts are integers in the minor unit).
create or replace function app.currency_exponent(p_currency text)
returns int language sql immutable set search_path = ''
as $$
  select case
    when p_currency in ('BIF','CLP','DJF','GNF','ISK','JPY','KMF','KRW','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF') then 0
    when p_currency in ('BHD','JOD','KWD','OMR','TND') then 3
    else 2 end
$$;

-- Audit on behalf of a specific creator (webhooks run without a session); visible in that creator's history.
create or replace function app.record_audit_for(p_creator uuid, p_action text, p_object_type text, p_object_id uuid, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_logs(tenant_id, actor_user_id, actor_creator_id, action, object_type, object_id, metadata)
  select c.tenant_id, null, c.id, p_action, p_object_type, p_object_id, coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('via', 'server')
  from public.creators c where c.id = p_creator;
end $$;
revoke execute on function app.record_audit_for(uuid, text, text, uuid, jsonb) from public, anon, authenticated;

-- ------------------------------------------------------------------------------------------------ orders
create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  -- The payee: the creator whose licence is being paid for. Financial records outlive an erased account (statutory
  -- retention) but no longer link to it.
  creator_id uuid references public.creators(id) on delete set null,
  payer_creator_id uuid references public.creators(id) on delete set null,
  opened_by uuid references public.creators(id) on delete set null,
  license_id uuid references public.licenses(id) on delete set null,
  artifact_id uuid references public.artifacts(id) on delete set null,
  description text not null check (char_length(description) between 1 and 200),
  amount_minor bigint not null check (amount_minor > 0 and amount_minor < 1e13),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider text check (provider in ('stripe', 'razorpay')),
  provider_order_ref text check (char_length(provider_order_ref) <= 200),
  provider_payment_ref text check (char_length(provider_payment_ref) <= 200),
  checkout_url text check (checkout_url ~ '^https://' and char_length(checkout_url) <= 2000),
  status text not null default 'created' check (status in ('created', 'open', 'paid', 'failed', 'expired', 'cancelled', 'refunded', 'partially_refunded')),
  refunded_minor bigint not null default 0 check (refunded_minor >= 0 and refunded_minor <= amount_minor),
  expires_at timestamptz not null default now() + interval '24 hours',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_order_ref)
);
-- One live order per licence: asking again reuses it (no duplicate charges).
create unique index payment_orders_one_open on public.payment_orders(license_id) where status in ('created', 'open');
-- A licence is paid once.
create unique index payment_orders_one_paid on public.payment_orders(license_id) where status in ('paid', 'partially_refunded');
create index payment_orders_creator_idx on public.payment_orders(creator_id, created_at desc);
create index payment_orders_payer_idx on public.payment_orders(payer_creator_id, created_at desc);
create trigger payment_orders_touch before update on public.payment_orders for each row execute function app.touch_updated_at();

alter table public.payment_orders enable row level security;
create policy payment_orders_read on public.payment_orders for select to authenticated
  using (creator_id = app.current_creator_id() or payer_creator_id = app.current_creator_id());
revoke insert, update, delete, truncate on public.payment_orders from authenticated, anon;

-- ------------------------------------------------------------------------------------------------ provider events
create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null check (provider in ('stripe', 'razorpay')),
  provider_event_id text not null check (char_length(provider_event_id) between 1 and 200),
  event_type text not null check (char_length(event_type) <= 100),
  order_id uuid references public.payment_orders(id) on delete restrict,
  -- What we acted on (ids, amounts, status) — never card data or the full payload.
  summary jsonb not null default '{}'::jsonb,
  body_sha256 text not null check (body_sha256 ~ '^[0-9a-f]{64}$'),
  outcome text not null check (outcome in ('applied', 'ignored', 'duplicate_state', 'unmatched')),
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);
create trigger payment_events_immutable before update or delete on public.payment_events for each row execute function app.prevent_mutation();
alter table public.payment_events enable row level security;
-- Operators only (service role); creators see the effect on their orders and ledger.
revoke all on public.payment_events from authenticated, anon;

-- ------------------------------------------------------------------------------------------------ refunds
create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.payment_orders(id) on delete restrict,
  creator_id uuid references public.creators(id) on delete set null,
  requested_by uuid references public.creators(id) on delete set null,
  amount_minor bigint not null check (amount_minor > 0),
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'requested' check (status in ('requested', 'pending', 'succeeded', 'failed')),
  provider_refund_ref text check (char_length(provider_refund_ref) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  settled_at timestamptz
);
create unique index payment_refunds_provider_ref on public.payment_refunds(provider_refund_ref) where provider_refund_ref is not null;
create index payment_refunds_order_idx on public.payment_refunds(order_id);
create trigger payment_refunds_touch before update on public.payment_refunds for each row execute function app.touch_updated_at();
alter table public.payment_refunds enable row level security;
create policy payment_refunds_read on public.payment_refunds for select to authenticated
  using (creator_id = app.current_creator_id() or exists (select 1 from public.payment_orders o where o.id = order_id and o.payer_creator_id = app.current_creator_id()));
revoke insert, update, delete, truncate on public.payment_refunds from authenticated, anon;

-- ------------------------------------------------------------------------------------------------ ledger
-- Double entry, append-only. Every journal balances per currency (checked when it's posted). Accounts:
--   provider_clearing:<provider>  money held by the payment provider for us (asset)
--   creator_payable               what we owe the creator (liability)
create table public.ledger_entries (
  id bigint generated always as identity primary key,
  journal_id uuid not null,
  -- No foreign key: entries are immutable and outlive an erased account (like audit_logs).
  creator_id uuid not null,
  account text not null check (account ~ '^[a-z_]+(:[a-z_]+)?$'),
  debit_minor bigint not null default 0 check (debit_minor >= 0),
  credit_minor bigint not null default 0 check (credit_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  order_id uuid references public.payment_orders(id) on delete restrict,
  refund_id uuid references public.payment_refunds(id) on delete restrict,
  memo text not null check (char_length(memo) <= 200),
  posted_at timestamptz not null default now(),
  check ((debit_minor = 0) <> (credit_minor = 0))
);
create index ledger_entries_creator_idx on public.ledger_entries(creator_id, posted_at desc);
create index ledger_entries_journal_idx on public.ledger_entries(journal_id);
create index ledger_entries_order_idx on public.ledger_entries(order_id);
create trigger ledger_entries_immutable before update or delete on public.ledger_entries for each row execute function app.prevent_mutation();
alter table public.ledger_entries enable row level security;
create policy ledger_entries_read on public.ledger_entries for select to authenticated using (creator_id = app.current_creator_id());
revoke insert, update, delete, truncate on public.ledger_entries from authenticated, anon;
revoke truncate on public.payment_events, public.payment_orders, public.payment_refunds from service_role;
revoke truncate, update, delete on public.ledger_entries from service_role;

create or replace function app.post_journal(p_creator uuid, p_currency text, p_memo text, p_order uuid, p_refund uuid, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_journal uuid := gen_random_uuid();
  v_dr bigint;
  v_cr bigint;
begin
  select coalesce(sum((l->>'debit')::bigint), 0), coalesce(sum((l->>'credit')::bigint), 0) into v_dr, v_cr from jsonb_array_elements(p_lines) l;
  if v_dr <> v_cr or v_dr = 0 then raise exception 'unbalanced journal' using errcode = '23514'; end if;
  insert into public.ledger_entries(journal_id, creator_id, account, debit_minor, credit_minor, currency, order_id, refund_id, memo)
  select v_journal, p_creator, l->>'account', coalesce((l->>'debit')::bigint, 0), coalesce((l->>'credit')::bigint, 0), p_currency, p_order, p_refund, p_memo
  from jsonb_array_elements(p_lines) l;
  return v_journal;
end $$;
revoke execute on function app.post_journal(uuid, text, text, uuid, uuid, jsonb) from public, anon, authenticated;

-- Business records can now be settled by a payment (and say which).
alter table public.business_records add column payment_order_id uuid references public.payment_orders(id) on delete restrict;
create index business_records_payment_idx on public.business_records(payment_order_id);

-- ------------------------------------------------------------------------------------------------ open an order
-- Called with the creator's session. The amount, currency and payee come from the licence, never from the caller.
create or replace function public.payment_order_open(p_license uuid)
returns public.payment_orders language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := app.current_creator_id();
  l public.licenses;
  v_artifact uuid;
  v_title text;
  o public.payment_orders;
begin
  if v_me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into l from public.licenses where id = p_license;
  if not found or (l.creator_id <> v_me and l.licensee_creator_id is distinct from v_me) then
    raise exception 'license not found' using errcode = 'P0002';
  end if;
  if l.status <> 'active' then raise exception 'only an active licence can be paid' using errcode = '22023'; end if;
  if coalesce(l.fee_amount, 0) <= 0 or l.fee_currency is null then raise exception 'this licence has no fee' using errcode = '22023'; end if;
  if exists (select 1 from public.payment_orders p where p.license_id = l.id and p.status in ('paid', 'partially_refunded', 'refunded')) then
    raise exception 'this licence is already paid' using errcode = '23505';
  end if;
  -- Reuse the live order (stale ones expire first).
  update public.payment_orders set status = 'expired' where license_id = l.id and status in ('created', 'open') and expires_at < now();
  select * into o from public.payment_orders where license_id = l.id and status in ('created', 'open');
  if found then return o; end if;
  select r.artifact_id, a.title into v_artifact, v_title from public.rights_records r left join public.artifacts a on a.id = r.artifact_id where r.id = l.rights_id;
  insert into public.payment_orders(creator_id, payer_creator_id, opened_by, license_id, artifact_id, description, amount_minor, currency)
  values (l.creator_id, l.licensee_creator_id, v_me, l.id, v_artifact,
          left(initcap(l.license_type) || ' licence — ' || coalesce(nullif(v_title, ''), 'Untitled'), 200),
          round(l.fee_amount * power(10, app.currency_exponent(l.fee_currency)))::bigint, l.fee_currency)
  returning * into o;
  perform app.record_audit_for(l.creator_id, 'payment.order_opened', 'payment_order', o.id, jsonb_build_object('license', l.id, 'amount_minor', o.amount_minor, 'currency', o.currency, 'opened_by', v_me));
  return o;
end $$;
revoke execute on function public.payment_order_open(uuid) from public, anon;
grant execute on function public.payment_order_open(uuid) to authenticated;

-- ------------------------------------------------------------------------------------------------ attach checkout
-- The server records the provider checkout it created for an order (service role only).
create or replace function public.payment_order_attach(p_order uuid, p_provider text, p_ref text, p_url text, p_expires_at timestamptz)
returns public.payment_orders language plpgsql security definer set search_path = ''
as $$
declare o public.payment_orders;
begin
  update public.payment_orders set provider = p_provider, provider_order_ref = p_ref, checkout_url = p_url, status = 'open', expires_at = least(expires_at, p_expires_at)
  where id = p_order and status in ('created', 'open') returning * into o;
  if not found then raise exception 'order not open' using errcode = '22023'; end if;
  perform app.record_audit_for(o.creator_id, 'payment.checkout_created', 'payment_order', o.id, jsonb_build_object('provider', p_provider, 'ref', p_ref));
  return o;
end $$;
revoke execute on function public.payment_order_attach(uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.payment_order_attach(uuid, text, text, text, timestamptz) to service_role;

-- ------------------------------------------------------------------------------------------------ refunds (request)
-- The payee asks for a refund (the app has already re-checked their password). Returns the refund row; the server
-- then calls the provider and the provider's webhook settles it.
create or replace function public.payment_refund_request(p_order uuid, p_amount_minor bigint, p_reason text)
returns public.payment_refunds language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := app.current_creator_id();
  o public.payment_orders;
  v_pending bigint;
  r public.payment_refunds;
begin
  select * into o from public.payment_orders where id = p_order for update;
  if not found or o.creator_id is distinct from v_me then raise exception 'order not found' using errcode = 'P0002'; end if;
  if o.status not in ('paid', 'partially_refunded') then raise exception 'only a paid order can be refunded' using errcode = '22023'; end if;
  select coalesce(sum(amount_minor), 0) into v_pending from public.payment_refunds where order_id = o.id and status in ('requested', 'pending');
  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > o.amount_minor - o.refunded_minor - v_pending then
    raise exception 'refund exceeds what was paid' using errcode = '22023';
  end if;
  insert into public.payment_refunds(order_id, creator_id, requested_by, amount_minor, reason) values (o.id, o.creator_id, v_me, p_amount_minor, p_reason) returning * into r;
  perform app.record_audit_for(o.creator_id, 'refund.requested', 'payment_refund', r.id, jsonb_build_object('order', o.id, 'amount_minor', p_amount_minor, 'currency', o.currency));
  return r;
end $$;
revoke execute on function public.payment_refund_request(uuid, bigint, text) from public, anon;
grant execute on function public.payment_refund_request(uuid, bigint, text) to authenticated;

create or replace function public.payment_refund_attach(p_refund uuid, p_ref text, p_failed boolean default false)
returns public.payment_refunds language plpgsql security definer set search_path = ''
as $$
declare r public.payment_refunds;
begin
  update public.payment_refunds set provider_refund_ref = coalesce(p_ref, provider_refund_ref), status = case when p_failed then 'failed' else 'pending' end
  where id = p_refund and status = 'requested' returning * into r;
  if not found then raise exception 'refund not requested' using errcode = '22023'; end if;
  perform app.record_audit_for(r.creator_id, case when p_failed then 'refund.failed' else 'refund.submitted' end, 'payment_refund', r.id, jsonb_build_object('ref', p_ref));
  return r;
end $$;
revoke execute on function public.payment_refund_attach(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.payment_refund_attach(uuid, text, boolean) to service_role;

-- ------------------------------------------------------------------------------------------------ apply provider events
-- Applies one verified provider event. p_kind is the normalised meaning:
--   'paid'            p_ref = provider order ref, p_payment = provider payment id, p_amount = amount captured
--   'expired'|'failed' p_ref = provider order ref
--   'refund_succeeded'|'refund_failed'  p_payment = provider payment id, p_refund_ref = provider refund id, p_amount = refunded
-- Idempotent: the same provider event id is applied once; a repeated state change is recorded as duplicate_state.
create or replace function public.payment_apply_event(
  p_provider text, p_event_id text, p_event_type text, p_body_sha256 text, p_kind text,
  p_ref text default null, p_payment text default null, p_refund_ref text default null, p_amount bigint default null, p_currency text default null
) returns text language plpgsql security definer set search_path = ''
as $$
declare
  o public.payment_orders;
  r public.payment_refunds;
  v_outcome text := 'applied';
  v_summary jsonb := jsonb_strip_nulls(jsonb_build_object('kind', p_kind, 'ref', p_ref, 'payment', p_payment, 'refund', p_refund_ref, 'amount', p_amount, 'currency', p_currency));
begin
  if exists (select 1 from public.payment_events where provider = p_provider and provider_event_id = p_event_id) then return 'duplicate'; end if;

  if p_kind in ('paid', 'expired', 'failed') then
    select * into o from public.payment_orders where provider = p_provider and provider_order_ref = p_ref for update;
  elsif p_kind in ('refund_succeeded', 'refund_failed') then
    select * into o from public.payment_orders where provider = p_provider and provider_payment_ref = p_payment for update;
  end if;

  if o.id is null then
    v_outcome := 'unmatched';
  elsif p_kind = 'paid' then
    if o.status <> 'open' and o.status <> 'expired' then
      v_outcome := 'duplicate_state';
    elsif exists (select 1 from public.payment_orders x where x.license_id = o.license_id and x.id <> o.id and x.status in ('paid', 'partially_refunded', 'refunded')) then
      -- Paid twice for one licence (e.g. an old link after a new one was paid): never settle it twice; an operator
      -- refunds it from the reconciliation report.
      v_outcome := 'ignored';
      perform app.record_audit_for(o.creator_id, 'payment.duplicate_charge', 'payment_order', o.id, v_summary);
    elsif p_amount is distinct from o.amount_minor or upper(p_currency) is distinct from o.currency then
      -- Never settle a different amount than the licence's: flag for reconciliation instead.
      v_outcome := 'ignored';
      perform app.record_audit_for(o.creator_id, 'payment.amount_mismatch', 'payment_order', o.id, v_summary);
    else
      -- A late payment on an expired order wins; any newer live order for the licence is cancelled.
      update public.payment_orders set status = 'cancelled' where license_id = o.license_id and id <> o.id and status in ('created', 'open');
      update public.payment_orders set status = 'paid', provider_payment_ref = p_payment, paid_at = now() where id = o.id;
      perform app.post_journal(o.creator_id, o.currency, 'Licence fee received', o.id, null, jsonb_build_array(
        jsonb_build_object('account', 'provider_clearing:' || p_provider, 'debit', o.amount_minor),
        jsonb_build_object('account', 'creator_payable', 'credit', o.amount_minor)));
      -- Settle the creator's expected licence income (made from the LicenseActivated event) — or record it.
      update public.business_records set status = 'received', payment_order_id = o.id
      where source_type = 'license' and source_id = o.license_id and status = 'expected' and creator_id = o.creator_id;
      if not found then
        insert into public.business_records(creator_id, kind, direction, amount, currency, status, description, source_type, source_id, artifact_id, source_event_id, payment_order_id, settled_at)
        values (o.creator_id, 'license_income', 'in', o.amount_minor / power(10, app.currency_exponent(o.currency)), o.currency, 'received', left(o.description, 300), 'license', o.license_id, o.artifact_id,
                (select e.id from public.domain_events e where e.event_type = 'LicenseActivated' and e.aggregate_id = o.license_id order by e.occurred_at desc limit 1), o.id, now())
        on conflict (source_event_id) do update set status = 'received', payment_order_id = excluded.payment_order_id;
      end if;
      perform app.record_audit_for(o.creator_id, 'payment.received', 'payment_order', o.id, v_summary);
    end if;
  elsif p_kind in ('expired', 'failed') then
    if o.status = 'open' then
      update public.payment_orders set status = p_kind where id = o.id;
      perform app.record_audit_for(o.creator_id, 'payment.' || p_kind, 'payment_order', o.id, v_summary);
    else
      v_outcome := 'duplicate_state';
    end if;
  elsif p_kind = 'refund_succeeded' then
    select * into r from public.payment_refunds where provider_refund_ref = p_refund_ref for update;
    if r.id is not null and r.order_id <> o.id then
      -- The refund id belongs to another order: never move money across orders.
      v_outcome := 'ignored';
    elsif r.id is null then
      -- A refund made in the provider's dashboard: record it so the books match the provider.
      insert into public.payment_refunds(order_id, creator_id, amount_minor, reason, status, provider_refund_ref)
      values (o.id, o.creator_id, p_amount, 'Refunded at the payment provider', 'pending', p_refund_ref) returning * into r;
    end if;
    if v_outcome = 'ignored' then
      perform app.record_audit_for(o.creator_id, 'refund.order_mismatch', 'payment_order', o.id, v_summary);
    elsif r.status = 'succeeded' then
      v_outcome := 'duplicate_state';
    elsif r.amount_minor > o.amount_minor - o.refunded_minor then
      v_outcome := 'ignored';
      perform app.record_audit_for(o.creator_id, 'refund.amount_mismatch', 'payment_refund', r.id, v_summary);
    else
      update public.payment_refunds set status = 'succeeded', settled_at = now() where id = r.id;
      update public.payment_orders set refunded_minor = refunded_minor + r.amount_minor,
        status = case when refunded_minor + r.amount_minor >= amount_minor then 'refunded' else 'partially_refunded' end
      where id = o.id;
      perform app.post_journal(o.creator_id, o.currency, 'Licence fee refunded', o.id, r.id, jsonb_build_array(
        jsonb_build_object('account', 'creator_payable', 'debit', r.amount_minor),
        jsonb_build_object('account', 'provider_clearing:' || p_provider, 'credit', r.amount_minor)));
      -- A full refund cancels the income record; a partial one leaves it and the ledger carries the difference.
      if r.amount_minor + o.refunded_minor >= o.amount_minor then
        update public.business_records set status = 'cancelled' where payment_order_id = o.id;
      end if;
      perform app.record_audit_for(o.creator_id, 'refund.succeeded', 'payment_refund', r.id, v_summary);
    end if;
  elsif p_kind = 'refund_failed' then
    update public.payment_refunds set status = 'failed' where provider_refund_ref = p_refund_ref and order_id = o.id and status in ('requested', 'pending') returning * into r;
    if r.id is null then v_outcome := 'duplicate_state';
    else perform app.record_audit_for(o.creator_id, 'refund.failed', 'payment_refund', r.id, v_summary);
    end if;
  else
    v_outcome := 'ignored';
  end if;

  insert into public.payment_events(provider, provider_event_id, event_type, order_id, summary, body_sha256, outcome)
  values (p_provider, p_event_id, p_event_type, o.id, v_summary, p_body_sha256, v_outcome);
  return v_outcome;
end $$;
revoke execute on function public.payment_apply_event(text, text, text, text, text, text, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.payment_apply_event(text, text, text, text, text, text, text, text, bigint, text) to service_role;
