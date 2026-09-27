-- P1-13 Publication Derivatives: platform adaptations are real derivative pieces (lineage to the source version,
-- inherited rights, their own approval before publishing). A derivative can say which destination it was made for;
-- its publications link it to that destination, and analytics can attach to those publications later.
alter table public.artifacts
  add column made_for text check (made_for is null or char_length(made_for) between 1 and 60);
