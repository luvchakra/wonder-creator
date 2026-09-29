"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const KEY = "wc.nav.recent";

/**
 * Remembers the last few in-app pages for this tab (sessionStorage), so a Back that can't simply mean "the page before"
 * — a Carousel's Creation page opens its Studio, and the Slide Editor returns to it — can go to where the creator
 * actually came from instead of looping.
 */
export function NavMemory() {
  // The path drives it; the query is read as it is at that moment. (No useSearchParams: it would need a Suspense
  // boundary around the whole app shell, which splits every page's streaming.)
  const pathname = usePathname();
  useEffect(() => {
    try {
      const search = window.location.search;
      const here = `${pathname}${search}`;
      const list = (JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as string[]).filter((x) => x !== here);
      sessionStorage.setItem(KEY, JSON.stringify([...list, here].slice(-20)));
    } catch {
      /* private mode: Back falls back to its default */
    }
  }, [pathname]);
  return null;
}

/** The most recent page outside `prefix` (e.g. everything of one Creation), or null. */
export function lastPageOutside(prefix: string): string | null {
  try {
    const list = JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as string[];
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]!;
      if (p !== prefix && !p.startsWith(`${prefix}/`) && !p.startsWith(`${prefix}?`)) return p;
    }
  } catch {
    /* fall through */
  }
  return null;
}
