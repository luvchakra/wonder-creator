import { NOTICE_VERSION } from "@wonder/creator-identity/privacy-options";
import Link from "next/link";
import { contactLink } from "@/components/public/site-chrome";

export const metadata = { title: "Privacy notice" };

/**
 * Privacy notice (GDPR Arts. 13–14; India DPDP Act 2023 §5). Plain language first. Material changes bump
 * NOTICE_VERSION, which asks every creator to agree again. Wording is reviewed by counsel (docs/compliance/privacy.md).
 */
export default function PrivacyNoticePage() {
  const privacy = contactLink(process.env.WONDERCREATOR_PRIVACY_CONTACT);
  const grievance = process.env.WONDERCREATOR_GRIEVANCE_OFFICER?.trim();
  return (
    <article>
      <h1>Privacy notice</h1>
      <p className="text-[13px] text-ink-muted">Version {NOTICE_VERSION}</p>
      <p>
        Wonder Creator is a place to make things. What you make, and what you bring in to make it, belongs to you. This notice explains what personal data we process, why, for how long, who helps us, and
        the rights you have under the EU/UK General Data Protection Regulation (GDPR) and India&rsquo;s Digital Personal Data Protection Act, 2023 (DPDP).
      </p>

      <h2>Who we are</h2>
      <p>
        Wonder Creator is the controller (GDPR) and Data Fiduciary (DPDP) for the personal data described here.
        {privacy ? <> Write to us about privacy at <a href={privacy.href} className="underline">{privacy.label}</a>.</> : " You can reach us about privacy from Settings › Privacy & Security › Make a privacy request."}
      </p>

      <h2>What we process and why</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Purpose</th>
              <th scope="col">Legal basis</th>
            </tr>
          </thead>
          <tbody className="text-[14px]">
            <tr><td>Email, password (hashed), name, handle — or, if you continue with Google, the name and email address your Google account shares</td><td>Your account and signing in</td><td>Contract (GDPR 6(1)(b)); consent / legitimate use (DPDP §§6–7)</td></tr>
            <tr><td>Profile, Materials, Creations, notes, voice, uploads</td><td>Providing the studio you asked for</td><td>Contract; your consent</td></tr>
            <tr><td>Material you ask CreativeMind to work on</td><td>AI assistance, only when you use it</td><td>Contract; your consent</td></tr>
            <tr><td>Huddle audio/video, messages</td><td>Live sessions — dissolved when everyone leaves; only what you choose to keep is stored</td><td>Contract</td></tr>
            <tr><td>Payment records (amount, status, provider reference)</td><td>Licences, payouts, refunds, tax and accounting</td><td>Contract; legal obligation (GDPR 6(1)(c); DPDP §7(c))</td></tr>
            <tr><td>Sign-in history, IP address, device, audit trail</td><td>Security, fraud prevention, accountability</td><td>Legitimate interests (GDPR 6(1)(f)); DPDP §7(i)</td></tr>
            <tr><td>Usage measures (counts and timings, never content)</td><td>Improving the product — only if you turn it on</td><td>Consent (GDPR 6(1)(a); DPDP §6)</td></tr>
            <tr><td>Product emails</td><td>News about features — only if you turn it on</td><td>Consent</td></tr>
          </tbody>
        </table>
      </div>
      <p>We don&rsquo;t sell personal data, don&rsquo;t show third-party advertising, don&rsquo;t track you across other sites, and never use your material to train AI models.</p>

      <h2>Children</h2>
      <p>Wonder Creator is for people aged 18 and over. We ask you to confirm your age when you join and don&rsquo;t knowingly process children&rsquo;s data; if we learn an account belongs to a child, we close it and erase its data.</p>

      <h2>Who helps us</h2>
      <p>
        A small set of providers process data for us under contract — hosting, database, AI, live media and payments. They&rsquo;re listed, with what they receive and where, on our{" "}
        <Link href="/legal/subprocessors" className="underline">subprocessors page</Link>. Card and bank details are entered on Stripe&rsquo;s or Razorpay&rsquo;s own pages and never reach our servers.
        Links you paste (for example YouTube) are fetched to show a preview; mood music streams from its licensed source.
      </p>

      <h2>International transfers</h2>
      <p>Our app is hosted in India (Mumbai). Some providers process data in other countries. For data from the EU/UK we rely on adequacy decisions or Standard Contractual Clauses; under the DPDP Act we transfer only to countries the Government hasn&rsquo;t restricted.</p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Your account and work: until you delete them or your account. Deleting your account erases it immediately; backups roll off within 30 days.</li>
        <li>Expired share links, deleted replies, finished background jobs: purged 30 days after they stop being needed. Capture receipts: 90 days. AI proposals you didn&rsquo;t act on: 90 days.</li>
        <li>Payment and accounting records: as long as tax and company law require (typically 8 years in India, up to 10 in the EU), then deleted.</li>
        <li>Security and audit records: kept as evidence of what happened and can&rsquo;t be edited; once your account is deleted they no longer link to your name, email or profile.</li>
        <li>Privacy requests: kept for 3 years after they&rsquo;re closed, as proof they were handled.</li>
      </ul>

      <h2>Your rights</h2>
      <ul>
        <li><strong>Access and portability</strong> — download everything we hold about you in one file: Settings › Privacy &amp; Security › Export my data.</li>
        <li><strong>Correction</strong> — edit your profile directly, or ask us to correct anything else.</li>
        <li><strong>Erasure</strong> — delete individual work at any time, or your whole account from Settings.</li>
        <li><strong>Withdraw consent</strong> — turn usage measures or emails off in Settings, as easily as you turned them on. Withdrawal doesn&rsquo;t affect what happened before it.</li>
        <li><strong>Object or restrict</strong> — to processing based on legitimate interests.</li>
        <li><strong>Nominate</strong> someone to exercise your rights if you die or become unable to (DPDP §14).</li>
        <li><strong>Grievance redressal</strong> — raise a complaint with us first; we answer within 30 days.</li>
      </ul>
      <p>Make any request from Settings › Privacy &amp; Security › Make a privacy request. We track each one and answer within one month (GDPR) / the period DPDP Rules prescribe, whichever is shorter. We don&rsquo;t make decisions about you based solely on automated processing that have legal or similarly significant effects.</p>

      <h2>Grievance Officer and complaints</h2>
      <p>
        {grievance ? <>Our Grievance Officer: {grievance}. </> : "Our Grievance Officer can be reached through a privacy request in Settings. "}
        If you&rsquo;re not satisfied with our answer, you may complain to the Data Protection Board of India, or, in the EU/UK, to your local data-protection authority.
      </p>

      <h2>Security and breaches</h2>
      <p>
        We protect data with encryption in transit, database-level access rules, two-step verification, audit trails and the other measures on our <Link href="/legal/security" className="underline">security page</Link>. If a breach
        affects your data, we&rsquo;ll tell you and the relevant authorities without undue delay — within 72 hours for supervisory authorities where GDPR applies, and as the DPDP Rules require for the Data Protection Board.
      </p>

      <h2>Cookies</h2>
      <p>We use only the cookies needed to keep you signed in securely. There are no advertising or cross-site tracking cookies, so there&rsquo;s no cookie banner.</p>

      <h2>Changes</h2>
      <p>When this notice changes materially we update the version above and ask you to read and agree again before you continue.</p>
    </article>
  );
}
