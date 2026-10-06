"use client";
import { LogoBloom } from "@wonder/ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Sends a Creation opened at the Studio to its format's own page, keeping the #hash a server redirect would drop. */
export function ForwardTo({ href }: { href: string }) {
  const router = useRouter();
  // This page only forwards; leaving it at once keeps it out of the Back trail (back-navigation.md).
  useEffect(() => {
    router.replace(`${href}${window.location.hash}`);
  }, [href, router]);
  // The same quiet mark as every page on its way (loading.tsx), never "Opening…" (owner, 6 Oct 2026).
  return (
    <div className="flex min-h-[55dvh] items-center justify-center">
      <LogoBloom size={72} label="Opening" />
    </div>
  );
}
