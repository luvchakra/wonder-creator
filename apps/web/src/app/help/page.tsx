import { KIT, KitArt } from "@wonder/ui";
import type { Metadata } from "next";
import { HelpCenter } from "@/components/public/help-center";
import { SiteFooter, SiteHeader } from "@/components/public/site-chrome";
import { HELP_SECTIONS } from "@/lib/help/content";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Help",
  description: "Short guides to what's in Wonder Creator — capturing, creating, publishing, working together, rights and privacy — and what to try when something isn't working.",
};

/**
 * Help (owner, 8 Oct 2026: "update the get help page for each app — match the latest features"). Public, so it opens from
 * the landing footer and, signed in, from the account menu's Get help; the topics are data in `lib/help/content.ts`
 * (docs/help.md). It reads the session only to offer signed-in visitors a way back into the studio in the header.
 */
export const dynamic = "force-dynamic";

async function signedIn(): Promise<boolean> {
  try {
    const db = await createClient();
    const { data } = await db.auth.getClaims();
    return !!data?.claims?.sub;
  } catch {
    return false;
  }
}

export default async function HelpPage() {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-cream text-ink">
      <KitArt art={KIT.texture.texturePaper} priority className="pointer-events-none absolute inset-x-0 top-0 h-[120vh] w-full object-cover opacity-[0.35]" />
      <SiteHeader signedIn={await signedIn()} />
      <main id="main" className="relative z-10 mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        <HelpCenter sections={HELP_SECTIONS} />
      </main>
      <SiteFooter />
    </div>
  );
}
