import { NOTICE_VERSION } from "@wonder/creator-identity/privacy-options";
import Link from "next/link";

export const metadata = { title: "Terms of Service" };

/** Terms of Service — plain language. Reviewed by counsel before launch (docs/compliance/privacy.md). */
export default function TermsPage() {
  return (
    <article>
      <h1>Terms of Service</h1>
      <p className="text-[13px] text-ink-muted">Version {NOTICE_VERSION}</p>

      <h2>Your account</h2>
      <ul>
        <li>You must be 18 or older and give accurate details. Keep your password private; turn on two-step verification if you can.</li>
        <li>You&rsquo;re responsible for what happens under your account. Tell us promptly if you think someone else has used it.</li>
      </ul>

      <h2>Your work stays yours</h2>
      <ul>
        <li>You keep every right in what you create and bring in. You give us only the permission needed to store, process and show it as you direct — for example, to people you share it with or publish to.</li>
        <li>We never use your material to train AI models, and never sell it.</li>
        <li>Only bring in material you have the right to use. Rights you record are your statements; Wonder Creator doesn&rsquo;t verify or grant rights on anyone&rsquo;s behalf.</li>
      </ul>

      <h2>CreativeMind (AI)</h2>
      <p>AI suggestions can be wrong. You decide what to use. Rights, commercial and destructive actions always need your explicit approval.</p>

      <h2>Licences, payments and refunds</h2>
      <ul>
        <li>When you license your work through Wonder Creator, the licence terms you set are between you and the licensee. Payments are processed by Stripe or Razorpay under their terms; we never see card or bank details.</li>
        <li>Amounts, currencies and fees are shown before you pay. Refunds are issued by the creator who was paid, to the original payment method, and are recorded with the original payment.</li>
        <li>You&rsquo;re responsible for taxes on income you receive; we keep the records you need.</li>
      </ul>

      <h2>Acceptable use</h2>
      <ul>
        <li>No unlawful, infringing, hateful, harassing or sexual content involving minors; no impersonation, spam or malware; no attempts to break security or access other people&rsquo;s data.</li>
        <li>We may remove content or suspend accounts that break these rules, and tell you why unless the law prevents it.</li>
      </ul>

      <h2>Ending</h2>
      <p>You can delete your account at any time from Settings; export your data first if you want a copy. We may end the service with reasonable notice and a chance to export.</p>

      <h2>Liability</h2>
      <p>We provide Wonder Creator with care but can&rsquo;t promise it will always be available or error-free. Nothing in these terms limits rights you have under consumer law that can&rsquo;t be limited.</p>

      <h2>Privacy</h2>
      <p>
        How we handle personal data is in the <Link href="/legal/privacy" className="underline">Privacy notice</Link>. If these terms change materially we&rsquo;ll ask you to agree again before you continue.
      </p>
    </article>
  );
}
