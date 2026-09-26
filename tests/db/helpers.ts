import { execSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect } from "vitest";
import type { Database, Tables } from "../../packages/db/src/index";

// Connection details come from the environment, or from the running local stack
// (`npx supabase status -o json`). Keys are never committed.
function localStatus(): Record<string, string> {
  try {
    const out = execSync("npx supabase status -o json", { stdio: ["ignore", "pipe", "ignore"], timeout: 60000 }).toString();
    return JSON.parse(out.slice(out.indexOf("{"))) as Record<string, string>;
  } catch {
    return {};
  }
}
const needsLocal = !(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
const local = needsLocal ? localStatus() : {};

export const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? local.API_URL ?? "http://127.0.0.1:54321";
export const PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? local.PUBLISHABLE_KEY ?? local.ANON_KEY ?? "";
export const SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? local.SECRET_KEY ?? local.SERVICE_ROLE_KEY ?? "";
if (!PUBLISHABLE_KEY || !SECRET_KEY) {
  throw new Error("DB tests need a Supabase stack: run `npx supabase start` or set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY.");
}

export type Db = SupabaseClient<Database>;
/** Untyped view of a client, for table-generic loops in tests. */
export type LooseDb = SupabaseClient;

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

/** Secret-key client: bypasses RLS. Use only for setup and for verifying ground truth. */
export function adminClient(): Db {
  return createClient<Database>(SUPABASE_URL, SECRET_KEY, clientOptions);
}

/** Signed-out client using the publishable key (role `anon`). */
export function anonClient(): Db {
  return createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, clientOptions);
}

export function loose(client: Db): LooseDb {
  return client as unknown as LooseDb;
}

export interface TestCreator {
  client: Db;
  userId: string;
  creatorId: string;
  tenantId: string;
  email: string;
}

const admin = adminClient();
const created: string[] = [];

export async function createTestCreator(label = "creator"): Promise<TestCreator> {
  const email = `${label}-${randomUUID()}@wonder.test`.toLowerCase();
  const password = `pw-${randomUUID()}`;
  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: label },
  });
  if (createError || !createdUser.user) throw createError ?? new Error("createUser returned no user");
  const userId = createdUser.user.id;
  created.push(userId);

  const client = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  const { data: creator, error: creatorError } = await admin
    .from("creators")
    .select("id, tenant_id")
    .eq("user_id", userId)
    .single();
  if (creatorError || !creator) throw creatorError ?? new Error("creator row missing");

  return { client, userId, creatorId: creator.id, tenantId: creator.tenant_id, email };
}

export async function createTestCreators(n: number, label = "creator"): Promise<TestCreator[]> {
  return Promise.all(Array.from({ length: n }, (_, i) => createTestCreator(`${label}${i}`)));
}

/**
 * Best-effort removal of every user created by this module (cascades to creator data).
 * Failures are ignored: cleanup must never mask a test result.
 */
export async function cleanupTestCreators(): Promise<void> {
  const ids = created.splice(0);
  const remove = async (id: string) => {
    const { error } = await admin.auth.admin.deleteUser(id).catch((e: Error) => ({ error: e }));
    return error ? id : null;
  };
  // Rows of one test user can reference another's, so retry failures once after the rest are gone.
  const failed = (await Promise.all(ids.map(remove))).filter((id): id is string => id !== null);
  for (const id of failed) await remove(id);
}

interface ErrorLike {
  message: string;
  code?: string;
}
interface Response {
  data: unknown;
  error: ErrorLike | null;
}

/** Asserts that a request failed, optionally with a specific Postgres error code. */
export function expectDenied(res: Response, code?: string): ErrorLike {
  expect(res.error, `expected an error, got data ${JSON.stringify(res.data)}`).not.toBeNull();
  if (code) expect(res.error?.code).toBe(code);
  return res.error as ErrorLike;
}

/** Asserts that a request succeeded and returns its (non-null) data. */
export function expectOk<R extends Response>(res: R): NonNullable<R["data"]> {
  expect(res.error, res.error ? `${res.error.code}: ${res.error.message}` : undefined).toBeNull();
  return res.data as NonNullable<R["data"]>;
}

/**
 * For UPDATE/DELETE blocked by RLS PostgREST returns success with zero rows (or an error).
 * Either is acceptable; any affected row is a failure.
 */
export function expectNoRowsAffected(res: Response): void {
  if (res.error) return;
  expect((res.data as unknown[] | null) ?? []).toHaveLength(0);
}

export function textBlob(text: string): Blob {
  return new Blob([text], { type: "text/plain" });
}

export const fakeSha = () => randomBytes(32).toString("hex");

/** Creates a provenance record for the creator (required by materials and artifacts). */
export async function createProvenance(c: TestCreator, origin: "typed" | "upload" = "typed"): Promise<string> {
  const row = expectOk(
    await c.client.from("provenance_records").insert({ creator_id: c.creatorId, origin }).select("id").single(),
  );
  return row.id;
}

/**
 * Registers a storage object the way the server does (secret key): clients cannot write storage_objects.
 * The path must live under the creator's own folder.
 */
export async function registerStorageObject(c: TestCreator, path = `${c.creatorId}/${randomUUID()}`): Promise<string> {
  const row = expectOk(
    await admin
      .from("storage_objects")
      .insert({
        creator_id: c.creatorId,
        bucket: "creator-media",
        path,
        mime_type: "text/plain",
        size_bytes: 5,
        sha256: fakeSha(),
      })
      .select("id")
      .single(),
  );
  return row.id;
}

export async function createMaterial(c: TestCreator, title = "A material"): Promise<string> {
  const provenanceId = await createProvenance(c);
  const row = expectOk(
    await c.client
      .from("creative_materials")
      .insert({ creator_id: c.creatorId, type: "note", title, text_content: "secret text", provenance_id: provenanceId })
      .select("id")
      .single(),
  );
  return row.id;
}

export async function createArtifact(
  c: TestCreator,
  overrides: Partial<Database["public"]["Tables"]["artifacts"]["Insert"]> = {},
): Promise<string> {
  const provenanceId = await createProvenance(c);
  // The id is generated client-side and the insert has no RETURNING: `insert().select()` on artifacts
  // currently fails (see artifacts.test.ts), and setup must not depend on that bug.
  const id = randomUUID();
  expectOk(
    await c.client.from("artifacts").insert({
      id,
      creator_id: c.creatorId,
      artifact_type: "poem",
      category: "writing",
      title: "An artifact",
      provenance_id: provenanceId,
      ...overrides,
    }),
  );
  return id;
}

export type ArtifactVersion = Tables<"artifact_versions">;

export async function createVersion(
  c: TestCreator,
  artifactId: string,
  content: string,
  restoredFrom?: string,
): Promise<ArtifactVersion> {
  // The generated RPC return type for a composite-returning function does not narrow through .single().
  return expectOk(
    await c.client
      .rpc("create_artifact_version", {
        p_artifact_id: artifactId,
        p_content: content,
        p_label: restoredFrom ? "Restore" : "Draft",
        p_author_kind: restoredFrom ? "restore" : "creator",
        ...(restoredFrom ? { p_restored_from: restoredFrom } : {}),
      })
      .single(),
  ) as unknown as ArtifactVersion;
}
