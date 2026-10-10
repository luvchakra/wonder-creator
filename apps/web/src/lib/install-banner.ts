/**
 * "Install the app" banner (docs/install-banner.md): who sees it, decided by small pure functions so every case is a
 * unit test. The banner itself (`components/install-banner.tsx`) only gathers these facts from the browser.
 *
 * It shows on phones and tablets only, only when the browser can really install Wonder Creator, and never when it is
 * already installed or running installed. Two ways to install:
 *  - "prompt": Chromium browsers (Chrome, Edge, Samsung Internet…) fired `beforeinstallprompt`, which itself means
 *    "installable and not installed"; Install opens the browser's own one-tap dialog.
 *  - "ios": Safari (and, from iOS 16.4, Chrome, Edge and Firefox on iOS) add to the Home Screen from the share sheet;
 *    there is no programmatic install, so the banner explains the two taps.
 * Anything else — Firefox on Android, in-app browsers, desktop — sees nothing.
 */

export type InstallVariant = "prompt" | "ios";

/** Remembered on this browser under one key. Installed wins over a snooze. */
export interface InstallMemory {
  installed?: true;
  /** Epoch ms; hidden until then. */
  snoozedUntil?: number;
}

export const INSTALL_STORAGE_KEY = "wc.install-banner";
export const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

export interface DeviceSignals {
  userAgent: string;
  /** `navigator.userAgentData?.mobile`, when the browser has it. */
  uaDataMobile?: boolean;
  maxTouchPoints: number;
  /** `matchMedia('(pointer: coarse)').matches`. */
  coarsePointer: boolean;
}

export interface Platform {
  /** A phone or tablet (a touchscreen laptop is not). */
  mobile: boolean;
  /** iPhone, iPod or iPad (including iPadOS presenting itself as a Mac). */
  ios: boolean;
  /** An app's built-in browser (Instagram, Facebook, LinkedIn, an Android WebView…): it can't install anything. */
  inApp: boolean;
  /** An iOS browser whose share sheet offers Add to Home Screen. */
  iosCanAddToHome: boolean;
}

const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|LinkedInApp|MicroMessenger|\bLine\/|Snapchat|Pinterest|Twitter|TikTok|musical_ly|Bytedance|GSA\/|\bwv\)|WebView/i;

export function detectPlatform(s: DeviceSignals): Platform {
  const ua = s.userAgent;
  const iPadAsMac = /Macintosh/.test(ua) && s.maxTouchPoints > 1;
  const ios = /iPhone|iPod|iPad/.test(ua) || iPadAsMac;
  const handheld = s.uaDataMobile === true || /Android|iPhone|iPod|iPad/.test(ua) || iPadAsMac;
  // A touch laptop has a coarse pointer but none of the hints above; a phone in a desktop-sized window still has both.
  const mobile = handheld && s.coarsePointer;
  const inApp = IN_APP.test(ua);
  let iosCanAddToHome = false;
  if (ios && !inApp) {
    const v = /OS (\d+)[_.](\d+)/.exec(ua);
    const atLeast164 = v ? Number(v[1]) > 16 || (Number(v[1]) === 16 && Number(v[2]) >= 4) : false;
    const otherBrowser = /CriOS|FxiOS|EdgiOS/.test(ua);
    // Safari carries "Safari/" (an app's embedded view doesn't); other iOS browsers gained Add to Home Screen in 16.4.
    const safari = !otherBrowser && /Safari\//.test(ua) && !/OPiOS|OPT\/|YaBrowser|DuckDuckGo|Ddg\//.test(ua);
    iosCanAddToHome = safari || (otherBrowser && atLeast164);
  }
  return { mobile, ios, inApp, iosCanAddToHome };
}

/** Pages where the banner never appears: someone's published page, embeds, sign-in hand-offs, immersive reading. */
const HIDDEN_ROUTES: RegExp[] = [
  /^\/p(\/|$)/, // published Creator Pages and works, seen by visitors: the creator's page, not ours
  /^\/s(\/|$)/, // a private link someone was sent
  /^\/embed(\/|$)/,
  /^\/auth(\/|$)/, // callback and sign-out hand-offs
  /^\/api(\/|$)/,
  /^\/consent(\/|$)/,
  /^\/creations\/[^/]+\/read(\/|$)/, // the quiet full-screen reading view
];

export function routeAllowsInstallBanner(pathname: string): boolean {
  return !HIDDEN_ROUTES.some((r) => r.test(pathname));
}

export interface InstallInputs {
  platform: Platform;
  /** Running as an installed app (display-mode standalone/fullscreen/minimal-ui/window-controls-overlay, or iOS standalone). */
  standalone: boolean;
  /** `getInstalledRelatedApps()` returned an entry: installed on this device. */
  relatedInstalled: boolean;
  /** A `beforeinstallprompt` event is held, ready for `prompt()`. */
  hasPrompt: boolean;
  memory: InstallMemory | null;
  now: number;
  /** The page allows it (`routeAllowsInstallBanner`) and isn't framed. */
  routeAllowed: boolean;
}

export function installVariant(i: InstallInputs): InstallVariant | null {
  if (!i.routeAllowed || !i.platform.mobile || i.platform.inApp) return null;
  if (i.standalone || i.relatedInstalled) return null;
  if (i.memory?.installed) return null;
  if (typeof i.memory?.snoozedUntil === "number" && i.memory.snoozedUntil > i.now) return null;
  if (i.platform.ios) return i.platform.iosCanAddToHome ? "ios" : null;
  return i.hasPrompt ? "prompt" : null;
}

/** Reads what was stored, ignoring anything malformed (it came from storage, so it isn't trusted). */
export function parseInstallMemory(raw: string | null): InstallMemory | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;
    const o = v as { installed?: unknown; snoozedUntil?: unknown };
    if (o.installed === true) return { installed: true };
    if (typeof o.snoozedUntil === "number" && Number.isFinite(o.snoozedUntil)) return { snoozedUntil: o.snoozedUntil };
    return null;
  } catch {
    return null;
  }
}

export const snoozed = (now: number): InstallMemory => ({ snoozedUntil: now + SNOOZE_MS });

/**
 * Chrome can fire `beforeinstallprompt` before React has mounted, so the root layout runs this tiny script in <head>
 * (the CSP allows inline scripts). It keeps the event on `window.__wcInstall` and announces changes with
 * `wc:install-change`; the banner picks it up from there. No storage, no network.
 */
export const INSTALL_CAPTURE_EVENT = "wc:install-change";
export const INSTALL_CAPTURE_SCRIPT = `(function(){try{var w=window;if(w.__wcInstall)return;var s=w.__wcInstall={prompt:null,installed:false};w.addEventListener("beforeinstallprompt",function(e){e.preventDefault();s.prompt=e;w.dispatchEvent(new Event("${INSTALL_CAPTURE_EVENT}"))});w.addEventListener("appinstalled",function(){s.prompt=null;s.installed=true;w.dispatchEvent(new Event("${INSTALL_CAPTURE_EVENT}"))})}catch(_){}})();`;
