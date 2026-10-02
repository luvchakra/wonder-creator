import { myConsents } from "@wonder/creator-identity";
import { consentNeeded } from "@wonder/creator-identity/privacy-options";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ConsentForm } from "./consent-form";

export const metadata = { title: "Before you continue" };

/**
 * Notice and consent (GDPR Art. 7, 13; DPDP §§5–6): shown before first use and again whenever the Terms or Privacy
 * notice change materially (NOTICE_VERSION). Optional purposes are off unless the creator turns them on.
 */
export default async function ConsentPage() {
  const s = await requireSession({ allowOnboarding: true, allowConsent: true });
  const current = await myConsents(s.db);
  if (!consentNeeded(current)) redirect("/");
  const returning = current.some((c) => c.purpose === "terms" && c.granted);
  const optional = Object.fromEntries(current.filter((c) => c.purpose === "product_analytics" || c.purpose === "product_emails").map((c) => [c.purpose, c.granted]));
  return <ConsentForm returning={returning} initial={{ product_analytics: optional.product_analytics ?? false, product_emails: optional.product_emails ?? false }} />;
}
