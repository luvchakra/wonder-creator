"use client";
import { Avatar, Logo, Menu, MenuContent, MenuItem, MenuTrigger, cn } from "@wonder/ui";
import { Brain, Home, LogOut, PenLine, Search, Settings, Sparkles, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { SearchDialog } from "./search-dialog";

const NAV = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/create", label: "Create", icon: PenLine, match: (p: string) => p.startsWith("/create") || p.startsWith("/send") || p.startsWith("/artifacts") },
  { href: "/space", label: "Space", icon: Sparkles, match: (p: string) => p.startsWith("/space") },
  { href: "/huddles", label: "Huddles", icon: Users, match: (p: string) => p.startsWith("/huddles") },
  { href: "/profile", label: "Profile", icon: UserRound, match: (p: string) => p.startsWith("/profile") || p.startsWith("/creators") || p.startsWith("/settings") || p.startsWith("/memory") },
];

export function AppNav({ me }: { me: { name: string; handle: string | null; avatarUrl: string | null } }) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);

  async function signOut() {
    await fetch("/auth/sign-out", { method: "POST" });
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border-soft/70 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex h-[var(--nav-height)] max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="shrink-0 rounded-xl bg-white px-1.5 py-1 focus-visible:outline-2" aria-label="Wonder Creator home">
            <Logo height={40} className="hidden sm:block" />
            <Logo variant="mark" height={32} className="sm:hidden" />
          </Link>
          <nav aria-label="Primary" className="ml-2 hidden items-center gap-1 md:flex">
            {NAV.map((n) => {
              const active = n.match(pathname);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("inline-flex h-10 items-center gap-2 rounded-full px-4 text-[15px] transition-colors", active ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-muted hover:bg-black/[0.04]")}
                >
                  <n.icon className="size-4" aria-hidden />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm text-ink-subtle hover:border-[#cfd0ff] sm:min-w-56 sm:px-4"
              aria-label="Search your creativity"
            >
              <Search className="size-4" aria-hidden />
              <span className="hidden sm:inline">Search your creativity…</span>
            </button>
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

      {/* Mobile: a few human concepts, not a module list. */}
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-border-soft bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="mx-auto grid h-[var(--bottom-nav-height)] max-w-lg grid-cols-5">
          {NAV.map((n) => {
            const active = n.match(pathname);
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={active ? "page" : undefined} className={cn("flex h-full flex-col items-center justify-center gap-0.5 text-[11px]", active ? "font-medium text-accent-ink" : "text-ink-subtle")}>
                  <n.icon className={cn("size-5", active && "fill-accent-soft")} aria-hidden />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
