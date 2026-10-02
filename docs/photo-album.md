# Photo album

Owner, 2 Oct 2026: "create a photo album where user can upload their pictures which they want to show to people, nicely
displayed pictures".

## What it is

Pictures a creator chooses to show on their Profile. The Overview shows a glimpse (one large photo and two small); the
full album lives at `/creators/[handle]/album`, laid out in each photo's own proportions with italic captions, and a
quiet full-screen viewer (arrow keys, Escape, previous/next buttons). No likes, no counts.

## Rules

* **Who sees it.** Anyone who can see the profile (profile visibility decides), never across a block. Private profiles
  keep their album to themselves.
* **Who changes it.** Only the creator: add, caption (≤200 characters), move earlier or later, remove (confirmed;
  the files are deleted).
* **Files.** Each upload goes through `inspectUpload` (content-detected type, size limit 20 MB, images only). The
  server makes a WebP master (≤2048px) and a 720px thumbnail with `sharp`, rotated upright with all metadata,
  including location, stripped. Both are stored as the creator's own objects; the database accepts only the creator's
  own clean images. At most 60 photos.
* **Links.** Picture links are minted (`mediaLink`) only for objects of rows the viewer's RLS-scoped read returned.

## Where it lives

* Database: `supabase/migrations/20261002000079_photo_album.sql` (`creator_album_photos`, RLS, 60-photo limit).
  Tests: `tests/db/photo-album.test.ts`.
* Server: `apps/web/src/lib/album.ts`; API `/api/v1/album` (list, add), `/api/v1/album/:id` (caption, remove),
  `/api/v1/album/order`. Flag `photo_album_enabled`.
* UI: `components/profile/album.tsx` (Profile glimpse, gallery, viewer); page `/creators/[handle]/album`.
* E2E: `e2e/photo-album.spec.ts` (also covers Messages in the top bar).
