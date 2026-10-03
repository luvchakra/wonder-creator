import { KIT, KitArt } from "@wonder/ui";
import { Flag, LifeBuoy, Mail, ShieldCheck, UserRoundCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader, contactLink } from "@/components/public/site-chrome";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach Wonder Creator: questions and feedback, your data and privacy, and security reports.",
};

/**
 * Contact (owner, 3 Oct 2026). Shows only channels that exist: inboxes configured for this deployment
 * (WONDERCREATOR_CONTACT_EMAIL, _PRIVACY_CONTACT, _SECURITY_CONTACT, _GRIEVANCE_OFFICER) and the routes every account
 * already has inside the product. Nothing is made up when an inbox isn't set.
 */
export const dynamic = "force-dynamic";

function Channel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4 rounded-[1.4rem] border border-white/80 bg-white/75 p-5 shadow-[0_24px_50px_-36px_rgb(76_60_120/0.45)] backdrop-blur-sm">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-[21px] leading-snug text-ink">{title}</h2>
        <div className="mt-1 space-y-1.5 text-[15px] leading-relaxed text-ink-muted">{children}</div>
      </div>
    </li>
  );
}

function Address({ to }: { to: { href: string; label: string } }) {
  return (
    <a href={to.href} className="break-all font-medium text-accent-ink underline-offset-4 hover:underline">
      {to.label}
    </a>
  );
}

export default function ContactPage() {
  const general = contactLink(process.env.WONDERCREATOR_CONTACT_EMAIL);
  const privacy = contactLink(process.env.WONDERCREATOR_PRIVACY_CONTACT);
  const security = contactLink(process.env.WONDERCREATOR_SECURITY_CONTACT);
  const grievance = process.env.WONDERCREATOR_GRIEVANCE_OFFICER?.trim();

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-cream text-ink">
      <KitArt art={KIT.texture.texturePaper} priority className="pointer-events-none absolute inset-x-0 top-0 h-[120vh] w-full object-cover opacity-[0.35]" />
      <SiteHeader />
      <main id="main" className="relative z-10 mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        <KitArt art={KIT.wash.washPeach} priority className="pointer-events-none absolute -right-28 -top-6 -z-10 w-[26rem] max-w-none opacity-60" />
        <KitArt art={KIT.painted.blossomSprig} sizes="10rem" className="pointer-events-none absolute -right-24 -top-2 -z-10 hidden w-24 opacity-90 lg:block" />
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent-ink">Contact</p>
        <h1 className="mt-4 font-display text-[42px] leading-[1.04] tracking-[-0.02em] [text-wrap:balance] sm:text-[56px]">
          We&rsquo;d love to <em className="text-brand-gradient pr-1 italic">hear</em> from you.
        </h1>
        <p className="mt-4 max-w-[34rem] text-[17px] leading-relaxed text-ink-muted">Questions, ideas, something that didn&rsquo;t work as it should — here&rsquo;s where to reach us.</p>

        <ul className="mt-10 space-y-4">
          {general ? (
            <Channel icon={<Mail className="size-5" />} title="Questions and feedback">
              <p>
                Write to <Address to={general} />.
              </p>
            </Channel>
          ) : null}
          <Channel icon={<LifeBuoy className="size-5" />} title="Your data and privacy">
            <p>
              Signed in, the quickest way is{" "}
              <Link href="/settings?section=privacy" className="font-medium text-accent-ink underline-offset-4 hover:underline">
                Settings › Privacy &amp; Security › Make a privacy request
              </Link>
              : access, correction, erasure and more, each answered within 30 days.
            </p>
            {privacy ? (
              <p>
                You can also write to <Address to={privacy} />.
              </p>
            ) : null}
            {grievance ? <p>Grievance Officer: {grievance}.</p> : null}
            <p>
              The{" "}
              <Link href="/legal/privacy" className="font-medium text-accent-ink underline-offset-4 hover:underline">
                Privacy notice
              </Link>{" "}
              explains what we keep, why, and for how long.
            </p>
          </Channel>
          <Channel icon={<ShieldCheck className="size-5" />} title="Security reports">
            <p>
              Found a vulnerability? Please tell us privately{security ? (
                <>
                  {" "}
                  at <Address to={security} />
                </>
              ) : null}{" "}
              before sharing it anywhere else. How we handle reports is on our{" "}
              <Link href="/legal/security" className="font-medium text-accent-ink underline-offset-4 hover:underline">
                Security
              </Link>{" "}
              page.
            </p>
          </Channel>
          <Channel icon={<Flag className="size-5" />} title="Something wrong on Wonder Creator">
            <p>Report a post, a reply or a conversation from its More menu. You can mute or block someone from their profile or a conversation, and they won&rsquo;t reach you again.</p>
          </Channel>
          {!general ? (
            <Channel icon={<UserRoundCheck className="size-5" />} title="Already creating?">
              <p>
                Sign in to make a privacy request or report something — both reach us directly.{" "}
                <Link href="/sign-in" className="font-medium text-accent-ink underline-offset-4 hover:underline">
                  Sign in
                </Link>
              </p>
            </Channel>
          ) : null}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
