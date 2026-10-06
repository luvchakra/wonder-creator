import "server-only";
import { myConsents } from "@wonder/creator-identity";
import type { Db } from "@wonder/db";

type Consents = Awaited<ReturnType<typeof myConsents>>;
const memo = new WeakMap<Db, Promise<Consents>>();

/**
 * The creator's latest consent choices, read once per request client: the consent gate in `requireSession` and every
 * analytics event on the same page used to ask the database separately (seven times on Home). The client lives for one
 * request, so a changed choice is always seen by the next one.
 */
export function consentsFor(db: Db): Promise<Consents> {
  let p = memo.get(db);
  if (!p) {
    p = myConsents(db);
    memo.set(db, p);
    p.catch(() => memo.delete(db));
  }
  return p;
}
