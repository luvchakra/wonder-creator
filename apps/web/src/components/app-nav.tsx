"use client";
import { Avatar, ContextStrip, Logo, cn, Menu, MenuContent, MenuItem, MenuTrigger } from "@wonder/ui";
import { Brain, FolderKanban, LogOut, Megaphone, Wallet, NotebookPen, Send, Settings, UserRound } from "lucide-react";
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
                <MenuTrigger className="rounded-full focus-visible:outline-2" aria-label="Your account">
                  <Avatar name={me.name} src={me.avatarUrl} size={40} />
                </MenuTrigger>
                <MenuContent>
                  <div className="px-3 pb-2 pt-1.5">
                    <p className="truncate font-medium text-ink">{me.name}</p>
                    {me.handle ? <p className="text-sm text-ink-subtle">@{me.handle}</p> : null}
                  </div>
                  <MenuItem onSelect={() => router.push("/me")}>
                    <UserRound className="size-4" aria-hidden /> Profile
                  </MenuItem>
                  <MenuItem onSelect={() => router.push("/rooms")}>
                    <FolderKanban className="size-4" aria-hidden /> Creative Rooms
                  </MenuItem>
                  <MenuItem onSelect={() => router.push("/campaigns")}>
                  <Megaphone className="size-4" aria-hidden /> Campaigns
                </MenuItem>
                <MenuItem onSelect={() => router.push("/business")}>
                  <Wallet className="size-4" aria-hidden /> Business
                </MenuItem>
                <MenuItem onSelect={() => router.push("/publishing")}>
                    <Send className="size-4" aria-hidden /> Publishing
                  </MenuItem>
                  <MenuItem onSelect={() => router.push("/scrapbook")}>
                    <NotebookPen className="size-4" aria-hidden /> Scrapbook
                  </MenuItem>
                  <MenuItem onSelect={() => router.push("/memory")}>
                    <Brain className="size-4" aria-hidden /> Creative Memory
                  </MenuItem>
                  <MenuItem onSelect={() => router.push("/settings")}>
                    <Settings className="size-4" aria-hidden /> Settings
                  </MenuItem>
                  <MenuItem onSelect={signOut}>
                    <LogOut className="size-4" aria-hidden /> Sign out
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
