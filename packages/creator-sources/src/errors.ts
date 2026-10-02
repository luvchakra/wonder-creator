/** Failures a connector reports, so one provider's trouble never spreads (spec §9). */
export class ConnectorError extends Error {
  constructor(
    readonly kind: "rate_limited" | "revoked" | "retryable" | "fatal",
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}
