-- "Use this" asks how a source should be used (owner, 28 Sep 2026): a choice from context (usage_intent) and, when
-- none fits, the creator's own words (usage_note). Collaborator feedback can now be applied as a constraint.
alter table public.studio_sources drop constraint if exists studio_sources_usage_intent_check;
alter table public.studio_sources add constraint studio_sources_usage_intent_check
  check (usage_intent is null or usage_intent in ('content', 'style', 'structure', 'mood', 'reference', 'fact', 'quote', 'visual', 'sound', 'constraint'));
alter table public.studio_sources
  add column usage_note text check (usage_note is null or char_length(usage_note) <= 300);
revoke update on public.studio_sources from authenticated;
grant update (state, roles, usage_intent, usage_note) on public.studio_sources to authenticated;
