/** Structured logging with redaction. Never log secrets, tokens, raw prompts or private content. */
const REDACT_KEYS = /authorization|cookie|token|secret|password|api[_-]?key|prompt|content|body|text/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACT_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

type Level = "debug" | "info" | "warn" | "error";

export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...(redact(fields) as object) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export { redact as redactForLog };
