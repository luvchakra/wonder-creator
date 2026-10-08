# Landing page

Owner brief, 2 Oct 2026: "Redesign the Wonder Creator Landing Page". What signed-out visitors see at `/` (the proxy
rewrites to `/welcome`). Signed-in creators still get Home.

## Direction

A personal creative universe, not a software brochure: warm cream with paper grain, lavender and peach washes,
Playfair Display for statements (italic for the one word that carries the feeling) and Inter for everything else. One
dominant action, **Start Creating** (`/sign-up`), plus a quiet "Explore Wonder Creator" link. No bottom navigation.

## Sections

1. **Hero** — "Everything begins with a little *wonder*." A note, a photograph, a voice memo and a DejaVu thread
   drift toward one finished Creation (a carousel).
2. **Your world** — Ideas, Materials, Moments, DejaVu and your sources (Personal Sources), each as a small product
   scene with one line.
3. **The journey** — Capture → Discover → Explore → Create → Refine → Share, then CreativeStudio with CreativeMind
   (Sources, one insight, *Use together*) and the real formats: Writing · Carousel · Images · Video · Audio ·
   Presentation.
4. **Together** — Pulse (the open square: Open Conversations), Communities (lasting, interest-based, a Forum), Huddles
   (live, ephemeral). No likes, trending or ranking.
5. **CreatorPublish** — a public Creator Page and published Creations in their own forms (poem, video, audio,
   carousel).
6. **Final call** — "Your next Creation is *waiting*." with Start Creating.
7. **Footer** — Wonder Creator links; Trust: Privacy notice, Security, Terms, Data & subprocessors (the real pages);
   About and Contact; copyright.

## Rules

* Only real features and real names. DejaVu is a thread the creator names; CreativeMind suggestions are only
  suggestions. Sample names and lines in scenes are illustrative and never presented as testimonials or real work.
* No certifications, compliance claims, usage numbers or testimonials. Privacy and security live in the footer.
* Approved art only: the Vector Kit logo, washes, painted botanicals, paper texture and supplied photographs.
* Motion: a gentle drift on the hero pieces and one rise on the headline; nothing when reduced motion is set.
* Performance: hero art loads eagerly, everything below the fold lazily, with explicit image sizes.
* Accessibility: scenes are decorative (`aria-hidden`); headings and lines carry the meaning; axe finds no serious
  issues with motion on or off; no horizontal scroll at 390px.

## Where it lives

`apps/web/src/app/welcome/page.tsx` (page), `apps/web/src/components/landing/scenes.tsx` (product scenes), the
`drift` keyframe in `globals.css`. E2E: `e2e/landing.spec.ts`.

## About and Contact (owner, 3 Oct 2026)

* `/about` — what Wonder Creator is and four things it holds to, each describing how the product works today
  (privacy and no AI training on your material, CreativeMind only on what you bring and never deciding rights, money or
  deletion, no likes or ranking, ordinary days as material). No founding story, team, numbers or quotes.
* `/contact` — only channels that exist: a general inbox when `WONDERCREATOR_CONTACT_EMAIL` is set, privacy requests
  in Settings (plus `WONDERCREATOR_PRIVACY_CONTACT` and the Grievance Officer when set), security reports
  (`WONDERCREATOR_SECURITY_CONTACT` when set, and the Security page), and reporting, muting and blocking inside the
  product. Contacts may be `mailto:`, `https:` or a plain address (`contactLink`).
  * **Send us a message** (owner, 8 Oct 2026: "implement similar to WonderJobs"): a form on `/contact` — name, email,
    what it's about (question · help · feedback · working together · privacy · security), message — open to anyone.
    `POST /api/v1/contact` saves it first (`contact_messages`: service role only, kept 12 months, one row per
    `clientId` so a retry lands once), then emails the team after the response (`lib/contact-mail.ts`, SMTP through the
    operator's own mailbox, Reply-To the sender). It goes to `CONTACT_NOTIFY_EMAILS` or, if unset,
    `WONDERCREATOR_CONTACT_EMAIL`; without `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` it says so in the server log and the row
    stays unmarked (`notified_at` empty) — the sender is never told it was emailed. Throttled per address (5 a minute,
    10 an hour) with a hidden bot-trap field (a bot is told it worked; nothing is kept).
* Both share the public header and footer (`components/public/site-chrome.tsx`) with the landing page; the legal pages'
  navigation links to Contact. E2E: `e2e/about-contact.spec.ts`.
