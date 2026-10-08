# Help

Owner, 8 Oct 2026: "update the get help page for each app — match the latest features." Wonder Creator had no help page;
`/help` is it. Public like About and Contact (no sign-in), so it opens from the landing footer and, signed in, from the
account menu's **Get help**.

## What's on it

A search box, ten sections as chips, and every topic as a closed card that opens in place (a native disclosure, so it
works from the keyboard and without scripts):

| Section | Topics |
| --- | --- |
| Getting started | Your first five minutes · Signing in and account security · Finding your way around · Words we use |
| Capturing and keeping | Quick Capture · Bringing in files, links and text · Finding and organising Materials · DejaVu · Scrapbook · Connecting your own sources · Creative Memory |
| Making a Creation | Starting a Creation · The Working Table (sources, pins, Use together) · Writing · Carousels · Images · Audio · Video · Presentations · Versions · Changing format |
| CreativeMind and AI | What it does · You decide what it may do (autonomy and approvals) · Using your own AI key |
| Publishing and sharing | Sharing privately · Publishing as a page · Your Creator Page · Other destinations and webhooks |
| Together | Pulse · Communities · Huddles · Creative Rooms · Working with people on a Creation · Feedback, reporting, muting and blocking |
| Rights and licensing | The Rights tab · Licenses · Fees and payments · Using other people's material (plain language, not legal advice) |
| Your data and privacy | Who can see what · Download your data or delete your account · Privacy requests and choices · Security & activity |
| When something isn't working | The checklist · Can't sign in · A file or link won't come in · The microphone · "Not connected" · Can't publish · Huddle without voice or video · Can't find my Creation |
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

## Tests

* `apps/web/src/lib/help/content.test.ts` (unit): unique anchors; no empty topics or repeated lines; every internal link
  resolves to a real page under `app/`; no internal technology, email addresses or promised reply times; the
  "not connected" states are named; search finds the topic a real question is about and ranks the named topic first.
* `e2e/help.spec.ts`: the footer link, every section, opening a topic from the keyboard, search and its empty state,
  a deep link, the way to Contact, no sideways scrolling at 360/390/1280, 44px targets, axe with motion on and off, and
  (signed in) the account menu's *Get help* and the way back.
