import { BACKGROUNDS, BrandBackground, buttonClasses, KIT, KitArt, KitLayersIcon, KitSparklesIcon, KitUsersIcon, Logo, Tagline, cn } from "@wonder/ui";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "Wonder Creator — Ideas Become Real." },
  description:
    "A calm studio to think, create and bring creative ideas to life. Get paid through Stripe and Razorpay, keep control of your data under GDPR and India's DPDP Act, with SOX-style financial controls and security by default.",
};

const MAKE = [
  { icon: KitLayersIcon, title: "Bring everything in", body: "Notes, voice, photos, documents and links become your Materials — private unless you share them." },
  { icon: KitSparklesIcon, title: "Shape it in your Studio", body: "Write, design and build carousels with CreativeMind beside you, only on what you choose." },
  { icon: KitUsersIcon, title: "Create together", body: "Live Huddles, Creative Rooms and a community that asks for feedback, not likes." },
] as const;

/**
 * The four commitments the owner asked the landing page to lead with (2 Oct 2026). Every line describes something the
 * product does today (docs/compliance/*); none claims a certification.
 */
const TRUST = [
  {
    id: "payments",
    eyebrow: "Payments",
    title: "Get paid through Stripe & Razorpay",
    wash: KIT.wash.washPeach,
    art: KIT.painted.blossomSprig,
    points: [
      "UPI, Indian cards and netbanking through Razorpay; cards and wallets worldwide through Stripe.",
      "Your licensee pays on the provider's own secure page — card details never touch our servers.",
      "Licence fees settle in your Business ledger the moment the provider confirms them.",
      "Refunds when you need them, with your password asked again.",
    ],
    link: { href: "/legal/terms", label: "Licences, payments and refunds" },
  },
  {
    id: "privacy",
    eyebrow: "Privacy",
    title: "Your data, your rights — GDPR & DPDP",
    wash: KIT.wash.washLavender,
    art: KIT.painted.lavenderSprig,
    points: [
      "Clear consent for every optional use, off until you turn it on — and you can change your mind any time.",
      "Download everything we hold about you in one file; erase a piece or your whole account.",
      "Ask us anything about your data and get an answer within 30 days, with a Grievance Officer to escalate to.",
      "No selling data, no ads, and your work never trains AI models.",
    ],
    link: { href: "/legal/privacy", label: "Read the Privacy notice" },
  },
  {
    id: "controls",
    eyebrow: "Financial controls",
    title: "Books that add up — SOX-style controls",
    wash: KIT.wash.washMint,
    art: KIT.painted.leafSprigSage,
    points: [
      "A double-entry ledger that can't be edited or deleted — not even by us.",
      "Every payment is confirmed by the provider's signed message and applied exactly once, with amounts checked.",
      "Payments, refunds and records are reconciled every day; anything unusual is flagged for review.",
      "An append-only audit trail, and a statement your accountant can open in a spreadsheet.",
    ],
    link: { href: "/legal/security", label: "How we keep records" },
  },
  {
    id: "security",
    eyebrow: "Security",
    title: "Security by default",
    wash: KIT.wash.washLilacSky,
    art: KIT.painted.flowerBranch,
    points: [
      "Two-step verification, strong passwords, and your password asked again before anything high-impact.",
      "Access rules enforced by the database itself on every table, so one creator can never see another's private work.",
      "Encrypted connections, strict browser security headers and rate limits on every endpoint.",
      "Code scanning, secret scanning and dependency audits on every change — and a responsible-disclosure policy.",
    ],
    link: { href: "/legal/security", label: "Our security practices" },
  },
] as const;

/** Public landing page — what signed-out visitors see at `/` (the proxy rewrites to it). An expressive surface. */
export default function WelcomePage() {
  return (
    <div className="min-h-dvh bg-cream text-ink">
      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" aria-label="Wonder Creator home">
            <Logo height={36} />
          </Link>
          <nav aria-label="Account" className="flex items-center gap-1">
            <Link href="/sign-in" className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-ink hover:underline">
              Sign in
            </Link>
            <Link href="/sign-up" className={buttonClasses({ size: "sm" })}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main id="main">
        {/* Hero: the painted arches over the sea, as on the sign-in board. */}
        <BrandBackground src={BACKGROUNDS.archesSea} overlay="cream" position="70% center" className="min-h-[min(88dvh,760px)]">
          <div className="mx-auto flex min-h-[min(88dvh,760px)] max-w-6xl flex-col justify-end px-4 pb-14 pt-28 sm:px-6 sm:pb-20">
            <Tagline className="max-w-2xl text-[44px] leading-[1.05] sm:text-[60px]" />
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-muted sm:text-lg">
              A calm studio to think, create and bring your creative ideas to life — and to be paid for them, with your data and your books in good hands.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/sign-up" className={buttonClasses({ size: "lg" })}>
                Create your studio
              </Link>
              <Link href="#trust" className={buttonClasses({ variant: "secondary", size: "lg" })}>
                How we protect you
              </Link>
            </div>
            <ul aria-label="Highlights" className="mt-8 flex flex-wrap gap-2 text-[13px]">
              {TRUST.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="inline-flex min-h-11 items-center rounded-full border border-white/70 bg-white/70 px-3.5 text-ink shadow-[var(--shadow-card)] backdrop-blur hover:bg-white">
                    {t.id === "payments" ? "Stripe & Razorpay" : t.id === "privacy" ? "GDPR & DPDP" : t.id === "controls" ? "SOX-style controls" : "Security by default"}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </BrandBackground>

        <section aria-labelledby="make" className="relative isolate overflow-hidden">
          <KitArt art={KIT.botanical.botanicalSprig3} sizes="12rem" className="pointer-events-none absolute -right-10 -top-4 -z-10 hidden h-auto w-52 opacity-60 sm:block" />
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 id="make" className="max-w-xl font-display text-[30px] leading-tight sm:text-[40px]">
              Everything you make, in one quiet place
            </h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-3">
              {MAKE.map(({ icon: Icon, title, body }) => (
                <li key={title}>
                  <Icon className="size-9" aria-hidden />
                  <h3 className="mt-3 font-display text-[21px]">{title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="trust" aria-labelledby="trust-title" className="relative isolate overflow-hidden bg-[image:var(--gradient-card)]">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-accent-ink">Built on trust</p>
            <h2 id="trust-title" className="mt-2 max-w-2xl font-display text-[30px] leading-tight sm:text-[40px]">
              For creators who mean business
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
              Your work, your income and your personal data deserve the same care as your ideas. Here is what that means in practice.
            </p>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {TRUST.map((t) => (
                <article key={t.id} id={t.id} aria-labelledby={`${t.id}-title`} className="relative isolate scroll-mt-6 overflow-hidden rounded-3xl border border-white/80 bg-white/75 p-6 shadow-[var(--shadow-card)] sm:p-7">
                  <KitArt art={t.wash} sizes="24rem" className="pointer-events-none absolute -right-16 -top-20 -z-10 h-auto w-80 opacity-70" />
                  <KitArt art={t.art} sizes="8rem" className="pointer-events-none absolute -right-3 -top-3 -z-10 h-auto w-24 opacity-90 sm:w-28" />
                  <p className="text-[12.5px] font-medium uppercase tracking-[0.12em] text-accent-ink">{t.eyebrow}</p>
                  <h3 id={`${t.id}-title`} className="mt-1.5 max-w-[16em] font-display text-[24px] leading-snug sm:text-[26px]">
                    {t.title}
                  </h3>
                  <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-ink">
                    {t.points.map((p) => (
                      <li key={p} className="flex gap-2.5">
                        <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-accent" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={t.link.href} className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-accent-ink underline-offset-4 hover:underline">
                    {t.link.label} ›
                  </Link>
                </article>
              ))}
            </div>
            <p className="mt-8 max-w-3xl text-[12.5px] leading-relaxed text-ink-subtle">
              Wonder Creator is designed to support the EU/UK GDPR, India&rsquo;s Digital Personal Data Protection Act 2023 and SOX-style financial controls. Compliance also depends on how each person and
              organisation uses a service, so we describe what we do rather than claim a certification. Payments are processed by Stripe and Razorpay under their own terms.
            </p>
          </div>
        </section>

        <BrandBackground src={BACKGROUNDS.pastelClouds} overlay="soft" className="text-center">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
            <Tagline className="text-[36px] leading-tight sm:text-[48px]" />
            <p className="mx-auto mt-3 max-w-md text-[15px] text-ink-muted">Start with a note, a voice memo or a photo. The rest grows from there.</p>
            <Link href="/sign-up" className={cn(buttonClasses({ size: "lg" }), "mt-6")}>
              Create your studio
            </Link>
          </div>
        </BrandBackground>
      </main>

      <footer className="border-t border-border-soft bg-cream">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-[13px] text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo height={26} />
          <nav aria-label="Legal" className="-mx-1 flex flex-wrap gap-x-4">
            {[
              ["/legal/privacy", "Privacy"],
              ["/legal/terms", "Terms"],
              ["/legal/subprocessors", "Subprocessors"],
              ["/legal/security", "Security"],
            ].map(([href, label]) => (
              <Link key={href} href={href!} className="inline-flex min-h-11 items-center px-1 hover:underline">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
