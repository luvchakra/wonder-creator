import { DomainError } from "@wonder/core";
import { deleteBusinessEntry, setBusinessNote, setBusinessStatus } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";

const check = (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("not_found", "We couldn't find that record.");
};

/** PATCH /api/v1/business/records/:id — mark received / paid / cancelled / expected, or change the note. */
export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  check(id);
  const b = z.object({ status: z.enum(["expected", "received", "paid", "cancelled"]).optional(), note: z.string().max(1000).nullable().optional() }).parse(await readJson(req));
  if (b.note !== undefined) await setBusinessNote(db, id, b.note);
  return b.status ? { record: await setBusinessStatus(db, id, b.status) } : { ok: true };
});

/** DELETE /api/v1/business/records/:id — delete one of the creator's own entries. */
export const DELETE = withApi<{ id: string }>(async ({ db }, { id }) => {
  check(id);
  await deleteBusinessEntry(db, id);
  return { ok: true };
});
