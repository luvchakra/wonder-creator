import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db, Tables } from "@wonder/db";
import { z } from "zod";

/**
 * CreatorBusiness Foundation (P1-19, plan §40): the economic records Wonder Creator's domains produce, kept for the
 * creator — not accounting software. Records made from domain events (e.g. a license with a fee becoming active) keep
 * the source's amount; the creator only marks them received / paid / cancelled and adds a note. The creator can also
 * add their own entries (brand income, costs, payouts). Wonder Creator takes no payments.
 */

export const BUSINESS_KINDS = [
  { value: "brand_income", label: "Brand income", direction: "in" },
  { value: "artifact_sale", label: "Sale", direction: "in" },
  { value: "license_income", label: "License income", direction: "in" },
  { value: "collaboration_compensation", label: "Collaboration pay", direction: "in" },
  { value: "provider_cost", label: "Tools & providers", direction: "out" },
  { value: "payout", label: "Payout", direction: "out" },
] as const;
export type BusinessKind = (typeof BUSINESS_KINDS)[number]["value"];
export const kindLabel = (k: string) => BUSINESS_KINDS.find((x) => x.value === k)?.label ?? k;
export const kindDirection = (k: string): "in" | "out" => BUSINESS_KINDS.find((x) => x.value === k)?.direction ?? "in";

export const STATUS_LABEL: Record<string, string> = { expected: "Expected", received: "Received", paid: "Paid", cancelled: "Cancelled" };

export type BusinessRecord = Tables<"business_records">;

export const businessEntrySchema = z.object({
  kind: z.enum(BUSINESS_KINDS.map((k) => k.value) as [BusinessKind, ...BusinessKind[]]),
  amount: z.coerce.number().min(0, "The amount can't be negative.").max(1e11),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, like INR or USD."),
  occurredOn: z.string().date().optional(),
  counterparty: z.string().trim().max(120).nullish().transform((v) => v || null),
  description: z.string().trim().max(300).nullish().transform((v) => v || null),
  artifactId: z.string().uuid().nullish().transform((v) => v ?? null),
  settled: z.boolean().default(false),
});

/** The creator's own entry. Income can start received; costs and payouts can start paid. */
export async function addBusinessEntry(db: Db, creatorId: string, raw: unknown): Promise<BusinessRecord> {
  const e = businessEntrySchema.parse(raw);
  const direction = kindDirection(e.kind);
  const res = await db
    .from("business_records")
    .insert({
      creator_id: creatorId,
      kind: e.kind,
      direction,
      amount: e.amount,
      currency: e.currency,
      status: "expected",
      occurred_on: e.occurredOn ?? new Date().toISOString().slice(0, 10),
      counterparty: e.counterparty,
      description: e.description,
      artifact_id: e.artifactId,
      source_type: "manual",
    })
    .select("*")
    .single();
  if (res.error) throw res.error.code === "42501" ? new DomainError("not_found", "That Creation isn't available.") : fromDbError(res.error);
  return e.settled ? setBusinessStatus(db, res.data.id, direction === "in" ? "received" : "paid") : res.data;
}

/** Received / paid / cancelled / back to expected. Amounts never change here. */
export async function setBusinessStatus(db: Db, id: string, status: "expected" | "received" | "paid" | "cancelled"): Promise<BusinessRecord> {
  const res = await db.from("business_records").update({ status }).eq("id", id).select("*");
  if (res.error) {
    if (res.error.code === "23514") throw new DomainError("validation", status === "paid" ? "Only costs and payouts are paid; income is received." : "Only income is received; costs and payouts are paid.");
    throw fromDbError(res.error);
  }
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that record.");
  return res.data[0]!;
}

export async function setBusinessNote(db: Db, id: string, note: string | null): Promise<void> {
  const res = await db.from("business_records").update({ note: note?.trim().slice(0, 1000) || null }).eq("id", id).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that record.");
}

/** Only the creator's own entries can be deleted; records from events are cancelled instead. */
export async function deleteBusinessEntry(db: Db, id: string): Promise<void> {
  const res = await db.from("business_records").delete().eq("id", id).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("conflict", "Records from licenses and other activity can't be deleted — cancel them instead.");
}

export async function listBusinessRecords(db: Db, opts: { year?: number } = {}): Promise<BusinessRecord[]> {
  let q = db.from("business_records").select("*").order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(500);
  if (opts.year) q = q.gte("occurred_on", `${opts.year}-01-01`).lte("occurred_on", `${opts.year}-12-31`);
  return must(await q);
}

export interface CurrencySummary {
  currency: string;
  received: number;
  expected: number;
  paidOut: number;
  owed: number;
}

/** Totals per currency (never converted or combined across currencies). Cancelled records count for nothing. */
export function summarize(records: Array<Pick<BusinessRecord, "currency" | "direction" | "status" | "amount">>): CurrencySummary[] {
  const by = new Map<string, CurrencySummary>();
  for (const r of records) {
    if (r.status === "cancelled") continue;
    const s = by.get(r.currency) ?? { currency: r.currency, received: 0, expected: 0, paidOut: 0, owed: 0 };
    const amt = Number(r.amount);
    if (r.direction === "in") {
      if (r.status === "received") s.received += amt;
      else s.expected += amt;
    } else if (r.status === "paid") s.paidOut += amt;
    else s.owed += amt;
    by.set(r.currency, s);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return [...by.values()].map((s) => ({ ...s, received: round(s.received), expected: round(s.expected), paidOut: round(s.paidOut), owed: round(s.owed) })).sort((a, b) => a.currency.localeCompare(b.currency));
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en", { maximumFractionDigits: 2 })}`;
  }
}
