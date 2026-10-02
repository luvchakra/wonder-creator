-- Financial controls (owner, 2 Oct 2026): SOX-style application controls over the payment records of migration 070
-- — docs/compliance/financial-controls.md (controls matrix).
--
-- 1. Settled-by-payment records are locked: once a provider-confirmed payment settles a business record, only the
--    payment pipeline (security-definer functions) can change its status; the creator can still add a note.
-- 2. A daily reconciliation compares the ledger, orders, refunds, business records and provider events, records
--    every exception for review and is itself audited. Runs and exceptions are append-only evidence.
-- 3. Financial records are excluded from the retention purge (statutory retention: Companies Act 2013 §128(5),
--    8 years; Income-tax Act; EU member-state rules up to 10 years).

-- ------------------------------------------------------------------------------------------- 1. lock settled records
create or replace function app.business_records_guard_payment()
returns trigger language plpgsql set search_path = ''
as $$
begin
  -- Inside the payment functions current_user is their (definer) owner; a creator's own request is `authenticated`.
  if current_user in ('authenticated', 'anon') and old.payment_order_id is not null then
    if new.status is distinct from old.status or new.payment_order_id is distinct from old.payment_order_id then
      raise exception 'settled by a payment; refund it instead' using errcode = '42501';
    end if;
  end if;
  if current_user in ('authenticated', 'anon') and new.payment_order_id is distinct from old.payment_order_id then
    raise exception 'payment links are set by the payment provider only' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger business_records_guard_payment before update on public.business_records
  for each row execute function app.business_records_guard_payment();

-- ------------------------------------------------------------------------------------------- 2. reconciliation
create table public.reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  checks jsonb not null default '{}'::jsonb,
  exceptions int not null default 0
);
create table public.reconciliation_exceptions (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.reconciliation_runs(id) on delete restrict,
  check_name text not null check (char_length(check_name) <= 60),
  severity text not null check (severity in ('high', 'medium', 'low')),
  subject_type text not null check (subject_type in ('journal', 'payment_order', 'payment_refund', 'business_record', 'payment_event')),
  subject_id text not null check (char_length(subject_id) <= 200),
  creator_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index reconciliation_exceptions_run_idx on public.reconciliation_exceptions(run_id);
create trigger reconciliation_exceptions_immutable before update or delete on public.reconciliation_exceptions for each row execute function app.prevent_mutation();
alter table public.reconciliation_runs enable row level security;
alter table public.reconciliation_exceptions enable row level security;
-- Operators (service role) only.
revoke all on public.reconciliation_runs, public.reconciliation_exceptions from authenticated, anon;
revoke truncate on public.reconciliation_runs, public.reconciliation_exceptions from service_role;

create or replace function app.run_reconciliation()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_run uuid;
  v_checks jsonb := '{}'::jsonb;
  n int;
  v_total int := 0;
begin
  insert into public.reconciliation_runs default values returning id into v_run;

  -- Housekeeping first: checkouts past their expiry are closed (their provider links have expired too).
  update public.payment_orders set status = 'expired' where status in ('created', 'open') and expires_at < now() - interval '1 hour';
  get diagnostics n = row_count; v_checks := v_checks || jsonb_build_object('orders_expired', n);

  -- C1 Every journal balances per currency.
  insert into public.reconciliation_exceptions(run_id, check_name, severity, subject_type, subject_id, creator_id, detail)
  select v_run, 'journal_balanced', 'high', 'journal', j.journal_id::text, min(j.creator_id::text)::uuid, jsonb_build_object('debit', sum(j.debit_minor), 'credit', sum(j.credit_minor), 'currency', j.currency)
  from public.ledger_entries j group by j.journal_id, j.currency having sum(j.debit_minor) <> sum(j.credit_minor);
  get diagnostics n = row_count; v_checks := v_checks || jsonb_build_object('journal_balanced', n); v_total := v_total + n;

  -- C2 Each order's provider-clearing balance equals what was paid minus what was refunded.
  insert into public.reconciliation_exceptions(run_id, check_name, severity, subject_type, subject_id, creator_id, detail)
  select v_run, 'order_ledger_matches', 'high', 'payment_order', o.id::text, o.creator_id,
         jsonb_build_object('expected', case when o.status in ('paid', 'partially_refunded', 'refunded') then o.amount_minor - o.refunded_minor else 0 end, 'ledger', coalesce(l.net, 0), 'status', o.status)
  from public.payment_orders o
  left join (select order_id, sum(debit_minor - credit_minor) as net from public.ledger_entries where account like 'provider_clearing:%' group by order_id) l on l.order_id = o.id
  where coalesce(l.net, 0) <> case when o.status in ('paid', 'partially_refunded', 'refunded') then o.amount_minor - o.refunded_minor else 0 end;
  get diagnostics n = row_count; v_checks := v_checks || jsonb_build_object('order_ledger_matches', n); v_total := v_total + n;

  -- C3 A paid order settles exactly one business record (received; cancelled once fully refunded).
  insert into public.reconciliation_exceptions(run_id, check_name, severity, subject_type, subject_id, creator_id, detail)
  select v_run, 'order_has_business_record', 'medium', 'payment_order', o.id::text, o.creator_id, jsonb_build_object('records', count(b.id), 'status', o.status)
  from public.payment_orders o left join public.business_records b on b.payment_order_id = o.id
  where o.status in ('paid', 'partially_refunded', 'refunded') and o.creator_id is not null
  group by o.id having count(b.id) <> 1
     or bool_or(b.status <> case when o.status = 'refunded' then 'cancelled' else 'received' end);
  get diagnostics n = row_count; v_checks := v_checks || jsonb_build_object('order_has_business_record', n); v_total := v_total + n;

  -- C4 Provider events we didn't apply (unknown order, wrong amount, duplicate charge) in the last 7 days need a person.
  insert into public.reconciliation_exceptions(run_id, check_name, severity, subject_type, subject_id, creator_id, detail)
  select v_run, 'provider_event_unapplied', case when e.outcome = 'unmatched' then 'medium' else 'high' end, 'payment_event', e.id::text,
         (select o.creator_id from public.payment_orders o where o.id = e.order_id), jsonb_build_object('provider', e.provider, 'type', e.event_type, 'outcome', e.outcome, 'summary', e.summary)
  from public.payment_events e
  where e.outcome in ('unmatched', 'ignored') and e.received_at > now() - interval '7 days'
    and e.summary->>'kind' is distinct from 'ignored';
  get diagnostics n = row_count; v_checks := v_checks || jsonb_build_object('provider_event_unapplied', n); v_total := v_total + n;

  -- C5 Refunds the provider hasn't confirmed within 7 days.
  insert into public.reconciliation_exceptions(run_id, check_name, severity, subject_type, subject_id, creator_id, detail)
  select v_run, 'refund_unconfirmed', 'medium', 'payment_refund', r.id::text, r.creator_id, jsonb_build_object('status', r.status, 'amount_minor', r.amount_minor, 'since', r.created_at)
  from public.payment_refunds r where r.status in ('requested', 'pending') and r.created_at < now() - interval '7 days';
  get diagnostics n = row_count; v_checks := v_checks || jsonb_build_object('refund_unconfirmed', n); v_total := v_total + n;

  update public.reconciliation_runs set finished_at = now(), checks = v_checks, exceptions = v_total where id = v_run;
  insert into public.audit_logs(action, object_type, object_id, metadata)
  values ('reconciliation.run', 'reconciliation_run', v_run, v_checks || jsonb_build_object('exceptions', v_total, 'via', 'server'));
  return v_checks || jsonb_build_object('run', v_run, 'exceptions', v_total);
end $$;
revoke execute on function app.run_reconciliation() from public, anon, authenticated;

create or replace function public.run_reconciliation()
returns jsonb language sql security definer set search_path = ''
as $$ select app.run_reconciliation() $$;
revoke execute on function public.run_reconciliation() from public, anon, authenticated;
grant execute on function public.run_reconciliation() to service_role;

-- ------------------------------------------------------------------------------------------- 3. creator statement
-- The creator's own statement of payments and ledger lines (RLS applies: invoker rights).
create or replace function public.my_payment_statement(p_from date, p_to date)
returns table (posted_at timestamptz, journal_id uuid, account text, debit_minor bigint, credit_minor bigint, currency text, memo text, order_id uuid, refund_id uuid, provider text, provider_payment_ref text, description text)
language sql stable security invoker set search_path = ''
as $$
  select l.posted_at, l.journal_id, l.account, l.debit_minor, l.credit_minor, l.currency, l.memo, l.order_id, l.refund_id, o.provider, o.provider_payment_ref, o.description
  from public.ledger_entries l left join public.payment_orders o on o.id = l.order_id
  where l.creator_id = app.current_creator_id() and l.posted_at >= p_from and l.posted_at < p_to + 1
  order by l.posted_at, l.id
$$;
revoke execute on function public.my_payment_statement(date, date) from public, anon;
grant execute on function public.my_payment_statement(date, date) to authenticated;
