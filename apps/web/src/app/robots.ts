import type { MetadataRoute } from "next";

/**
 * Search engines may read the public pages (landing, About, Contact, legal, Creator Pages and published works);
 * the signed-in app, the API and the help centre are for people. AI model crawlers are asked to stay out entirely
 * (docs/security.md › Automated access). A request, not a lock: the real controls are sessions and rate limits.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "CCBot",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
  "cohere-ai",
  "Diffbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/help", "/s/", "/embed/", "/auth/", "/consent", "/onboarding"] },
      { userAgent: AI_CRAWLERS, disallow: "/" },
    ],
  };
}
