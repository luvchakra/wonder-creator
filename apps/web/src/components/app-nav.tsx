"use client";
import { Avatar, ContextStrip, KIT, KitArt, Logo, cn, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@wonder/ui";
import { Brain, FolderKanban, LogOut, Megaphone, Wallet, NotebookPen, Send, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useContextStrip } from "./creative-palette";
import { MessagesButton } from "./messages-button";
import { NotificationsButton } from "./notifications";
import { NavSearch } from "./nav-search";

/**
 * The top bar (UI redesign §6): logo, the Context Strip, search, messages, notifications and your account — nothing else. There is no module tab
 * bar and no bottom navigation: destinations and actions live in the corner Creative Palette.
 */
export function AppNav({ me }: { me: { name: string; handle: string | null; avatarUrl: string | null } }) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const strip = useContextStrip();

  async function signOut() {
    await fetch("/auth/sign-out", { method: "POST" });
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border-soft/70 bg-cream/85 backdrop-blur-md">
        <div className="relative mx-auto flex h-[var(--nav-height)] max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
          {/* While searching on a phone, the field takes the whole bar (logo and status step aside). */}
          <Link href="/" className={cn("inline-flex min-h-11 shrink-0 items-center rounded-xl focus-visible:outline-2 focus-visible:outline-accent", searchOpen && "hidden sm:inline-flex")} aria-label="Wonder Creator home">
            <Logo height={46} className="hidden sm:block" />
            <Logo variant="mark" height={40} className="sm:hidden" />
          </Link>
          {/* The Context Strip (docs/ui-redesign/context-strip.md): what's happening here, in one quiet line. */}
          <ContextStrip primary={strip.primary} secondary={strip.secondary} LinkComponent={Link} className={cn(searchOpen && "hidden lg:flex")} />
          <div className={cn("flex shrink-0 items-center gap-1.5", searchOpen && "min-w-0 flex-1 justify-end lg:flex-none")}>
            <NavSearch open={searchOpen} onOpenChange={setSearchOpen} />
            <span className={cn("contents", searchOpen && "hidden sm:contents")}>
              <MessagesButton />
              <NotificationsButton />
              <Menu>
                {/* Pressed: the avatar gains the accent ring while the menu is open (Radix sets data-state). */}
                <MenuTrigger
                  className="inline-flex size-11 items-center justify-center rounded-full transition-transform duration-150 active:scale-90 focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none data-[state=open]:bg-accent-soft [&>*]:data-[state=open]:ring-2 [&>*]:data-[state=open]:ring-accent"
                  aria-label="Your account"
                >
                  <Avatar name={me.name} src={me.avatarUrl} size={36} />
                </MenuTrigger>
                {/* Your account (owner, 3 Oct 2026: match the rest of the app): who you are, then what's yours, then your work, then the
                    account itself. Destinations the Palette already offers (Home, Create, Materials, Huddles, Explore, Me) aren't repeated. */}
                <MenuContent className="w-64">
                  <Link href={me.handle ? `/creators/${me.handle}` : "/me"} className="relative isolate flex items-center gap-2.5 overflow-hidden rounded-xl px-2.5 py-2 hover:bg-surface-muted focus-visible:outline-2">
                    <KitArt art={KIT.painted.leafSprigSage} sizes="4rem" className="pointer-events-none absolute -right-2 -top-3 -z-10 h-12 w-auto opacity-50" />
                    <Avatar name={me.name} src={me.avatarUrl} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate font-display text-[16px] leading-tight text-ink">{me.name}</span>
                      <span className="block truncate text-[12px] text-ink-subtle">{me.handle ? `@${me.handle} · ` : ""}View profile</span>
                    </span>
                  </Link>
                  <MenuSeparator />
                  <MenuLabel>Yours</MenuLabel>
                  <MenuItem onSelect={() => router.push("/scrapbook")}>
                    <NotebookPen className="size-4 text-ink-subtle" aria-hidden /> Scrapbook
                  </MenuItem>
                  <MenuItem onSelect={() => router.push("/memory")}>
                    <Brain className="size-4 text-ink-subtle" aria-hidden /> Creative Memory
                  </MenuItem>
                  <MenuItem onSelect={() => router.push("/rooms")}>
                    <FolderKanban className="size-4 text-ink-subtle" aria-hidden /> Creative Rooms
                  </MenuItem>
                  <MenuLabel>Out in the world</MenuLabel>
                  <MenuItem onSelect={() => router.push("/publishing")}>
                    <Send className="size-4 text-ink-subtle" aria-hidden /> Publishing
                  </MenuItem>
                  <MenuItem onSelect={() => router.push("/campaigns")}>
                    <Megaphone className="size-4 text-ink-subtle" aria-hidden /> Campaigns
                  </MenuItem>
                  <MenuItem onSelect={() => router.push("/business")}>
                    <Wallet className="size-4 text-ink-subtle" aria-hidden /> Business
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem onSelect={() => router.push("/settings")}>
                    <Settings className="size-4 text-ink-subtle" aria-hidden /> Settings
                  </MenuItem>
                  <MenuItem onSelect={signOut}>
                    <LogOut className="size-4 text-ink-subtle" aria-hidden /> Sign out
                  </MenuItem>
                </MenuContent>
              </Menu>
            </span>
          </div>
        </div>
      </header>

    </>
  );
}
