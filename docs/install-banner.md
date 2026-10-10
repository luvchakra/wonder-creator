# Install banner

Wonder Creator is installable on phone and desktop (its manifest). On **phones and tablets only**, a quiet band at the
very top of the page invites the person to install it — in one tap where the browser allows it — and only when the
browser can actually install it and it isn't installed on this device already.

## When it shows

| Where | What |
| --- | --- |
| Chrome, Edge, Samsung Internet… on Android phones and tablets | **Install** (one tap), only after the browser fires `beforeinstallprompt` — which itself means "installable and not installed". Install calls the browser's own `prompt()` and waits for the answer. |
| Safari on iPhone/iPad (incl. iPadOS presenting as a Mac); Chrome, Edge, Firefox on iOS 16.4+ | **How to**: opens two steps in place — Share (the glyph drawn inline; "in Safari it may be under •••") → **Add to Home Screen** — and **I've added it**. iOS can't install from a page or tell a tab it's installed, so the person's answer is remembered. |
| Firefox on Android, in-app browsers (Instagram, Facebook, LinkedIn, Android WebViews…), desktop (touchscreen laptops included) | Nothing. |

Never shown when:

* running as the installed app (`display-mode` standalone, fullscreen, minimal-ui or window-controls-overlay, or iOS
  `navigator.standalone`);
* the browser reports it installed (`navigator.getInstalledRelatedApps()` returns an entry — the manifest lists itself in
  `related_applications` with `prefer_related_applications: false` for this); the banner waits for that answer rather
  than flash;
* on someone's published page (`/p/*`), a private link (`/s/*`), embeds (`/embed/*`) or inside a frame, sign-in
  hand-offs (`/auth/*`, `/consent`), the full-screen reading view (`/creations/[id]/read`), or in print.

## Remembered on this browser

`localStorage["wc.install-banner"]` (blocked storage breaks nothing; the choice then lasts for the visit):

* installed (`appinstalled`, an accepted prompt, or **I've added it**) → never again;
* **Not now** (the close button) → 14 days;
* the browser's dialog declined (`userChoice.outcome === "dismissed"`) → 14 days.

## Design

At the very top of the viewport, above every top bar, in the page flow (it pushes content down; `env(safe-area-inset-top)`
respected). The app icon from the manifest, the name in Playfair, one line — "Full screen, one tap from your home
screen." (no offline or notification claims: the app has neither) — Install (or How to)
and a 44px **Not now**. Warm card gradient with a faint sage sprig in the corner behind the icon. It opens its own height in 260 ms; nothing moves
with reduced motion. `role="region"` named "Install Wonder Creator"; nothing takes focus.

It lives in the root layout, outside CreativeRadio's provider, so showing or hiding it never touches playback; it's a
`<div>` (the Palette and mini player measure the first `<header>`), so they settle below the top bar as before, and
the Palette's default corner is far from it.

## How it works

* `apps/web/src/lib/install-banner.ts` — pure rules: `detectPlatform` (user-agent client hint, UA tests, iPadOS-as-Mac,
  coarse pointer), `installVariant`, `routeAllowsInstallBanner`, `parseInstallMemory`; plus the tiny `<head>` script
  (`INSTALL_CAPTURE_SCRIPT`) that holds `beforeinstallprompt` on `window.__wcInstall` if it fires before React mounts
  (the CSP allows inline scripts; no storage, no network).
* `apps/web/src/components/install-banner.tsx` — reads the browser facts and renders.
* `apps/web/src/app/manifest.ts` — `id`, `scope`, `related_applications`. `app/layout.tsx` — Apple web-app meta.
* No service worker (Chrome doesn't need one to install), no analytics.

Tests: `apps/web/src/lib/install-banner.test.ts` (unit), `e2e/install-banner.spec.ts` (phone with a synthetic
`beforeinstallprompt`, iPhone, desktop, axe).
