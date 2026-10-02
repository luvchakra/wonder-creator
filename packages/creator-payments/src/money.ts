/**
 * Money in minor units (client-safe). Amounts are integers in the currency's smallest unit (paise, cents…), as Stripe
 * and Razorpay expect; the exponent table matches `app.currency_exponent` in migration 070.
 */
const ZERO = new Set(["BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);
const THREE = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

export function currencyExponent(currency: string): number {
  const c = currency.toUpperCase();
  return ZERO.has(c) ? 0 : THREE.has(c) ? 3 : 2;
}

/** 1250.5 INR → 125050. Rounds half away from zero at the minor unit. */
export function toMinor(amount: number, currency: string): number {
  const f = 10 ** currencyExponent(currency);
  return Math.sign(amount) * Math.round(Math.abs(amount) * f + Number.EPSILON);
}

export function fromMinor(minor: number, currency: string): number {
  return minor / 10 ** currencyExponent(currency);
}

/** "₹1,250.50" — formatted for people; never parsed back. */
export function formatMinor(minor: number, currency: string, locale?: string): string {
  const e = currencyExponent(currency);
  return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: e, maximumFractionDigits: e }).format(fromMinor(minor, currency));
}

export const PAYMENT_STATUS_LABEL = {
  created: "Preparing",
  open: "Awaiting payment",
  paid: "Paid",
  failed: "Failed",
  expired: "Expired",
  cancelled: "Cancelled",
  refunded: "Refunded",
  partially_refunded: "Partly refunded",
} as const;
export type PaymentStatus = keyof typeof PAYMENT_STATUS_LABEL;
