-- Phase 02 — Quick Capture (docs/phases/02-home-quick-capture.md §6, §17–18).
--
-- A quick note or voice note carries an id made on the device when the creator taps Save. A retry (a slow upload, a
-- dropped connection, a note saved offline and synced later) sends the same id, and this receipt makes sure it lands
-- exactly once: one Material, one Moment. Written by the server only; the creator can read their own.
create table public.capture_receipts (
  creator_id uuid not null references public.creators(id) on delete cascade,
  client_id uuid not null,
  kind text not null check (kind in ('note', 'voice')),
  material_id uuid references public.creative_materials(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (creator_id, client_id)
);
create index capture_receipts_material_idx on public.capture_receipts(material_id);

alter table public.capture_receipts enable row level security;
create policy capture_receipts_read on public.capture_receipts for select to authenticated using (creator_id = app.current_creator_id());
revoke insert, update, delete on public.capture_receipts from authenticated;
