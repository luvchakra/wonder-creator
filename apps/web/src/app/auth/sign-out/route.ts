import { audit } from "@wonder/core";
import { NextResponse, type NextRequest } from "next/server";
import { describeRequest } from "@/lib/device";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  if (claims?.claims?.sub) {
    const { data: c } = await db.from("creators").select("id").eq("user_id", claims.claims.sub as string).maybeSingle();
    if (c) await audit(db, { action: "auth.signed_out", objectType: "creator", objectId: c.id, metadata: describeRequest(req) }).catch(() => undefined);
  }
  await db.auth.signOut();
  return NextResponse.json({ ok: true });
}
