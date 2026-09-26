import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = await createClient();
  await db.auth.signOut();
  return NextResponse.json({ ok: true });
}
