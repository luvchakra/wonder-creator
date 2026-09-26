import { liveCards } from "@wonder/creator-huddle";
import { selectMediaProvider } from "@wonder/creator-huddle/media";
import { BACKGROUNDS, BrandBackground, EmptyState, PageTitle } from "@wonder/ui";
import { LiveHuddleCard } from "@/components/huddle/live-card";
import { after } from "next/server";
import { sweepStalePresence } from "@/lib/presence";
import { requireSession } from "@/lib/session";
import { StartHuddle } from "./start-huddle";

export const metadata = { title: "Huddles" };

export default async function HuddlesPage() {
  const { db, creator } = await requireSession();
  after(sweepStalePresence);
  const huddles = await liveCards(db, { limit: 48 });
  const mine = huddles.find((h) => h.viewerState === "joined");
  return (
    <div className="space-y-8">
      <BrandBackground src={BACKGROUNDS.coastalVillage} overlay="cream" position="right center" className="-mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-3xl lg:px-10">
        <div className="py-8 lg:py-12">
          <PageTitle title="Live Huddles" subtitle="Spontaneous, temporary conversations between creators. Join one, or start your own." className="mb-4" />
          <StartHuddle currentHuddleId={mine?.huddleId ?? null} mediaConfigured={selectMediaProvider().configured} creatorName={creator.display_name} />
        </div>
      </BrandBackground>
      <section aria-label="Live now">
        {huddles.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {huddles.map((h) => (
              <li key={h.huddleId}>
                <LiveHuddleCard h={h} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState image={BACKGROUNDS.pastelClouds} title="No one is live right now" body="Start a Huddle and creators who are around can ask to join. It ends by itself when everyone leaves." />
        )}
      </section>
    </div>
  );
}
