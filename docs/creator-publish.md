# CreatorPublish — public home + type-aware published work

Owner spec: [`docs/phases/06-creatorpublish-type-aware.md`](phases/06-creatorpublish-type-aware.md) (29 Sep 2026), with
the boards `docs/phases/boards/creatorpublish-{1,2}-2026-09-29.png` (references only; plan guardrails win — no follower
or like counts on public pages).

> Do not publish out first. Publish into your own beautiful space, then share the link anywhere.

## Two public surfaces

| | Address | What it is |
| --- | --- | --- |
| **Creator Page** | `/p/<handle>` | The creator's curated public home — only what they chose, in their order (§2.1, §16) |
| **Published work** | `/p/<handle>/<slug>` | One work, presented by how it's experienced (§2.2, §3) |
| Public DejaVu | `/p/<handle>/dejavu/<id>` | An editorial thread through the creator's public work over time (§18) |

These routes live outside `(studio)`: no session, no app state. They read only through publication-safe
`security definer` functions (migration `…065_creator_publish_pages.sql`): `public_work`, `public_creator_page`,
`public_dejavu`. Storage objects named in a snapshot become stable media links per view (`lib/public-pages.ts`).
The in-app Profile (`/creators/<handle>`) stays separate and signed-in (§39).

## Published revisions (§23–25)

- `published_works` — one per Creation: a stable `slug` (unique per creator), visibility **Private / Anyone with the
  link / Public on my page**, presentation settings, featured, and the current revision.
- `published_revisions` — immutable: the **manifest** (how it's experienced), the **snapshot** (exactly what readers
  see), and rights and provenance as they were. Publishing never touches the Creation or its privacy; the working
  Creation stays private and editing continues there.
- **Changes since publishing**: when newer versions exist, the Publish page says so and offers **Update published
  version** — a new revision under the same address.
- Unpublish takes it down everywhere; revisions are kept; publishing again brings it back at the same address.
- Visibility is not reuse: a public work still carries its rights.

## Experiences and renderers (§4–15)

`@wonder/creator-studio/publish` — `experiencesFor`, `manifestFor`, `descriptorFor`, `TREATMENTS`:

| Experience | Types | Renderer | Treatments |
| --- | --- | --- | --- |
| Read | essay, story, article, script… | editorial reading measure, optional cover | Editorial · Immersive · Minimal |
| Read (poem) | poem, lyrics, spoken word (as text) | line breaks, indentation and stanzas kept; optional ▶ Listen | Page · Centered · Reading + Voice |
| Swipe | carousel, social series | scroll-snap swipe, keys, count announced; centred stage on desktop; words stay real text | Classic · Full-screen |
| View | photograph, poster, artwork | the work dominates; full screen with zoom | Gallery · Museum |
| Watch | short film, trailer, reel | cinematic; vertical films on a stage; chrome recedes while playing | Cinema · Minimal |
| Listen | song, spoken word, podcast, soundscape | artwork, one play, progress; lyrics / transcript when there are words | Artwork · Listening Room |
| Journey | photo essay, documentary, mixed media | a vertical authored sequence of words, pictures, recordings and film | Journal · Cinematic |

The type decides first; an experience is offered only if the work can honestly be it (a short film with no film yet is
read as its words). Primary type sets the experience; embedded media enriches it (§14). Only storage objects that passed
the upload checks are ever published.

## Publishing (§26–27)

The Creation's **Publish** page leads with **On your page** (`components/publish/publish-on-page.tsx`): visibility,
public address, cover, primary experience (only when several fit), treatment, show/hide description and transcript,
feature it, and rights & attribution (allow sharing, require attribution, allow remixing with credit — remixing only
when the rights record allows derivatives). Social and webhook destinations follow as secondary distribution (§40).
Nothing about web design is asked.

## The Creator Page (§16–17, §19)

`/creator-page` edits it: public on/off, headline and intro, sections (Featured, Creations, DejaVu, Moments, Open
Conversations, About, Open to, Links) switched on/off and reordered, up to four featured works, which DejaVus are
public, which public Scrapbook entries appear as Moments, and links. Cards follow one contract (§17): cover, title and a
descriptor — "Visual story · 5 slides", "Spoken word · 2:14", "Photo essay · 7 min", "Poem". A public DejaVu contains
only public published works and Moments chosen for the page; private Moments in the same DejaVu never appear.

## Rights, provenance, conversation (§20–22)

Each work shows **Rights & credits** from deterministic data: copyright holder, contributor credits, credits for
attribution-licensed sources, the creator's sharing/attribution/remix statement, an AI-assistance disclosure when
versions or imagery were AI-made, and "published version N (from vN)". Never inferred by CreativeMind.
**Open a conversation about this** is off by default; when opened it links an Open Conversation from the work's page.

## Share previews, analytics (§28, §38)

- `generateMetadata` gives each work a canonical URL, Open Graph type (article / video / music) and a description built
  from its descriptor; `opengraph-image.tsx` renders a type-aware card (a photograph is simply the picture). Unlisted
  and private works are `noindex`.
- `published_work_stats`: daily views, completions (carousel end, film/recording end) and shares per work — no visitor
  data, no cookies; the creator sees "This week · N views · M finished · K shared". Never shown publicly.

## Not yet

Custom domains, password-protected works, "View earlier version", public Projects, signed-in visitor actions (Save
reference / Bring to Studio from a public page), chapters and synchronized transcripts, and social share connectors.

## Tests

`packages/creator-studio/src/publish-options.test.ts`, `tests/db/creator-publish.test.ts`,
`e2e/creator-publish-pages.spec.ts`.
