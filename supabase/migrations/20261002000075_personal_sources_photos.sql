-- Personal Sources › Photos (phase D, docs/personal-sources.md). Photos the creator selects in the browser are
-- discovered from metadata and a tiny thumbnail only; the original is uploaded only when they bring it in. The
-- thumbnail lives in the record itself (a small inline JPEG/WebP), so it's private by RLS and disappears with the
-- record — on expiry, on disconnect, on erasure — with nothing left behind in storage.
alter table public.source_context_records drop constraint source_context_records_preview_ref_check;
alter table public.source_context_records add constraint source_context_records_preview_ref_check check (
  preview_ref is null
  or (char_length(preview_ref) <= 2048 and preview_ref ~ '^https://')
  or (char_length(preview_ref) <= 16000 and preview_ref ~ '^data:image/(jpeg|webp);base64,[A-Za-z0-9+/=]+$')
);
