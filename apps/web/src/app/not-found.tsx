import { BACKGROUNDS, BrandBackground, buttonClasses } from "@wonder/ui";
import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-6">
      <BrandBackground src={BACKGROUNDS.mistyMountains} overlay="soft" className="w-full max-w-xl rounded-3xl border border-border-soft">
        <div className="p-10 text-center">
          <h1 className="font-display text-4xl text-ink">We couldn&apos;t find that</h1>
          <p className="mt-2 text-ink-muted">It may have been moved, made private, or it never existed.</p>
          <Link href="/" className={buttonClasses({ className: "mt-6" })}>
            Back to your studio
          </Link>
        </div>
      </BrandBackground>
    </main>
  );
}
