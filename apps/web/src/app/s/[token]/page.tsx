import { openShareLink } from "@wonder/creator-studio";
import { EmptyState, Logo } from "@wonder/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { SharedPieceView } from "@/components/shared-piece";
import { createClient } from "@/lib/supabase/server";

// Private links are never indexed, and the token never leaves in a Referer header.
export const metadata: Metadata = { title: "Shared piece", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function SharedLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const piece = await openShareLink(await createClient(), token).catch(() => null);
  return (
    <main id="main" className="min-h-dvh bg-surface px-4 py-8 sm:py-12">
      <header className="mx-auto mb-8 flex max-w-2xl items-center justify-between">
        <Link href="/" aria-label="Wonder Creator home">
          <Logo height={36} />
        </Link>
      </header>
      {piece ? (
        <SharedPieceView piece={piece} downloadBase={`/api/v1/shares/link/${token}/download`} />
      ) : (
        <div className="mx-auto max-w-md">
          <EmptyState title="This link isn't available" body="It may have expired or been turned off by the creator. Ask them for a new link." />
        </div>
      )}
    </main>
  );
}
