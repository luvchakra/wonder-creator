import { DomainError } from "@wonder/core";
import { withApi } from "@/lib/api";
import { CONTEXT_LINE_PAGES, contextLineFor, type ContextLinePage } from "@/lib/context-line";

/**
 * GET /api/v1/context-line?page=creation&id=… — the navbar's optional AI line for the creator's own object
 * (docs/ui-redesign/ai-context-line.md). Facts are read server-side under RLS; the browser only names the page.
 */
export const GET = withApi(
  async ({ db, creatorId, req }) => {
    const page = req.nextUrl.searchParams.get("page") ?? "";
    const id = req.nextUrl.searchParams.get("id");
    if (!(CONTEXT_LINE_PAGES as readonly string[]).includes(page)) throw new DomainError("validation", "Unknown page.");
    if (id && !/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("validation", "Unknown object.");
    if (page !== "home" && !id) throw new DomainError("validation", "Unknown object.");
    return { text: await contextLineFor(db, creatorId, page as ContextLinePage, id) };
  },
  { rateLimit: 30 },
);
