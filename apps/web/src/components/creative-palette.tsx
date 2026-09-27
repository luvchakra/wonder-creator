"use client";
import { Palette, type PaletteGroup } from "@wonder/ui";
import { Camera, Compass, FolderKanban, Home, ImagePlus, Images, Mic, PenLine, Sparkles, UserRound, Users, UsersRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MeTalkSheet } from "./metalk-sheet";
import { createContext, Suspense, useContext, useEffect, useMemo, useState } from "react";

/**
 * The app's Creative Palette (UI redesign §7): global destinations and quick creative actions, plus a contextual
 * group the current screen registers (a Creation, a Material, a Creative Room…) with <PaletteActions>.
 */

export interface ContextAction {
  key: string;
  label: string;
  href: string;
  hint?: string;
  icon?: keyof typeof ICONS;
}

const ICONS = { home: Home, pen: PenLine, images: Images, users: Users, user: UserRound, spark: Sparkles, add: ImagePlus, camera: Camera, mic: Mic, compass: Compass, people: UsersRound, room: FolderKanban } as const;

type Context = { title: string; actions: ContextAction[] } | null;
const Ctx = createContext<{ set: (c: Context) => void; openMeTalk: () => void } | null>(null);

/** Open the meTalk sheet from anywhere on the Canvas (e.g. the Home empty state). */
export function useMeTalk() {
  return useContext(Ctx)?.openMeTalk ?? (() => undefined);
}

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<Context>(null);
  const [talk, setTalk] = useState(false);
  const value = useMemo(() => ({ set: setContext, openMeTalk: () => setTalk(true) }), []);
  return (
    <Ctx.Provider value={value}>
      {children}
      <Suspense>
        <CreativePalette context={context} onMeTalk={() => setTalk(true)} />
      </Suspense>
      <MeTalkSheet open={talk} onOpenChange={setTalk} />
    </Ctx.Provider>
  );
}

/** A screen's own Palette actions (e.g. the Creation Palette). Rendered once per screen; cleared on leave. */
export function PaletteActions({ title, actions }: { title: string; actions: ContextAction[] }) {
  const ctx = useContext(Ctx);
  const key = JSON.stringify({ title, actions });
  useEffect(() => {
    ctx?.set(JSON.parse(key) as Context);
    return () => ctx?.set(null);
  }, [ctx, key]);
  return null;
}

function CreativePalette({ context, onMeTalk }: { context: Context; onMeTalk: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const tab = search.get("tab");
  const icon = (k: keyof typeof ICONS) => {
    const I = ICONS[k];
    return <I className="size-5" aria-hidden />;
  };
  const go = (href: string) => () => router.push(href);

  const groups: PaletteGroup[] = [
    ...(context?.actions.length
      ? [{ key: "context", label: context.title, items: context.actions.map((a) => ({ key: a.key, label: a.label, hint: a.hint, icon: a.icon ? icon(a.icon) : undefined, onSelect: go(a.href) })) }]
      : []),
    {
      key: "destinations",
      items: [
        { key: "home", label: "Home", icon: icon("home"), current: pathname === "/", onSelect: go("/") },
        { key: "creation", label: "Creation", icon: icon("pen"), current: pathname.startsWith("/artifacts") || (pathname === "/space" && (tab === "progress" || tab === "created")), onSelect: go("/space?tab=progress") },
        { key: "materials", label: "Materials", icon: icon("images"), current: pathname.startsWith("/space") && !(tab === "progress" || tab === "created"), onSelect: go("/space?tab=ideas") },
        { key: "huddles", label: "Huddles", icon: icon("users"), current: pathname.startsWith("/huddles"), onSelect: go("/huddles") },
        { key: "me", label: "Me", icon: icon("user"), current: pathname.startsWith("/profile") || pathname.startsWith("/creators"), onSelect: go("/profile") },
      ],
    },
    {
      key: "actions",
      label: "Create",
      items: [
        { key: "new", label: "New Creation", icon: icon("spark"), onSelect: go("/create") },
        { key: "bring", label: "Bring Material", icon: icon("add"), onSelect: go("/send") },
        { key: "capture", label: "Capture", hint: "Photo, voice or a note", icon: icon("camera"), onSelect: go("/send") },
        { key: "metalk", label: "meTalk", hint: "Say what you want to make", icon: icon("mic"), onSelect: onMeTalk },
        { key: "explore", label: "Explore", icon: icon("compass"), current: pathname.startsWith("/search"), onSelect: go("/search") },
        { key: "people", label: "People", icon: icon("people"), current: pathname.startsWith("/discover"), onSelect: go("/discover") },
      ],
    },
  ];

  return <Palette groups={groups} open={open} onOpenChange={setOpen} />;
}
