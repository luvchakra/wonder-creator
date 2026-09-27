import { openShareLink } from "@wonder/creator-studio";
import type { Metadata } from "next";
import { SharedPieceView } from "@/components/shared-piece";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Shared Creation", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Embeddable view of a private link, only when the creator allowed embedding. */
export default async function EmbedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const piece = await openShareLink(await createClient(), token).catch(() => null);
  return (
    <main id="main" className="min-h-dvh bg-surface">
      {piece?.allowEmbed ? (
        <SharedPieceView piece={piece} downloadBase={null} compact />
      ) : (
        <p className="p-5 text-[15px] text-ink-muted">This Creation isn&apos;t available to embed.</p>
      )}
    </main>
  );
}
