# Testimonials

Owner, 2 Oct 2026: "in orkut, there was a feature called testimonials, plan something similar for here". Approved with
the recommended choices: anyone who can see your profile may write one, you approve it, and the name stays
**Testimonials**.

## What it is

Someone who knows your work writes a short note about you. It appears on your Profile only after you choose to show
it, and you can take it down any time. Orkut's rules, kept: written by someone else, approved by you, shown newest
first. No counts, no ranking, nothing written by AI.

## Rules

* **Who may write.** Your setting (Settings › Privacy & Security › Testimonials): anyone who can see your profile
  (default), only people you've worked with, or nobody for now. Never yourself; never across a block; never for a
  private profile. "Worked together" is derived by the server from a shared active crew, a Creation one contributed to
  for the other, or a Huddle both joined. It is never typed in.
* **Approval first.** A new or rewritten testimonial waits as *pending*. Only the writer and the receiver can read it.
  The receiver shows it, or keeps it private; a hidden one can be shown later.
* **Where it shows.** Your Profile (Overview shows the latest two; the Community view shows all). Your public Creator
  Page only for testimonials you mark "Also on my Creator Page", and only while the page is published and your profile
  is public.
* **The writer keeps their words.** They can rewrite (back to pending) or withdraw (gone at once; can't be shown again).
* **Context.** The writer may point at something you both share (a Creative Room, a Creation, a Huddle); the server
  checks you were both part of it, and its title is shown with the testimonial.
* **Audit.** Written, rewritten, shown, hidden, withdrawn and the setting change are all in the audit log.
* **No counts.** Nothing counts testimonials, anywhere.

## Where it lives

* Database: `supabase/migrations/20261002000078_testimonials.sql` — `creators.testimonials_from`,
  `creator_testimonials` (select policy only; every change goes through `testimonial_write`, `testimonial_withdraw`,
  `testimonial_decide`, `testimonials_setting`), `testimonials_of`, `public_creator_page_testimonials`,
  `can_write_testimonial_for`, `app.worked_together`. Tests: `tests/db/testimonials.test.ts`.
* Domain: `packages/creator-identity/src/testimonials.ts` (+ browser-safe `testimonials-options.ts`).
* API: `/api/v1/testimonials` (list `?creator=`, write, withdraw `?to=`), `/api/v1/testimonials/:id` (show / hide,
  `onCreatorPage`), `/api/v1/testimonials/settings`. Flag `testimonials_enabled`.
* UI: `components/profile/testimonials.tsx` on the Profile; "Write a testimonial" in the section and as a Palette leaf
  (`?write=testimonial`); the pending row on your own Profile; Settings fieldset; the public Creator Page's About block.
  Pending testimonials appear in notifications; the writer is told when theirs is shown.
* E2E: `e2e/testimonials.spec.ts`.
