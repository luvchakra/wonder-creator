-- P0.1-11 Approval Center: CreatorBrain proposals become exact, single-use, audited approvals.
-- - A proposal's action and parameters can never change after it's made ("edit" creates a new proposal
--   and cancels the old one), so an approval can't be reused for materially different parameters.
-- - Status only moves forward: pending → approved → executed | failed, or pending → rejected (declined) |
--   expired | cancelled. Approving claims the proposal first, so it can't be executed twice.
-- - Every decision is written to the audit log.

alter table public.ai_proposals drop constraint ai_proposals_status_check;
alter table public.ai_proposals add constraint ai_proposals_status_check
  check (status in ('pending', 'approved', 'rejected', 'executed', 'failed', 'expired', 'cancelled'));
alter table public.ai_proposals
  add column expires_at timestamptz,
  add column supersedes uuid references public.ai_proposals(id) on delete set null,
  add column decision_note text check (decision_note is null or char_length(decision_note) <= 500);
update public.ai_proposals set expires_at = created_at + interval '7 days';
alter table public.ai_proposals alter column expires_at set not null, alter column expires_at set default now() + interval '7 days';
create index ai_proposals_supersedes_fk_idx on public.ai_proposals(supersedes);

create or replace function app.guard_proposal_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.creator_id is distinct from old.creator_id or new.action is distinct from old.action or new.domain is distinct from old.domain
     or new.payload is distinct from old.payload or new.understood is distinct from old.understood or new.plan is distinct from old.plan
     or new.impact is distinct from old.impact or new.run_id is distinct from old.run_id or new.conversation_id is distinct from old.conversation_id
     or new.created_at is distinct from old.created_at or new.expires_at is distinct from old.expires_at or new.supersedes is distinct from old.supersedes then
    raise exception 'A proposal''s action and parameters can''t change. Ask for a new one instead.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not (
    (old.status = 'pending' and new.status in ('approved', 'rejected', 'expired', 'cancelled', 'executed', 'failed'))
    or (old.status = 'approved' and new.status in ('executed', 'failed'))
  ) then
    raise exception 'That proposal has already been handled.' using errcode = '55000';
  end if;
  return new;
end $$;
create trigger ai_proposals_guard before update on public.ai_proposals
  for each row execute function app.guard_proposal_update();

create or replace function app.audit_proposal_decision()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    perform app.record_audit('approval.' || new.status, 'ai_proposal', new.id,
      jsonb_build_object('action', new.action, 'domain', new.domain, 'from', old.status), null);
  end if;
  return new;
end $$;
create trigger ai_proposals_audit after update of status on public.ai_proposals
  for each row execute function app.audit_proposal_decision();
revoke execute on function app.audit_proposal_decision() from public, anon, authenticated;
