import net from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contactRecipients, mailContactMessage, parseEmailList, smtpConfig } from "./contact-mail";

describe("parseEmailList", () => {
  it("returns an empty list for unset or blank input", () => {
    expect(parseEmailList(undefined)).toEqual([]);
    expect(parseEmailList(null)).toEqual([]);
    expect(parseEmailList("  ")).toEqual([]);
  });
  it("splits, trims, lower-cases, dedupes, accepts mailto: and drops what isn't an address", () => {
    expect(parseEmailList(" Ops@Example.com , mailto:Founder@example.com, OPS@example.com, not-an-email, ,x@y")).toEqual(["ops@example.com", "founder@example.com"]);
  });
});

describe("who is told", () => {
  it("CONTACT_NOTIFY_EMAILS, else the Contact page's own inbox", () => {
    expect(contactRecipients({ CONTACT_NOTIFY_EMAILS: "a@x.co, b@x.co", WONDERCREATOR_CONTACT_EMAIL: "hello@x.co" })).toEqual(["a@x.co", "b@x.co"]);
    expect(contactRecipients({ WONDERCREATOR_CONTACT_EMAIL: "mailto:connect@wonderapps.biz" })).toEqual(["connect@wonderapps.biz"]);
    expect(contactRecipients({ CONTACT_NOTIFY_EMAILS: "junk", WONDERCREATOR_CONTACT_EMAIL: "hello@x.co" })).toEqual(["hello@x.co"]);
    expect(contactRecipients({ WONDERCREATOR_CONTACT_EMAIL: "https://x.co/contact" })).toEqual([]);
    expect(contactRecipients({})).toEqual([]);
  });
});

/** A minimal SMTP server on loopback that records the login and the message it is handed. */
function smtpSink(opts: { rejectAuth?: boolean } = {}) {
  const seen = { auth: "", mailFrom: "", rcpt: [] as string[], data: "" };
  const server = net.createServer((sock) => {
    let buf = "";
    let inData = false;
    let authLogin: "user" | "pass" | null = null;
    let user = "";
    sock.write("220 sink ESMTP\r\n");
    sock.on("data", (chunk) => {
      buf += chunk.toString();
      let i: number;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            sock.write("250 queued\r\n");
          } else seen.data += line + "\n";
          continue;
        }
        if (authLogin === "user") {
          user = Buffer.from(line, "base64").toString();
          authLogin = "pass";
          sock.write("334 UGFzc3dvcmQ6\r\n");
          continue;
        }
        if (authLogin === "pass") {
          authLogin = null;
          seen.auth = `${user}:${Buffer.from(line, "base64").toString()}`;
          sock.write(opts.rejectAuth ? "535 Authentication failed\r\n" : "235 ok\r\n");
          continue;
        }
        const cmd = line.toUpperCase();
        if (cmd.startsWith("EHLO")) sock.write("250-sink\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (cmd.startsWith("AUTH PLAIN")) {
          const [, u, p] = Buffer.from(line.split(" ")[2] ?? "", "base64").toString().split("\0");
          seen.auth = `${u}:${p}`;
          sock.write(opts.rejectAuth ? "535 Authentication failed\r\n" : "235 ok\r\n");
        } else if (cmd.startsWith("AUTH LOGIN")) {
          authLogin = "user";
          sock.write("334 VXNlcm5hbWU6\r\n");
        } else if (cmd.startsWith("MAIL FROM")) {
          seen.mailFrom = line;
          sock.write("250 ok\r\n");
        } else if (cmd.startsWith("RCPT TO")) {
          seen.rcpt.push(line);
          sock.write("250 ok\r\n");
        } else if (cmd === "DATA") {
          inData = true;
          sock.write("354 go\r\n");
        } else if (cmd === "QUIT") {
          sock.write("221 bye\r\n");
          sock.end();
        } else sock.write("250 ok\r\n");
      }
    });
  });
  return new Promise<{ port: number; seen: typeof seen; close: () => void }>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ port: (server.address() as net.AddressInfo).port, seen, close: () => server.close() })),
  );
}

const message = { name: "Asha Rao", email: "visitor@example.com", topic: "feedback", message: "The Contact page is lovely.\nOne small idea inside.", page: "/contact" };

describe("contact messages over the operator's own mailbox (SMTP)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reads SMTP settings, defaulting to implicit TLS on 465 and sending as the mailbox itself", () => {
    expect(smtpConfig({ SMTP_HOST: "smtpout.secureserver.net", SMTP_USER: "connect@wonderapps.biz", SMTP_PASS: "x" })).toEqual({ host: "smtpout.secureserver.net", port: 465, user: "connect@wonderapps.biz", pass: "x", from: "Wonder Creator <connect@wonderapps.biz>" });
    expect(smtpConfig({ SMTP_HOST: "h", SMTP_USER: "u@x.co", SMTP_PASS: "x", SMTP_PORT: "587", CONTACT_FROM_EMAIL: "Team <u@x.co>" })).toMatchObject({ port: 587, from: "Team <u@x.co>" });
    expect(smtpConfig({ SMTP_HOST: "h", SMTP_USER: "u@x.co" })).toBeNull();
    expect(smtpConfig({ SMTP_HOST: "h", SMTP_USER: "u@x.co", SMTP_PASS: "x", SMTP_PORT: "nope" })).toBeNull();
  });

  it("doesn't pretend to deliver without a mailbox, and does nothing without an inbox", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await mailContactMessage(message, { WONDERCREATOR_CONTACT_EMAIL: "connect@wonderapps.biz" })).toEqual({ attempted: true, sent: false, recipients: ["connect@wonderapps.biz"], reason: "no mailbox connected" });
    expect(await mailContactMessage(message, { SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASS: "p" })).toEqual({ attempted: false, sent: false, recipients: [], reason: "no inbox configured" });
  });

  it("signs in as the mailbox and mails the Contact page's inbox, From Wonder Creator, Reply-To the sender", async () => {
    const sink = await smtpSink();
    try {
      const r = await mailContactMessage(message, { WONDERCREATOR_CONTACT_EMAIL: "connect@wonderapps.biz", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(sink.port), SMTP_USER: "connect@wonderapps.biz", SMTP_PASS: "mailbox-pass" });
      expect(r).toEqual({ attempted: true, sent: true, recipients: ["connect@wonderapps.biz"] });
      expect(sink.seen.auth).toBe("connect@wonderapps.biz:mailbox-pass");
      expect(sink.seen.rcpt.join(" ")).toContain("<connect@wonderapps.biz>");
      expect(sink.seen.data).toMatch(/^From: Wonder Creator <connect@wonderapps\.biz>$/m);
      expect(sink.seen.data).toMatch(/^Reply-To: visitor@example\.com$/m);
      // The dash makes the subject non-ASCII, so it travels encoded ("=?UTF-8?…"); either form names the app.
      expect(sink.seen.data).toMatch(/^Subject: (\[Wonder Creator contact\]|=\?UTF-8\?)/m);
      expect(sink.seen.data).toContain("The Contact page is lovely.");
      expect(sink.seen.data).toContain("One small idea inside.");
    } finally {
      sink.close();
    }
  });

  it("a name can't add headers: line breaks in it become spaces", async () => {
    const sink = await smtpSink();
    try {
      await mailContactMessage({ ...message, name: "Asha\r\nBcc: attacker@example.com" }, { WONDERCREATOR_CONTACT_EMAIL: "connect@wonderapps.biz", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(sink.port), SMTP_USER: "connect@wonderapps.biz", SMTP_PASS: "p" });
      expect(sink.seen.data).not.toMatch(/^Bcc:/im);
      expect(sink.seen.rcpt.join(" ")).not.toContain("attacker@example.com");
    } finally {
      sink.close();
    }
  });

  it("reports a rejected login as not sent, never throws, and never logs the password", async () => {
    const sink = await smtpSink({ rejectAuth: true });
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void errors.push(a.map(String).join(" ")));
    try {
      const r = await mailContactMessage(message, { WONDERCREATOR_CONTACT_EMAIL: "connect@wonderapps.biz", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(sink.port), SMTP_USER: "connect@wonderapps.biz", SMTP_PASS: "secret-pass-123" });
      expect(r).toMatchObject({ attempted: true, sent: false, reason: "send failed" });
      expect(errors.join(" ")).toContain("535");
      expect(errors.join(" ")).not.toContain("secret-pass-123");
    } finally {
      sink.close();
    }
  });
});
