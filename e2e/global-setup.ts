import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FullConfig } from "@playwright/test";

/**
 * Runs once before the end-to-end suite (docs/testing.md › Keeping runs repeatable).
 *
 * 1. Refuses to run unless the app and the database are local. End-to-end tests create users, send messages and change
 *    rows; they must never reach production data. There is no override: a shared test environment would be added here
 *    on purpose, in review.
 * 2. Deletes throwaway data that earlier runs left behind, older than E2E_CLEANUP_HOURS (default 2) so a run going on in
 *    parallel is never touched. Only what tests make is recognisable and removed: accounts and contact messages on the
 *    reserved `example.com` domain (RFC 2606 — no real person has one). Deleting an account removes its creator and
 *    everything that belongs to it (on delete cascade).
 *
 * Shared settings: there are none to reset. Feature flags come from the environment, not the database, and tests only
 * change rows that belong to the accounts they created — so a run killed halfway leaves nothing the next run depends on.
 * A test that ever changes something shared must restore it here as well as in its own teardown.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0", "host.docker.internal"]);
const THROWAWAY = /@example\.com$/i;

function envFile(): Record<string, string> {
  const file = path.join(ROOT, "apps/web/.env.local");
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

export function isLocal(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export default async function globalSetup(config: FullConfig) {
  const file = envFile();
  const supabaseUrl = process.env.E2E_SUPABASE_URL ?? file.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const secret = process.env.E2E_SUPABASE_SECRET_KEY ?? file.SUPABASE_SECRET_KEY ?? "";
  const baseURL = String(config.projects[0]?.use.baseURL ?? process.env.E2E_BASE_URL ?? "http://localhost:3000");

  if (!isLocal(supabaseUrl) || !isLocal(baseURL)) {
    throw new Error(
      `End-to-end tests run only against a local app and database (got app ${new URL(baseURL).host}, database ${new URL(supabaseUrl).host}). ` +
        "Start the local stack (npx supabase start) and use npm run e2e:local — see docs/testing.md.",
    );
  }
  if (!secret) return; // nothing to clean without the local service key; the tests will say what's missing

  const hours = Number(process.env.E2E_CLEANUP_HOURS ?? 2);
  const before = new Date(Date.now() - hours * 3_600_000);
  const headers = { apikey: secret, authorization: `Bearer ${secret}`, "content-type": "application/json" };

  // Accounts made by earlier runs.
  let removed = 0;
  let failed = 0;
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=500`, { headers });
    if (!res.ok) {
      console.warn(`[e2e cleanup] couldn't list accounts: ${res.status}`);
      break;
    }
    const { users = [] } = (await res.json()) as { users?: Array<{ id: string; email?: string; created_at: string }> };
    const old = users.filter((u) => u.email && THROWAWAY.test(u.email) && new Date(u.created_at) < before);
    for (const u of old) {
      const del = await fetch(`${supabaseUrl}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers });
      if (del.ok) removed++;
      else failed++;
    }
    if (users.length < 500) break;
  }

  // Contact messages sent by earlier runs (not tied to an account, so they don't go with it).
  const msgs = await fetch(`${supabaseUrl}/rest/v1/contact_messages?email=like.*%40example.com&created_at=lt.${encodeURIComponent(before.toISOString())}`, {
    method: "DELETE",
    headers: { ...headers, prefer: "return=minimal" },
  });

  console.log(
    `[e2e cleanup] removed ${removed} test account(s) older than ${hours}h${failed ? ` (${failed} couldn't be removed)` : ""}` +
      `${msgs.ok ? "" : `; contact messages: ${msgs.status}`}.`,
  );
}
