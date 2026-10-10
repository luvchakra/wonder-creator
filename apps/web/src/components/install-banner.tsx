"use client";
import { Button, IconButton, KIT, KitArt } from "@wonder/ui";
import { Share, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  INSTALL_CAPTURE_EVENT,
  INSTALL_STORAGE_KEY,
  detectPlatform,
  installVariant,
  parseInstallMemory,
  routeAllowsInstallBanner,
  snoozed,
  type InstallMemory,
  type Platform,
} from "@/lib/install-banner";

/**
 * "Install the app" (docs/install-banner.md): a quiet band at the very top of phones and tablets, above the top bar,
 * that pushes the page down rather than covering it. It appears only when this browser can install Wonder Creator and it
 * isn't installed here; the rules are `installVariant` (lib/install-banner.ts). It never touches CreativeRadio (it lives
 * outside the audio provider and mounting it re-mounts nothing) and is a plain <div>, so the Palette and player, which
 * measure the first <header>, settle below the top bar as usual.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
interface Holder {
  prompt: BeforeInstallPromptEvent | null;
  installed: boolean;
}
interface Env {
  platform: Platform;
  standalone: boolean;
  framed: boolean;
  canCheckRelated: boolean;
}
interface Snap {
  env: Env;
  hasPrompt: boolean;
  memory: InstallMemory | null;
  /** When this snapshot was taken (a snooze is compared with it). */
  now: number;
}

type InstallWindow = Window & { __wcInstall?: Holder };
type InstallNavigator = Navigator & { standalone?: boolean; userAgentData?: { mobile?: boolean }; getInstalledRelatedApps?: () => Promise<unknown[]> };

function holder(): Holder {
  const w = window as InstallWindow;
  if (!w.__wcInstall) {
    // The <head> script didn't run (it always does in the app; this keeps the banner working without it).
    const s: Holder = (w.__wcInstall = { prompt: null, installed: false });
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      s.prompt = e as BeforeInstallPromptEvent;
      window.dispatchEvent(new Event(INSTALL_CAPTURE_EVENT));
    });
    window.addEventListener("appinstalled", () => {
      s.prompt = null;
      s.installed = true;
      window.dispatchEvent(new Event(INSTALL_CAPTURE_EVENT));
    });
  }
  return w.__wcInstall;
}

function readMemory(): InstallMemory | null {
  try {
    return parseInstallMemory(localStorage.getItem(INSTALL_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeMemory(m: InstallMemory) {
  try {
    localStorage.setItem(INSTALL_STORAGE_KEY, JSON.stringify(m));
  } catch {
    // Blocked storage: the choice lasts for this visit (the snapshot below still hides the banner).
  }
  memoryOverride = m;
}

const DISPLAY_MODES = ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"];

function readEnv(): Env {
  const nav = navigator as InstallNavigator;
  const mq = (q: string) => typeof window.matchMedia === "function" && window.matchMedia(q).matches;
  let framed = false;
  try {
    framed = window.self !== window.top;
  } catch {
    framed = true;
  }
  return {
    platform: detectPlatform({ userAgent: nav.userAgent, uaDataMobile: nav.userAgentData?.mobile, maxTouchPoints: nav.maxTouchPoints ?? 0, coarsePointer: mq("(pointer: coarse)") }),
    standalone: DISPLAY_MODES.some((m) => mq(`(display-mode: ${m})`)) || nav.standalone === true,
    framed,
    canCheckRelated: typeof nav.getInstalledRelatedApps === "function",
  };
}

// One small store: the held event and what's remembered, as a stable snapshot for useSyncExternalStore.
let env: Env | null = null;
let snap: Snap | null = null;
let memoryOverride: InstallMemory | null = null;
const listeners = new Set<() => void>();

function compute(): Snap {
  env ??= readEnv();
  const h = holder();
  if (h.installed && !memoryOverride?.installed) writeMemory({ installed: true });
  return { env, hasPrompt: !!h.prompt, memory: memoryOverride ?? readMemory(), now: Date.now() };
}
function refresh() {
  snap = compute();
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  if (listeners.size === 1) window.addEventListener(INSTALL_CAPTURE_EVENT, refresh);
  return () => {
    listeners.delete(l);
    if (!listeners.size) window.removeEventListener(INSTALL_CAPTURE_EVENT, refresh);
  };
}
const getSnapshot = () => (snap ??= compute());
const getServerSnapshot = () => null;

export function InstallBanner() {
  const pathname = usePathname() ?? "/";
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [related, setRelated] = useState<"unknown" | "none" | "installed">("unknown");
  const [howTo, setHowTo] = useState(false);
  const stepsId = useId();

  const worthChecking = !!s && s.env.canCheckRelated && s.env.platform.mobile && !s.env.standalone;
  useEffect(() => {
    if (!worthChecking) return;
    let live = true;
    (navigator as InstallNavigator)
      .getInstalledRelatedApps!()
      .then((apps) => live && setRelated(Array.isArray(apps) && apps.length > 0 ? "installed" : "none"))
      .catch(() => live && setRelated("none"));
    return () => {
      live = false;
    };
  }, [worthChecking]);

  if (!s) return null;
  // Until the installed-apps check answers (where the browser has it), say nothing rather than flash the banner.
  if (worthChecking && related === "unknown") return null;
  const variant = installVariant({
    platform: s.env.platform,
    standalone: s.env.standalone,
    relatedInstalled: related === "installed",
    hasPrompt: s.hasPrompt,
    memory: s.memory,
    now: s.now,
    routeAllowed: !s.env.framed && routeAllowsInstallBanner(pathname),
  });
  if (!variant) return null;

  const dismiss = () => {
    writeMemory(snoozed(Date.now()));
    refresh();
  };
  const added = () => {
    writeMemory({ installed: true });
    refresh();
  };
  const install = async () => {
    const h = holder();
    const e = h.prompt;
    if (!e) return;
    // The event can be used once: let it go and step aside while the browser asks.
    h.prompt = null;
    refresh();
    try {
      await e.prompt();
      const { outcome } = await e.userChoice;
      writeMemory(outcome === "accepted" ? { installed: true } : snoozed(Date.now()));
    } catch {
      writeMemory(snoozed(Date.now()));
    }
    refresh();
  };

  return (
    <div role="region" aria-label="Install Wonder Creator" data-install-banner={variant} className="grid grid-rows-[1fr] print:hidden motion-safe:animate-[install-in_260ms_ease-out]">
      <div className="min-h-0 overflow-hidden">
        <div className="relative isolate overflow-hidden border-b border-border-soft bg-[image:var(--gradient-card)] pt-[env(safe-area-inset-top)] shadow-[0_6px_18px_-14px_rgb(107_91_149/0.35)]">
          <KitArt art={KIT.painted.leafSprigSage} sizes="5rem" className="pointer-events-none absolute -bottom-6 -left-5 -z-10 h-16 w-auto opacity-30" />
          <div className="mx-auto flex max-w-7xl items-center gap-3 py-2 pl-4 pr-1.5 sm:px-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- the manifest's own app icon, a fixed small PNG */}
            <img src={KIT.appIconPng.s192.src} alt="" width={40} height={40} className="size-10 shrink-0 rounded-[11px] shadow-[0_2px_8px_-2px_rgb(107_91_149/0.35)]" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[15px] leading-tight text-ink">Wonder Creator</p>
              <p className="line-clamp-2 text-[12.5px] leading-snug text-ink-subtle">Full screen, one tap from your home screen.</p>
            </div>
            {variant === "prompt" ? (
              <Button size="sm" onClick={install} className="shrink-0">
                Install
              </Button>
            ) : (
              <Button size="sm" variant="soft" onClick={() => setHowTo((v) => !v)} aria-expanded={howTo} aria-controls={stepsId} className="shrink-0">
                How to
              </Button>
            )}
            <IconButton label="Not now" onClick={dismiss}>
              <X className="size-[18px]" aria-hidden />
            </IconButton>
          </div>
          {variant === "ios" ? (
            <div id={stepsId} hidden={!howTo} className="mx-auto max-w-7xl px-4 pb-2 sm:px-6">
              <div className="flex items-end justify-between gap-2">
                <ol className="min-w-0 space-y-1 text-[13px] leading-snug text-ink-muted">
                  <li className="flex items-center gap-2">
                    <span aria-hidden className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-ink">1</span>
                    <span>
                      Tap Share{" "}
                      <Share className="inline size-[15px] -translate-y-px text-accent-ink" aria-label="the square with an arrow pointing up" role="img" />
                      <span className="text-ink-subtle"> · in Safari it may be under •••</span>
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span aria-hidden className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-ink">2</span>
                    <span>
                      Choose <strong className="font-semibold text-ink">Add to Home Screen</strong>
                    </span>
                  </li>
                </ol>
                <Button size="sm" variant="ghost" onClick={added} className="-mb-0.5 shrink-0 text-accent-ink">
                  I’ve added it
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
