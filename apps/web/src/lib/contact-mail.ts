import "server-only";
import nodemailer from "nodemailer";

/**
 * Tells the team when someone sends a message from /contact (owner, 8 Oct 2026: "implement similar to WonderJobs").
 * The message is already saved before this runs; this only mails it on, through the operator's own mailbox over SMTP —
 * the same one WonderJobs uses (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, e.g. GoDaddy's
 * smtpout.secureserver.net with connect@wonderapps.biz). It goes to `CONTACT_NOTIFY_EMAILS` (comma-separated) or, when
 * that isn't set, to the inbox shown on the Contact page (`WONDERCREATOR_CONTACT_EMAIL`). Without SMTP settings it says
 * so in the server log instead of pretending to deliver. Never throws: a mail failure never fails the sender's message.
 */

/** The environment variables read here (process.env in the app; a plain object in tests). */
type Env = Record<string, string | undefined>;

export interface ContactMessage {
  name: string;
  email: string;
  topic: string;
  message: string;
  page?: string | null;
}

/** Splits, trims, dedupes and validates a comma-separated address list. A `mailto:` prefix is fine; anything else invalid is dropped. */
export function parseEmailList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const addr = part.trim().replace(/^mailto:/i, "").toLowerCase();
    if (addr && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) seen.add(addr);
  }
  return [...seen];
}

/** Who is told: `CONTACT_NOTIFY_EMAILS`, else the Contact page's own inbox. */
export function contactRecipients(env: Env = process.env): string[] {
  const listed = parseEmailList(env.CONTACT_NOTIFY_EMAILS);
  return listed.length ? listed : parseEmailList(env.WONDERCREATOR_CONTACT_EMAIL);
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  /** The From header: the mailbox itself, named Wonder Creator, unless `CONTACT_FROM_EMAIL` says otherwise. */
  from: string;
}

/** SMTP settings from the environment, or null when any required one is missing. */
export function smtpConfig(env: Env = process.env): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(env.SMTP_PORT?.trim() || 465);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;
  // Mailbox providers such as GoDaddy only send as the signed-in mailbox, so that is the default sender.
  return { host, port, user, pass, from: env.CONTACT_FROM_EMAIL?.trim() || `Wonder Creator <${user}>` };
}

export interface MailResult {
  attempted: boolean;
  sent: boolean;
  recipients: string[];
  reason?: string;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1"]);
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

export async function mailContactMessage(m: ContactMessage, env: Env = process.env): Promise<MailResult> {
  const recipients = contactRecipients(env);
  if (!recipients.length) return { attempted: false, sent: false, recipients: [], reason: "no inbox configured" };

  const smtp = smtpConfig(env);
  if (!smtp) {
    // No mailbox connected: say so honestly. The sender's name, address and words stay out of the logs.
    console.info("[contact] not emailed (SMTP_HOST, SMTP_USER and SMTP_PASS not all set)", { recipients: recipients.length, topic: m.topic });
    return { attempted: true, sent: false, recipients, reason: "no mailbox connected" };
  }

  const secure = smtp.port === 465;
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure,
    // Never send the mailbox password in the clear: anything other than implicit TLS must upgrade with STARTTLS.
    // Only a loopback server (local testing) may skip it.
    requireTLS: !secure && !LOOPBACK.has(smtp.host),
    ignoreTLS: !secure && LOOPBACK.has(smtp.host),
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 10_000,
  });
  try {
    await transport.sendMail({
      from: smtp.from,
      to: recipients,
      replyTo: m.email,
      // One line each: a name or address can't add headers.
      subject: `[Wonder Creator contact] ${oneLine(m.topic)} — ${oneLine(m.name)}`.slice(0, 200),
      text: `${oneLine(m.name)} <${m.email}> wrote via ${oneLine(m.page ?? "") || "the Contact page"} (topic: ${oneLine(m.topic)}):\n\n${m.message}\n\nReply to this email to answer ${m.email}.`,
    });
    return { attempted: true, sent: true, recipients };
  } catch (e) {
    // The provider's error (e.g. "535 Authentication failed") says what to fix; it never contains the password.
    console.error("[contact] email failed", e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300));
    return { attempted: true, sent: false, recipients, reason: "send failed" };
  } finally {
    transport.close();
  }
}
