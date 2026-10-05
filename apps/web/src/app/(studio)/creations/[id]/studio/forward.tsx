"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Sends a Creation opened at the Studio to its format's own page, keeping the #hash a server redirect would drop. */
export function ForwardTo({ href }: { href: string }) {
  const router = useRouter();
  // This page only forwards; leaving it at once keeps it out of the Back trail (back-navigation.md).
  useEffect(() => {
    router.replace(`${href}${window.location.hash}`);
  }, [href, router]);
  return (
    <p role="status" className="px-4 py-8 text-center text-[13px] text-ink-subtle">
      Opening…
    </p>
  );
}
