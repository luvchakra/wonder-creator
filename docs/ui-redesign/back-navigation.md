# Back goes where you came from

Owner, 5 Oct 2026: "when I click Back on the Writing page it takes me to the Creation page — that's wrong. I opened the
Writing page from the Creative Room, so it should take me back to the Creative Room. The app should remember the
context."

## The rule

**Back is a return, not a parent link.** Every Back arrow and every "← Somewhere" link takes the creator to the page
they came from, in this tab. Only when there is no such page (a pasted link, a notification, a new tab) does Back go to
the page's natural home.

Today most pages hard-wire a parent (`Writing page → Creation page`, `Room → Creative Rooms`), so a Lyrics page opened
from a Room sends the writer to a page they never visited. A few pages carry `?from=studio:<id>`, and the Carousel's
Studio alone reads the per-tab page memory (`NavMemory`). This contract makes that memory the rule everywhere.

## How it decides

Back on page **P** goes to the first of these that exists:

1. **The trail.** The most recent page in this tab's trail whose *path* differs from P's (query and hash ignored, so
   `?tab=versions` of the same page is still the same page), skipping pages that only forward (see below). The entry
   is used as recorded, query included, so Back from a Material lands on `Materials › Ideas`, not a bare list.
2. **An explicit origin** on the link, `?from=<place>`, for links opened in a new tab or sent elsewhere. Known values:
   `room:<id>`, `creation:<id>`, `studio:<id>`, `material:<id>`, `collection:<id>`. Unknown or unreadable values are
   ignored. The trail wins over `from` because it is what actually happened in this tab.
3. **The page's home**, decided by its context, never a generic list when something more specific is true:

   | Page | Home |
   | --- | --- |
   | A part's Creation (any of its pages) | its Creative Room |
   | A Creation's work page (Writing · Images · Audio · Studio) | the Creation page |
   | The Creation page, and its Preview / Read / Context / Share / Publish / Transform / Collaborate / Compare / Derivatives | the Creation page (the Creation page itself → Materials › Creations, or the Room when it's a part) |
   | A Slide editor | its Carousel |
   | A Material / a Collection | Materials › Ideas / › Collections |
   | A Creative Room / a Crew / a Room's shared item | Creative Rooms / its Room |
   | A Huddle summary | Huddles |
   | A Pulse conversation / a Scrapbook post / a Message thread | Pulse / Scrapbook / Messages |
   | An Approval / a run | Approvals / Create |
   | A Settings page | Settings |

## The trail

* `NavMemory` (app shell, `sessionStorage`, per tab) records every page as its path and query, newest last, last 20.
  Private mode without storage simply means rule 1 never matches.
* **Pages that only forward never enter the trail**: the Studio address forwarding writing to `/write`, a Carousel's
  Creation page forwarding to its Studio, old addresses redirecting. A forwarder leaves no entry, so Back can never
  bounce between a page and its forwarder. (`ForwardTo` and route redirects use `replace`, so the browser's own Back
  agrees.)
* **Leaving something for good drops its pages from the trail**: deleting a Creation or Material, leaving a Huddle,
  declining an invitation. Back never offers a page the creator just closed.
* **Coming back to a page is a return to it.** When a page already in the trail is visited again (by any link, Done
  included), the pages after it leave the trail, as on a stack. So Studio → Slide editor → Done → Back goes where the
  Studio was opened from, never back into the Slide editor.

## What Back looks like

* One component, `BackLink`, used by every page that has a Back: `<BackLink home="/rooms/…" />`. It renders the arrow
  (or "← Name" where the page shows a text link), its `href` is the home (so it works before hydration and in a new
  tab), and on tap it computes the target as above and pushes it.
* **Its name says where it goes**: `aria-label="Back to the Creative Room"`, "Back to Materials", "Back to Platform 3"
  (a Room's or Creation's title when the page knows it). Text links read the same ("← Platform 3"). Never a bare
  "Back" when the destination is known.
* In-app Back **pushes** the target (never `history.back()`): history may hold forwards and intermediate states, and
  a push is the same from every entry point. The browser's Back still lands on the same page in the common case
  because forwarders replace rather than push.
* Back is never destructive and never loses work: pages that autosave flush before leaving (the Images page's queued
  save, the Writing page's draft); pages with unsaved, non-autosaved state ask first (the existing rule).
* **Done is not Back.** On the Writing page, Done ends editing and stays on the page; only the arrow leaves. The
  Palette's `Go to…`, the top bar's icons and section links start new journeys; they are not Back and don't move the
  trail backwards.

## Examples

| Journey | Back goes to |
| --- | --- |
| Room → Start Lyrics → Writing page | the Room |
| Materials › Creations → Creation page → Continue writing | the Creation page |
| Creation page → More › Context | the Creation page |
| Writing page → Preview | the Writing page |
| Home → Continue (row) → Writing page | Home |
| A notification → Writing page (no trail) | the Creation page; the Room if it's a part |
| Pasted `/creations/<id>/write?from=room:<id>` in a new tab | the Room |
| Room → Lyrics → Preview → Back → Back | the Writing page, then the Room |

## Tests

* `e2e/back-navigation.spec.ts`: each journey above, the forwarder case (Carousel), the delete case, and a new tab
  with `?from`.
* Every page spec that taps Back asserts the destination, not the parent.

Implementation: `apps/web/src/components/nav-memory.tsx` (the trail, `forget(prefix)`, `trailTarget`, `fromTarget`,
`popTo`), `apps/web/src/components/back-link.tsx` (`icon`, `text` and `close` forms), and each page's Back replaced by
`BackLink` with its home. A forwarder is recognised by timing: a page left within 1.5s of arriving with no tap or key in
between is replaced in the trail by the page it forwarded to (a redirect that reloads the document is trusted only when
the new page's referrer is that forwarder). The Room and the Creation's work pages carry their own names as page titles, so Back reads "Back to
<name>".
