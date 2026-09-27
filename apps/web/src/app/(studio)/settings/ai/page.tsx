import { BYOK_PROVIDERS, providerReadiness } from "@wonder/creator-brain";
import { PageTitle } from "@wonder/ui";
import Link from "next/link";
import { providerFor } from "@/lib/brain";
import { listKeys } from "@/lib/byok";
import { requireSession } from "@/lib/session";
import { serviceConfigured } from "@/lib/supabase/service";
import { AiProviders } from "./ai-providers";

export const metadata = { title: "AI Providers" };

function sevenDaysAgo(): string {
  return new Date(Date.now() - 7 * 86400_000).toISOString();
}

export default async function AiProvidersPage() {
  const { db, creator } = await requireSession();
  const [keys, inUse, failures] = await Promise.all([
    listKeys(db),
    providerFor(creator.id),
    db.from("ai_runs").select("failure_code, completed_at, provider").eq("status", "failed").in("failure_code", ["provider_unavailable", "provider_failed", "rate_limited"]).gte("started_at", sevenDaysAgo()).order("started_at", { ascending: false }).limit(1),
  ]);
  const platform = providerReadiness();
  const lastFailure = failures.data?.[0] ?? null;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/settings" className="inline-flex min-h-11 items-center text-sm text-accent-ink hover:underline">
        ← Settings
      </Link>
      <PageTitle title="AI Providers" subtitle="Which AI model CreatorBrain uses for you, and your own keys if you'd like to use them." />
      <AiProviders
        providers={BYOK_PROVIDERS.map((p) => ({ id: p.id, name: p.name, keyLabel: p.keyLabel, keyHelp: p.keyHelp, dataUse: p.dataUse }))}
        initialKeys={keys}
        platform={{ live: platform.live, note: platform.note }}
        inUse={inUse.source === "own_key" ? { source: "own_key", provider: inUse.keyProvider } : { source: "platform", provider: null }}
        lastFailure={lastFailure ? { code: lastFailure.failure_code ?? "provider_failed", at: lastFailure.completed_at } : null}
        byokAvailable={serviceConfigured()}
      />
    </div>
  );
}
