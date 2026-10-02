/**
 * RFC 9116 security.txt: where to report a vulnerability. The contact comes from configuration
 * (WONDERCREATOR_SECURITY_CONTACT, a mailto: or https: address); the disclosure policy lives at /legal/security.
 */
export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const contact = process.env.WONDERCREATOR_SECURITY_CONTACT?.trim();
  const expires = new Date(Date.now() + 180 * 86_400_000).toISOString();
  const lines = [
    `Contact: ${contact && /^(mailto:|https:)/.test(contact) ? contact : `${origin}/legal/security`}`,
    `Expires: ${expires}`,
    `Policy: ${origin}/legal/security`,
    "Preferred-Languages: en, hi",
    `Canonical: ${origin}/.well-known/security.txt`,
  ];
  return new Response(`${lines.join("\n")}\n`, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
