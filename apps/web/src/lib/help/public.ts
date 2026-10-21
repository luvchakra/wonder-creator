import "server-only";
import { allTopics } from "./content";
import type { HelpTopic } from "./types";

/**
 * The only help that stays public (owner, 16 Oct 2026; docs/help.md › What stays public): what someone needs before they
 * can sign in. Everything else in Help is for signed-in creators. Shown at /account-help.
 */
export const PUBLIC_HELP_SLUGS = ["creating-an-account", "signing-in", "sign-in-trouble"] as const;

/** Pages a signed-out visitor can open. A public topic links only to these, so nothing public points at a sign-in wall. */
export const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/account-help", "/contact", "/about", "/careers", "/legal/privacy", "/legal/terms", "/legal/security", "/legal/subprocessors"] as const;

export function isPublicPath(href: string): boolean {
  return (PUBLIC_PATHS as readonly string[]).includes(href.split(/[?#]/)[0]!);
}

/** The public topics, in reading order, with any link to a signed-in page left out. */
export function publicHelpTopics(): HelpTopic[] {
  const bySlug = new Map(allTopics().map(({ topic }) => [topic.slug, topic]));
  return PUBLIC_HELP_SLUGS.map((slug) => bySlug.get(slug)).filter((t): t is HelpTopic => !!t).map((t) => ({ ...t, links: (t.links ?? []).filter((l) => isPublicPath(l.href)) }));
}
