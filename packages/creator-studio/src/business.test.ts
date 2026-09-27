import { describe, expect, it } from "vitest";
import { formatMoney, kindDirection, summarize } from "./business";

describe("business summary", () => {
  it("totals per currency, never mixing currencies, and ignores cancelled records", () => {
    const s = summarize([
      { currency: "INR", direction: "in", status: "received", amount: 5000 },
      { currency: "INR", direction: "in", status: "expected", amount: 2500.5 },
      { currency: "INR", direction: "in", status: "cancelled", amount: 99999 },
      { currency: "INR", direction: "out", status: "paid", amount: 300 },
      { currency: "USD", direction: "out", status: "expected", amount: 20 },
    ]);
    expect(s).toEqual([
      { currency: "INR", received: 5000, expected: 2500.5, paidOut: 300, owed: 0 },
      { currency: "USD", received: 0, expected: 0, paidOut: 0, owed: 20 },
    ]);
  });

  it("knows which kinds are income and formats money in its own currency", () => {
    expect([kindDirection("license_income"), kindDirection("payout"), kindDirection("provider_cost")]).toEqual(["in", "out", "out"]);
    expect(formatMoney(2500.5, "USD")).toBe("$2,500.50");
    expect(formatMoney(12, "INR")).toContain("12");
  });
});
