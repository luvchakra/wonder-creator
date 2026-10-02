import { getPayment } from "@wonder/creator-payments";
import { PaletteScope } from "@/components/creative-palette";
import { requireSession } from "@/lib/session";
import { PaymentStatusView } from "./status";

export const metadata = { title: "Payment" };

/**
 * Where the payer comes back to from Stripe or Razorpay. The status shown is only what the provider confirmed to our
 * webhook — returning here never marks anything paid.
 */
export default async function PaymentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const { db } = await requireSession();
  const { id } = await params;
  const sp = await searchParams;
  const payment = await getPayment(db, /^[0-9a-f-]{36}$/i.test(id) ? id : "00000000-0000-0000-0000-000000000000");
  return (
    <>
      <PaletteScope context={{ page: "settings" }} />
      <PaymentStatusView initial={payment} cancelled={sp.cancelled === "1"} />
    </>
  );
}
