-- P0.1-03 Intent clarification: the brief a creation run worked from (the creator-confirmed intent, or the
-- safe defaults CreatorBrain inferred), kept on the run for the audit trail. Holds choices only
-- (format, audience, length, tone, style, which material led, acknowledged assumptions), never content.
alter table public.ai_runs
  add column intent_brief jsonb check (intent_brief is null or (jsonb_typeof(intent_brief) = 'object' and pg_column_size(intent_brief) <= 4096));
