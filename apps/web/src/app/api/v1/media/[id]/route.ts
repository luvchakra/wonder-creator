import { verifyMediaLink } from "@wonder/core/server";
import { NextResponse, type NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase/service";

/**
 * GET /api/v1/media/:id?e&s — a stable media link (see `mediaLink`). The link itself is the permission: it was minted
 * only after the viewer's access was checked, it names one object, and it expires. Checks it, then redirects to the
 * file in storage with cache headers, so the browser keeps the picture instead of downloading it again. The storage
 * URL for an object is reused while it's valid, so repeat visits land on the same address.
 */
const UUID = /^[0-9a-f-]{36}$/i;
const signedCache = new Map<string, { url: string; until: number }>();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = req.nextUrl.searchParams.get("e");
  const left = UUID.test(id) ? verifyMediaLink(id, e, req.nextUrl.searchParams.get("s")) : null;
  if (!left) return new NextResponse("Not found", { status: 404, headers: { "cache-control": "no-store" } });

  const key = `${id}:${e}`;
  const now = Date.now();
  let hit = signedCache.get(key);
  if (!hit || hit.until <= now + 60_000) {
    const service = serviceClient();
    const { data: o } = await service.from("storage_objects").select("bucket, path, security_status").eq("id", id).maybeSingle();
    if (!o || o.security_status !== "clean") return new NextResponse("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    const { data } = await service.storage.from(o.bucket).createSignedUrl(o.path, left + 3600);
    if (!data?.signedUrl) return new NextResponse("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    hit = { url: data.signedUrl, until: now + left * 1000 };
    signedCache.set(key, hit);
    if (signedCache.size > 5000) for (const k of [...signedCache.keys()].slice(0, 1000)) signedCache.delete(k);
  }
  // Private: never cached by shared caches. Immutable: storage objects don't change (a new file is a new object).
  return NextResponse.redirect(hit.url, { status: 302, headers: { "cache-control": `private, max-age=${Math.max(60, left - 60)}, immutable` } });
}
