"use client";
import { Avatar, ContextStrip, Logo, Menu, MenuContent, MenuItem, MenuTrigger } from "@wonder/ui";
import { Brain, FolderKanban, LogOut, MessageCircle, NotebookPen, Search, Send, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useContextStrip } from "./creative-palette";
import { NotificationsButton } from "./notifications";
import { SearchDialog } from "./search-dialog";

/**
 * The top bar (UI redesign §6): logo, the Context Strip, search, notifications and your account — nothing else. There is no module tab
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
        <div className="mx-auto flex h-[var(--nav-height)] max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
          <Link href="/" className="inline-flex min-h-11 shrink-0 items-center rounded-xl focus-visible:outline-2 focus-visible:outline-accent" aria-label="Wonder Creator home">
            <Logo height={46} className="hidden sm:block" />
            <Logo variant="mark" height={40} className="sm:hidden" />
          </Link>
          {/* The Context Strip (docs/ui-redesign/context-strip.md): what's happening here, in one quiet line. */}
          <ContextStrip primary={strip.primary} secondary={strip.secondary} LinkComponent={Link} />
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm text-ink-subtle hover:border-[#cfd0ff] sm:min-w-56 sm:px-4"
              aria-label="Search your creativity"
            >
              <Search className="size-4" aria-hidden />
              <span className="hidden sm:inline">Search your creativity…</span>
            </button>
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
                <MenuItem onSelect={() => router.push("/profile")}>
                  <UserRound className="size-4" aria-hidden /> Profile
                </MenuItem>
                <MenuItem onSelect={() => router.push("/projects")}>
                  <FolderKanban className="size-4" aria-hidden /> Creative Rooms
                </MenuItem>
                <MenuItem onSelect={() => router.push("/publishing")}>
                  <Send className="size-4" aria-hidden /> Publishing
                </MenuItem>
                <MenuItem onSelect={() => router.push("/messages")}>
                  <MessageCircle className="size-4" aria-hidden /> Messages
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
          </div>
        </div>
      </header>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
