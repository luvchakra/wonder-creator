import { KIT, KitArt } from "@wonder/ui";
import type { Metadata } from "next";
import { HelpCenter } from "@/components/public/help-center";
import { SiteFooter, SiteHeader } from "@/components/public/site-chrome";
import { HELP_SECTIONS } from "@/lib/help/content";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Help",
  description: "Short guides to what's in Wonder Creator — capturing, creating, publishing, working together, rights and privacy — and what to try when something isn't working.",
  // Behind sign-in: never indexed, never shown in search results.
  robots: { index: false, follow: false },
};

/**
 * Help (docs/help.md). Signed-in only (owner, 16 Oct 2026): the session is checked here on the server, the same way every
 * studio page checks it, before any help text is rendered; signed out, it's sign-in and then back here. The words are
 * server-only data (`lib/help/content.ts`) handed to the page, so they never sit in a public JavaScript file. What stays
 * public — signing in, signing up, password reset, Contact, the legal pages — lives at /account-help and on those pages.
 * Opened from the account menu's Get help.
 */
export const dynamic = "force-dynamic";

export default async function HelpPage() {
  // Creators part-way through onboarding may read help too; the notice must still be agreed first.
  await requireSession({ allowOnboarding: true, returnTo: "/help" });
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-cream text-ink">
      <KitArt art={KIT.texture.texturePaper} priority className="pointer-events-none absolute inset-x-0 top-0 h-[120vh] w-full object-cover opacity-[0.35]" />
      <SiteHeader signedIn />
      <main id="main" className="relative z-10 mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        <HelpCenter sections={HELP_SECTIONS} />
      </main>
      <SiteFooter signedIn />
    </div>
  );
}
