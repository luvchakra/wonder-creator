# Help

Owner, 8 Oct 2026: "update the get help page for each app — match the latest features." Wonder Creator had no help page;
`/help` is it. Since 16 Oct 2026 (owner: "put the help documentation behind sign-in") it is for signed-in creators
only, opened from the account menu's **Get help** and the signed-in footer.

## Who can read it

| What | Who | How it's enforced |
| --- | --- | --- |
| `/help` (every section and topic, search, deep links) | Signed-in creators (onboarding not required) | `requireSession({ returnTo: "/help" })` on the server: signed out it redirects to `/sign-in?next=%2Fhelp` and, after signing in, back to `/help`. Rendered per request (`force-dynamic`), so Next sends `Cache-Control: private, no-cache, no-store`; `X-Robots-Tag: noindex, nofollow` (`next.config.ts`) and a `noindex` robots meta |
| Help content (`lib/help/content.ts`, `public.ts`) | Server only | `import "server-only"`; the page passes the sections to the client component as props, and search takes them as an argument. Types live in `lib/help/types.ts`, the only help module the browser may import |
| Help API or search endpoint | — | There is none; search runs in the browser over what the signed-in page sent. A unit test fails if `app/api/v1/help` appears |
| Sitemap, robots file, service worker | — | None exist, so nothing lists or caches help |

**What stays public, and why:**

* `/account-help` — the three topics a visitor needs *before* they can sign in: Creating an account, Signing in and
  account security, I can't sign in. Links inside them are filtered to public pages (`lib/help/public.ts`).
* `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` — the way in and the password reset.
* `/contact` — the one way to reach us without an account.
* `/about` and `/legal/privacy`, `/legal/terms`, `/legal/security`, `/legal/subprocessors` — notices the law and the
  sign-up consent require to be readable before agreeing.

The public footer links to **Account help**; signed in, the same footer slot is **Help**. The sign-in form has
**Trouble signing in?** next to **Forgot your password?**.

## What's on it

A search box, twelve sections as chips, and every topic as a closed card that opens in place (a native disclosure, so it
works from the keyboard and without scripts):

| Section | Topics |
| --- | --- |
| Getting started | Your first five minutes · Signing in and account security · Finding your way around · Putting it on your home screen · Words we use |
| Capturing and keeping | Quick Capture · Bringing in files, links and text · Finding and organising Materials · DejaVu · Scrapbook · Connecting your own sources · Creative Memory |
| Making a Creation | Starting a Creation · The Working Table (sources, pins, Use together) · Writing · Carousels · Images · Audio · Video · Presentations · Versions · Changing format |
| CreativeMind and AI | What it does · You decide what it may do (autonomy and approvals) · Using your own AI key |
| Publishing and sharing | Sharing privately · Publishing as a page · Your Creator Page · Other destinations and webhooks |
| Together | Pulse · Communities · Huddles · Creative Rooms · Working with people on a Creation · Feedback, reporting, muting and blocking |
| Brand work and business | Campaigns · Business records |
| Rights and licensing | The Rights tab · Licenses · Fees and payments · Using other people's material (plain language, not legal advice) |
| Your data and privacy | Who can see what · Download your data or delete your account · Privacy requests and choices · Security & activity |
| When something isn't working | The checklist · Can't sign in · A file or link won't come in · The microphone · "Not connected" · Can't publish · Huddle without voice or video · Can't find my Creation |
| Release notes | One entry per release, newest first (Release 1 · 19 Oct 2026) |
| Reaching us | Contact, privacy and security |

## Rules

* **Only what the product does today, in the words its screens use.** Every topic was written from the code, not the
  plan. Where something depends on a service that may not be switched on — AI, image generation, video rendering,
  Huddle voice and video, licence payments, posting to other networks — the topic says so the way the product does
  ("Not connected"), never as available.
* **No internal technology** (database, framework, cloud, payment-provider or test names, counts of routes or
  migrations). Third parties the product itself names (Google sign-in, Gemini and Claude keys, YouTube, webhooks) are fine.
* **Reaching us is only through what exists:** the Contact page's *Send us a message* form, Settings › Privacy & Security
  › *Make a privacy request*, the Security page, and reporting inside the product. No email address is written on the
  page (Contact lists the ones set up for a deployment), and no reply time is promised.
* **Calm.** No likes, trending or ranking are described because none exist.
* **Keep it in step.** When a feature changes, change its topic in the same pull request.

## Where it lives

* `apps/web/src/lib/help/content.ts` — the sections and topics as typed data (`HelpSection`, `HelpTopic`: title,
  one-line summary, keywords, body, numbered steps, terms, "good to know" notes, links to pages of the app).
* `apps/web/src/lib/help/search.ts` — browser search: lower-case words, a light stem, a hit in the title or keywords
  outweighs one in the prose, every topic must hold at least one word and the ones holding the most come first, a title
  that is just what was asked for ranks first. No network, no model.
* `apps/web/src/components/public/help-center.tsx` — the page body (hero, search, chips, cards). Rendered in full on
  the server; opens the topic a link such as `/help#own-key` points at. A topic with up to three search matches opens by
  itself.
* `apps/web/src/app/help/page.tsx` — the page, with the public header and footer (`components/public/site-chrome.tsx`).
  Signed in, the header offers *Open Wonder Creator* instead of *Sign in*.
* Entry points: the landing/About/Contact footer (*Help*), and the account menu (*Get help*, `components/app-nav.tsx`).
  Help is not in the Palette (adding a global destination needs the owner).

Each section carries `updated` (YYYY-MM-DD), shown as **Last updated** under its heading: the day its topics were last
checked against the app. Change it when you change a topic in that section.

## Release notes

The **Release notes** section (just before *Reaching us*) says what's new in each release, at a high level, in the words the
screens use. One topic per release, newest first, titled `Release N · D Mon YYYY` (slug `release-N`).

* **When:** only when the owner confirms a new version is live. Not on merge, and not before: until then the section
  doesn't change. The date is the day the owner confirmed it live.
* **What goes in:** every user-facing feature, change or fix worth knowing that was merged since the entry below it,
  grouped by area (the terms list), one line each. Find them with `git log --oneline <previous covered commit>..origin/main`
  and read each merge. Leave out internal work (tests, CI, performance, refactors, docs) unless a creator would notice it.
  No pull-request numbers, commit ids or internal names; features that show *Not connected* are described the way the
  screens do, never as available. The first entry covers everything; later ones only what's new.
* **How:** add the new topic at the top of the section's `topics`, bump the section's `updated`, and update the "covered
  through" comment above the section in `content.ts` and the log below. The same pull request updates any older topic
  the changes touch.

| Release | Date | Covers |
| --- | --- | --- |
| 1 | 19 Oct 2026 | Everything up to and including `ad90762` ("Quick note: type or dictate with a small mic") |

## Tests

* `apps/web/src/lib/help/content.test.ts` (unit): unique anchors; no empty topics or repeated lines; every internal link
  resolves to a real page under `app/`; no internal technology, email addresses or promised reply times; the
  "not connected" states are named; search finds the topic a real question is about and ranks the named topic first.
* `e2e/help.spec.ts`: the footer link, every section, opening a topic from the keyboard, search and its empty state,
  a deep link, the way to Contact, no sideways scrolling at 360/390/1280, 44px targets, axe with motion on and off, and
  (signed in) the account menu's *Get help* and the way back.
* `content.test.ts` also checks the release notes: the section sits just before *Reaching us*, entries are numbered
  without gaps, newest first, titled with a date, and carry no pull-request numbers or commit ids.
* `e2e/help-access.spec.ts`: signed out `/help` is a 307 to sign-in with `no-store` and `noindex` and none of its text;
  signing in from there returns to `/help`; signed in it's a private 200; there is no help API (404); every public page
  loads signed out without signed-in help text or a `/help` link; Account help's links are public only.
* `scripts/check-help-private.mjs` (CI, after the build): fails if the summary of any signed-in topic appears in a public
  file under `.next/static`.
* `content.test.ts` also checks: `server-only` on the content, no client component importing it, every `/help#anchor`
  in the source resolves, "Last updated" dates are real and not in the future, and public topics link to public pages only.
