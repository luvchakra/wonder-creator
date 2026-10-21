# Terms: automated access and reverse engineering — DRAFT for legal review

**Not published. Not legal advice.** Proposed clauses for a lawyer to review and fit into the Terms of Service
(`apps/web/src/app/legal/terms/page.tsx`) and an Acceptable Use Policy. If they are adopted, bump `NOTICE_VERSION`
(`packages/creator-identity/src/privacy-options.ts`) so every creator is asked to agree again (the sign-up and
`/consent` flow already store the version and the time).

## Acceptable use (proposed)

You agree not to, and not to let anyone or anything on your behalf:

1. **Reverse engineer.** Decompile, disassemble, deobfuscate or otherwise try to derive the source code, models,
   prompts, algorithms, data structures or non-public interfaces of Wonder Creator, except where the law gives you
   that right despite this clause.
2. **Scrape or copy.** Use bots, crawlers, scrapers or any other automated means to read, copy or collect the service,
   its screens, its interface responses or its content, other than through interfaces we publish for that purpose.
3. **Use automated or AI agents.** Use an AI model, browsing agent or similar tool to explore, map or replicate the
   service, or to bypass a limit or control. Using an assistant to help with your own work, at human pace, is fine.
4. **Train on it.** Use the service, its output or its non-public information to train, fine-tune or evaluate a
   machine-learning model. (Your own work stays yours; this is about ours.)
5. **Compete with it.** Use the service, or what you learn from it, to build or improve a product that competes with it.
6. **Get around limits.** Circumvent rate limits, access controls, rights or privacy settings, or share account access.
7. **Share non-public information.** Publish non-public parts of the service (private screens, interface details,
   internal documents) without our written permission.

## Consequences (proposed)

We may limit, suspend or end access, and take legal action, for breach of the above. Wording for notice, appeal and
refunds is for counsel.

## Points for counsel

- Enforceability of the reverse-engineering clause varies by country (for example interoperability rights in the EU).
- Whether to name AI agents explicitly (item 3) or to cover them under "automated means".
- Whether the Terms should say what the product does when scraping is detected (warn, limit, suspend).
- The public repository's licence: `LICENSE` now says all rights reserved; confirm that matches intent.
