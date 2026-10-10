import { describe, expect, it } from "vitest";
import { SNOOZE_MS, detectPlatform, installVariant, parseInstallMemory, routeAllowsInstallBanner, snoozed, type DeviceSignals, type InstallInputs } from "./install-banner";

const UA = {
  chromeAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
  chromeAndroidTablet: "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  samsung: "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36",
  firefoxAndroid: "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0",
  instagramAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.0",
  safariIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
  chromeIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1",
  chromeIphoneOld: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/110.0.0.0 Mobile/15E148 Safari/604.1",
  facebookIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.0]",
  linkedinIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 LinkedInApp/9.30",
  iPadAsMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  windowsChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
};

const touch = (userAgent: string, extra: Partial<DeviceSignals> = {}): DeviceSignals => ({ userAgent, maxTouchPoints: 5, coarsePointer: true, ...extra });
const NOW = 1_800_000_000_000;

function inputs(signals: DeviceSignals, over: Partial<InstallInputs> = {}): InstallInputs {
  return { platform: detectPlatform(signals), standalone: false, relatedInstalled: false, hasPrompt: false, memory: null, now: NOW, routeAllowed: true, ...over };
}

describe("detectPlatform", () => {
  it("counts phones and tablets, never a touchscreen laptop or a desktop", () => {
    expect(detectPlatform(touch(UA.chromeAndroid)).mobile).toBe(true);
    expect(detectPlatform(touch(UA.chromeAndroidTablet)).mobile).toBe(true);
    expect(detectPlatform(touch(UA.safariIphone)).mobile).toBe(true);
    expect(detectPlatform(touch(UA.iPadAsMac)).mobile).toBe(true);
    expect(detectPlatform(touch(UA.iPadAsMac)).ios).toBe(true);
    expect(detectPlatform(touch(UA.windowsChrome, { uaDataMobile: false })).mobile).toBe(false);
    expect(detectPlatform({ userAgent: UA.macSafari, maxTouchPoints: 0, coarsePointer: false }).mobile).toBe(false);
    expect(detectPlatform({ userAgent: UA.windowsChrome, maxTouchPoints: 0, coarsePointer: false }).mobile).toBe(false);
    // A phone's user agent on a mouse-driven screen (a desktop emulating one) isn't a handheld either.
    expect(detectPlatform({ userAgent: UA.chromeAndroid, maxTouchPoints: 0, coarsePointer: false }).mobile).toBe(false);
    // The client hint alone is enough when the user agent is reduced.
    expect(detectPlatform(touch("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/141.0.0.0 Safari/537.36", { uaDataMobile: true })).mobile).toBe(true);
  });

  it("knows which iOS browsers can add to the Home Screen", () => {
    expect(detectPlatform(touch(UA.safariIphone)).iosCanAddToHome).toBe(true);
    expect(detectPlatform(touch(UA.iPadAsMac)).iosCanAddToHome).toBe(true);
    expect(detectPlatform(touch(UA.chromeIphone)).iosCanAddToHome).toBe(true);
    expect(detectPlatform(touch(UA.chromeIphoneOld)).iosCanAddToHome).toBe(false);
    expect(detectPlatform(touch(UA.facebookIphone)).iosCanAddToHome).toBe(false);
    expect(detectPlatform(touch(UA.linkedinIphone)).iosCanAddToHome).toBe(false);
  });

  it("recognises in-app browsers", () => {
    expect(detectPlatform(touch(UA.instagramAndroid)).inApp).toBe(true);
    expect(detectPlatform(touch(UA.facebookIphone)).inApp).toBe(true);
    expect(detectPlatform(touch(UA.chromeAndroid)).inApp).toBe(false);
    expect(detectPlatform(touch(UA.safariIphone)).inApp).toBe(false);
  });
});

describe("installVariant", () => {
  it("never shows on desktop, even when the browser offers to install", () => {
    expect(installVariant(inputs({ userAgent: UA.windowsChrome, maxTouchPoints: 0, coarsePointer: false }, { hasPrompt: true }))).toBeNull();
    expect(installVariant(inputs(touch(UA.windowsChrome, { uaDataMobile: false }), { hasPrompt: true }))).toBeNull();
    expect(installVariant(inputs({ userAgent: UA.macSafari, maxTouchPoints: 0, coarsePointer: false }))).toBeNull();
  });

  it("never shows when running as the installed app", () => {
    expect(installVariant(inputs(touch(UA.chromeAndroid), { hasPrompt: true, standalone: true }))).toBeNull();
    expect(installVariant(inputs(touch(UA.safariIphone), { standalone: true }))).toBeNull();
  });

  it("offers one-tap install on a Chromium phone or tablet once the browser says it can", () => {
    expect(installVariant(inputs(touch(UA.chromeAndroid), { hasPrompt: true }))).toBe("prompt");
    expect(installVariant(inputs(touch(UA.samsung), { hasPrompt: true }))).toBe("prompt");
    expect(installVariant(inputs(touch(UA.chromeAndroidTablet), { hasPrompt: true }))).toBe("prompt");
    // No event yet (or not installable): nothing.
    expect(installVariant(inputs(touch(UA.chromeAndroid)))).toBeNull();
  });

  it("explains Add to Home Screen on iOS Safari", () => {
    expect(installVariant(inputs(touch(UA.safariIphone)))).toBe("ios");
    expect(installVariant(inputs(touch(UA.iPadAsMac)))).toBe("ios");
    expect(installVariant(inputs(touch(UA.chromeIphone)))).toBe("ios");
    expect(installVariant(inputs(touch(UA.chromeIphoneOld)))).toBeNull();
  });

  it("shows nothing in Firefox for Android or in an app's built-in browser", () => {
    expect(installVariant(inputs(touch(UA.firefoxAndroid)))).toBeNull();
    expect(installVariant(inputs(touch(UA.instagramAndroid), { hasPrompt: true }))).toBeNull();
    expect(installVariant(inputs(touch(UA.facebookIphone)))).toBeNull();
    expect(installVariant(inputs(touch(UA.linkedinIphone)))).toBeNull();
  });

  it("hides when the browser reports the app is installed on this device", () => {
    expect(installVariant(inputs(touch(UA.chromeAndroid), { hasPrompt: true, relatedInstalled: true }))).toBeNull();
  });

  it("stays away while snoozed and for good once installed", () => {
    const later = snoozed(NOW);
    expect(later.snoozedUntil).toBe(NOW + SNOOZE_MS);
    expect(installVariant(inputs(touch(UA.chromeAndroid), { hasPrompt: true, memory: later }))).toBeNull();
    expect(installVariant(inputs(touch(UA.safariIphone), { memory: later }))).toBeNull();
    // Fourteen days on, it may ask again.
    expect(installVariant(inputs(touch(UA.chromeAndroid), { hasPrompt: true, memory: later, now: NOW + SNOOZE_MS + 1 }))).toBe("prompt");
    expect(installVariant(inputs(touch(UA.safariIphone), { memory: { installed: true }, now: NOW + 10 * SNOOZE_MS }))).toBeNull();
  });

  it("respects pages where it never belongs", () => {
    expect(installVariant(inputs(touch(UA.chromeAndroid), { hasPrompt: true, routeAllowed: false }))).toBeNull();
  });
});

describe("routeAllowsInstallBanner", () => {
  it("appears on public pages and inside the app", () => {
    for (const p of ["/", "/help", "/about", "/sign-in", "/materials", "/creations/abc", "/creations/abc/deck", "/creators/ana", "/pulse"]) expect(routeAllowsInstallBanner(p), p).toBe(true);
  });
  it("never appears on someone's published page, embeds, sign-in hand-offs or the reading view", () => {
    for (const p of ["/p/ana", "/p/ana/a-poem", "/p/ana/dejavu/1", "/s/tok", "/embed/tok", "/auth/callback", "/auth/sign-out", "/consent", "/creations/abc/read"]) expect(routeAllowsInstallBanner(p), p).toBe(false);
    // Lookalikes are still allowed.
    expect(routeAllowsInstallBanner("/pulse")).toBe(true);
    expect(routeAllowsInstallBanner("/settings")).toBe(true);
  });
});

describe("parseInstallMemory", () => {
  it("reads what the banner stores and ignores anything else", () => {
    expect(parseInstallMemory(JSON.stringify({ installed: true }))).toEqual({ installed: true });
    expect(parseInstallMemory(JSON.stringify({ snoozedUntil: 5 }))).toEqual({ snoozedUntil: 5 });
    for (const bad of [null, "", "not json", "[]", "null", "42", JSON.stringify({ installed: "yes" }), JSON.stringify({ snoozedUntil: "5" }), JSON.stringify({ __proto__: { installed: true } })]) {
      expect(parseInstallMemory(bad), String(bad)).toBeNull();
    }
  });
});
