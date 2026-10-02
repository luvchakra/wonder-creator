export const metadata = { title: "Security" };

/** How Wonder Creator protects accounts and data, and how to report a vulnerability (security.txt points here). */
export default function SecurityPolicyPage() {
  const contact = process.env.WONDERCREATOR_SECURITY_CONTACT?.trim();
  return (
    <article>
      <h1>Security</h1>
      <p>Creators trust us with unfinished work, private material and, increasingly, income. This page describes how we protect it and how to tell us about a problem.</p>

      <h2>How we protect your account</h2>
      <ul>
        <li>Passwords of at least 10 characters with letters and numbers, checked in your browser and again by our servers.</li>
        <li>Optional two-step verification with an authenticator app; once on, nothing in your account works until the code is entered.</li>
        <li>Your password is asked for again before high-impact actions: deleting your account, transferring ownership, activating commercial licences, changing your password and issuing refunds.</li>
        <li>A security history in Settings shows sign-ins, exports and other sensitive actions, and can be downloaded.</li>
      </ul>

      <h2>How we protect your data</h2>
      <ul>
        <li>Row-level security on every table: the database itself refuses to show one creator&rsquo;s private data to another, whatever the app asks.</li>
        <li>Private files are served through short-lived signed links; uploads are checked by content, size-limited and fingerprinted.</li>
        <li>Links you paste are fetched through a guard that refuses private and internal network addresses.</li>
        <li>Text from outside sources is fenced off before any AI sees it, so it can&rsquo;t change instructions or settings.</li>
        <li>Strict browser security headers (content security policy, HSTS, framing protection) and rate limits on every endpoint.</li>
        <li>An append-only audit trail for security, privacy and financial events; financial and privacy entries can only be written by our servers.</li>
        <li>Card and bank details are entered on Stripe or Razorpay&rsquo;s own pages — they never touch our servers.</li>
      </ul>

      <h2>How we build</h2>
      <ul>
        <li>Every change goes through review and automated checks: tests of every database access rule, dependency audits, secret scanning and static security analysis.</li>
        <li>Least-privilege service credentials, never sent to the browser.</li>
      </ul>

      <h2>Reporting a vulnerability</h2>
      <p>
        If you believe you&rsquo;ve found a security problem, please tell us privately{contact ? <> at <a href={/^[^:\s]+@/.test(contact) ? `mailto:${contact}` : contact} className="underline">{contact.replace(/^mailto:/, "")}</a></> : null} before
        sharing it with anyone else. Include what you found, how to reproduce it and what you think the impact is. We&rsquo;ll acknowledge your report, keep you informed and credit you if you&rsquo;d like.
      </p>
      <ul>
        <li>Please don&rsquo;t access, change or delete data that isn&rsquo;t yours, degrade the service, or use social engineering.</li>
        <li>Test only against your own accounts. We won&rsquo;t pursue good-faith research that follows these rules.</li>
      </ul>
      <p className="text-[13px] text-ink-subtle">Machine-readable contact: /.well-known/security.txt</p>
    </article>
  );
}
