-- Audit integrity (IT security / financial controls, 2 Oct 2026). `record_audit_log` lets a signed-in creator add
-- entries about their own activity (sign-ins, exports, settings). Entries in the financial, privacy-request, consent
-- and administrative namespaces are evidence for compliance and must come from the server only (app.record_audit via
-- service-role pipelines), so a creator can never write — or forge — them from a browser session.

create or replace function public.record_audit_log(p_action text, p_object_type text, p_object_id uuid, p_metadata jsonb default '{}'::jsonb, p_request_id text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_action ~ '^(payment|payments|ledger|finance|refund|payout|reconciliation|privacy_request|consent|admin|retention)\.' then
    raise exception 'reserved audit action' using errcode = '42501';
  end if;
  if char_length(p_action) > 120 or p_action !~ '^[a-z][a-z0-9_]*(\.[a-z0-9_-]+)+$' then
    raise exception 'invalid audit action' using errcode = '22023';
  end if;
  perform app.record_audit(p_action, p_object_type, p_object_id, coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('via', 'session'), p_request_id);
end $$;
revoke execute on function public.record_audit_log(text, text, uuid, jsonb, text) from public, anon;
grant execute on function public.record_audit_log(text, text, uuid, jsonb, text) to authenticated;

-- TRUNCATE bypasses row triggers; nobody but the owner may truncate the evidence tables.
revoke truncate on public.audit_logs from authenticated, anon, service_role;
revoke truncate on public.domain_events from authenticated, anon, service_role;
