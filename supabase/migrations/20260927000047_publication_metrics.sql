-- P1-20 Analytics Foundation: outcomes of published work, only as reported by the platforms themselves.
-- A connected destination (the creator's own webhook) reports numbers for a publication it received, signed with
-- the same secret Wonder Creator signs publishes with. The server verifies and stores them; creators read their own.
-- Guardrails (plan §41): no invented metrics, no single quality/value score, no like counts (plan guardrail);
-- platform numbers are kept apart from anything Wonder Creator might interpret.

create table public.publication_metrics (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  destination_id uuid references public.publishing_destinations(id) on delete set null,
  -- Who reported it: always the platform, named as the creator named the destination.
  reported_by text not null check (char_length(reported_by) between 1 and 60),
  metric text not null check (metric in ('views', 'plays', 'impressions', 'reach', 'watch_seconds', 'completions', 'shares', 'saves', 'comments', 'clicks', 'followers_gained')),
  value numeric not null check (value >= 0 and value < 1e15),
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  unique (publication_id, metric, observed_at)
);
create index publication_metrics_pub_idx on public.publication_metrics(publication_id, metric, observed_at desc);
create index publication_metrics_artifact_idx on public.publication_metrics(artifact_id);

alter table public.publication_metrics enable row level security;
create policy publication_metrics_read on public.publication_metrics for select to authenticated using (creator_id = app.current_creator_id());
-- No client writes: the server records verified platform reports.
