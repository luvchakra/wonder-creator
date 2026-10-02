import "server-only";
import { paymentsConfigFromEnv, type PaymentDeps } from "@wonder/creator-payments";
import type { Db } from "@wonder/db";
import type { NextRequest } from "next/server";
import { serviceClient } from "./supabase/service";

/** Payment dependencies for a request: provider keys from the server environment, never the browser. */
export function paymentDeps(db: Db, req: NextRequest): PaymentDeps {
  return { db, service: serviceClient(), config: paymentsConfigFromEnv(), appOrigin: req.nextUrl.origin };
}
