"use client";
import { CanvasAtmosphere, type AtmosphereMood, KitCameraIcon, KitHomeIcon, KitImageIcon, KitLayersIcon, KitMicIcon, KitPencilIcon, KitPlusIcon, KitSearchIcon, KitSparklesIcon, KitUsersIcon, Palette, type PaletteGroup, type PaletteItem as LeafItem } from "@wonder/ui";
import { ArrowLeft, Compass, CornerUpRight, MoreHorizontal, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { MeTalkSheet } from "./metalk-sheet";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { resolveContextStrip } from "@/lib/context-strip/resolve";
import { PRIORITY, type StripItem, type StripModel } from "@/lib/context-strip/types";
import { createPalette, globalPalette, resolvePalette } from "@/lib/palette/resolve";
import type { PaletteContext, PaletteIcon, PaletteItem, PaletteModel } from "@/lib/palette/types";

/**
 * The context-aware Creative Palette (docs/ui-redesign/palette-spec.md). Each screen says where the creator is with
 * <PaletteScope>; `resolvePalette` picks the three or four things worth doing next, with More… and Go to… (the six
 * global destinations) one tap away. Screens that don't declare a context get the global Palette.
 */

const ICONS: Record<PaletteIcon, React.ComponentType<{ className?: string }>> = {
  home: KitHomeIcon,
  pen: KitPencilIcon,
  images: KitImageIcon,
  users: KitUsersIcon,
  user: UserRound,
  spark: KitSparklesIcon,
  add: KitPlusIcon,
  camera: KitCameraIcon,
  mic: KitMicIcon,
  search: KitSearchIcon,
  compass: Compass,
  people: KitUsersIcon,
  room: KitLayersIcon,
  more: MoreHorizontal,
  go: CornerUpRight,
  back: ArrowLeft,
};

const Ctx = createContext<{ set: (c: PaletteContext | null) => void; openMeTalk: () => void; signal: (s: StripItem | null, id?: string) => void } | null>(null);
const StripCtx = createContext<StripModel>({ primary: null, secondary: null });

/** The navbar Context Strip for the current screen. */
export function useContextStrip() {
  return useContext(StripCtx);
}

/**
 * Raise a transient Context Strip state from a screen (Saving…, Saved, Publish failed). Pass `ttl` for confirmations
 * that should return to the stable context (§13); pass null to clear.
 */
export function useStripSignal() {
  const ctx = useContext(Ctx);
  return useCallback(
    (id: string, s: Omit<StripItem, "id" | "priority" | "expiresAt"> & { priority?: number; ttl?: number } | null) =>
      ctx?.signal(s ? { ...s, id, priority: s.priority ?? PRIORITY.save, expiresAt: s.ttl ? Date.now() + s.ttl : undefined } : null, id),
    [ctx],
  );
}

/** Open the meTalk sheet from anywhere on the Canvas (e.g. the Home empty state). */
export function useMeTalk() {
  return useContext(Ctx)?.openMeTalk ?? (() => undefined);
}

/** The Canvas atmosphere follows where the creator is; utility screens stay quiet. */
function moodFor(page: PaletteContext["page"] | undefined): AtmosphereMood {
  switch (page) {
    case "home":
      return "dawn";
    case "creation":
    case "studio":
    case "context":
    case "transform":
    case "compare":
    case "derivatives":
    case "share":
    case "publish":
      return "studio";
    case "materials":
    case "material":
    case "collection":
    case "spaces":
    case "search":
    case "explore":
      return "materials";
    case "huddles":
    case "huddle":
    case "huddle-summary":
    case "discover":
    case "me":
    case "creator":
      return "together";
    case "room":
    case "crew":
      return "room";
    default:
      return "quiet";
  }
}

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<PaletteContext | null>(null);
  const [talk, setTalk] = useState(false);
  const [signals, setSignals] = useState<StripItem[]>([]);
  const [online, setOnline] = useState(true);
  const value = useMemo(
    () => ({
      set: setContext,
      openMeTalk: () => setTalk(true),
      signal: (s: StripItem | null, id?: string) => setSignals((all) => [...all.filter((x) => x.id !== (s?.id ?? id)), ...(s ? [s] : [])]),
    }),
    [],
  );
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  // Transient states expire back to the stable context (§13): re-resolve when the next one lapses.
  useEffect(() => {
    const next = Math.min(...signals.map((s) => s.expiresAt ?? Infinity));
    if (!Number.isFinite(next)) return;
    const t = setTimeout(() => {
      setSignals((all) => all.filter((s) => !s.expiresAt || s.expiresAt > Date.now()));
    }, Math.max(0, next - Date.now()) + 20);
    return () => clearTimeout(t);
  }, [signals]);
  // Expired signals are pruned above, so the resolver sees only live ones. Screens clear their own signals on leave.
  const strip = useMemo(() => resolveContextStrip({ page: context?.page ?? null, lifecycle: context?.lifecycle, facts: context?.strip, signals, online, now: 0 }), [context, signals, online]);
  return (
    <Ctx.Provider value={value}>
      <CanvasAtmosphere mood={moodFor(context?.page)} />
      <StripCtx.Provider value={strip}>{children}</StripCtx.Provider>
      <CreativePalette context={context} onMeTalk={() => setTalk(true)} />
      <MeTalkSheet open={talk} onOpenChange={setTalk} />
    </Ctx.Provider>
  );
}

/** Where the creator is on this screen. Rendered once per screen; cleared on leave. */
export function PaletteScope({ context }: { context: Omit<PaletteContext, "pathname"> }) {
  const ctx = useContext(Ctx);
  const key = JSON.stringify(context);
  useEffect(() => {
    ctx?.set(JSON.parse(key) as PaletteContext);
    return () => ctx?.set(null);
  }, [ctx, key]);
  return null;
}

type View = "main" | "more" | "global" | "create";

function CreativePalette({ context, onMeTalk }: { context: PaletteContext | null; onMeTalk: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("main");
  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) setView("main");
  };

  const main: PaletteModel = context ? resolvePalette({ ...context, pathname }) : globalPalette(pathname);
  const model = view === "more" ? { ...main, primary: main.more, title: main.title ? `More for ${main.title.replace(/^This /, "this ")}` : "More" } : view === "global" ? globalPalette(pathname) : view === "create" ? createPalette() : main;

  const leaf = (x: PaletteItem): LeafItem => {
    const Icon = x.icon ? ICONS[x.icon] : null;
    const sub = x.target.kind === "command" && (x.target.command === "create-menu" || x.target.command === "global" || x.target.command === "more" || x.target.command === "back");
    return {
      key: x.id,
      label: x.label,
      hint: x.hint,
      current: x.current,
      keepOpen: sub,
      icon: Icon ? <Icon className="size-5" /> : undefined,
      onSelect: () => {
        if (x.target.kind === "route") return router.push(x.target.href);
        if (x.target.command === "metalk") return onMeTalk();
        if (x.target.command === "create-menu") return setView("create");
      },
    };
  };
  const nav = (id: string, label: string, icon: PaletteIcon, to: View, hint?: string): LeafItem => {
    const Icon = ICONS[icon];
    return { key: id, label, hint, quiet: true, keepOpen: true, icon: <Icon className="size-5" />, onSelect: () => setView(to) };
  };

  const extras: LeafItem[] =
    view === "main"
      ? [...(main.more.length ? [nav("more", "More…", "more", "more")] : []), ...(main.global ? [] : [nav("goto", "Go to…", "go", "global", "Home, Materials, Huddles…")])]
      : [nav("back", "Back", "back", "main")];
  const groups: PaletteGroup[] = [
    { key: view, label: model.title ?? undefined, srLabel: model.global ? "Destinations" : undefined, items: model.primary.map(leaf) },
    ...(extras.length ? [{ key: "palette-nav", srLabel: "More options", items: extras }] : []),
  ];
  const count = model.primary.length;
  return <Palette groups={groups} open={open} onOpenChange={onOpenChange} announce={`${view === "main" ? "Creative Palette opened" : (model.title ?? "Destinations")}. ${count} ${count === 1 ? "action" : "actions"} available.`} />;
}
