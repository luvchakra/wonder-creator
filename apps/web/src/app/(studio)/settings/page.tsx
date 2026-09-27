import { providerReadiness } from "@wonder/creator-brain";
import { getAutonomy, getBoundaries, getBrandProfile, getCollaborationProfile, getIdentity, getVoice } from "@wonder/creator-identity";
import { selectMediaProvider } from "@wonder/creator-huddle/media";
import { PageTitle } from "@wonder/ui";
import { avatarUrls } from "@/lib/avatars";
import { requireSession } from "@/lib/session";
import { SettingsView } from "./settings-view";
import { PaletteScope } from "@/components/creative-palette";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { db, creator } = await requireSession();
  const sp = await searchParams;
  const [identity, voice, boundaries, autonomy, blocks, avatars, { data: user }, collaboration, brand] = await Promise.all([
    getIdentity(db, creator.id),
    getVoice(db, creator.id),
    getBoundaries(db, creator.id),
    getAutonomy(db, creator.id),
    db.from("creator_blocks").select("blocked_creator_id, creators!creator_blocks_blocked_creator_id_fkey(display_name, handle)").eq("blocker_creator_id", creator.id),
    avatarUrls(db, [creator.id]),
    db.auth.getUser(),
    getCollaborationProfile(db, creator.id),
    getBrandProfile(db, creator.id),
  ]);
  return (
    <>
      <PaletteScope context={{ page: "settings" }} />
      <div>
        <PageTitle title="Settings" />
        <SettingsView
          section={sp.section ?? "profile"}
          email={user.user?.email ?? ""}
          avatarUrl={avatars[creator.id] ?? null}
          profile={{
            displayName: creator.display_name,
            handle: creator.handle ?? "",
            bio: creator.bio ?? "",
            location: creator.location ?? "",
            showLocation: creator.show_location,
            visibility: creator.visibility,
            collaborationAvailability: creator.collaboration_availability as "open",
            languages: identity.languages,
          }}
          identity={{ disciplines: identity.disciplines, skills: identity.skills, interests: identity.interests }}
          voice={{
            tones: voice?.tones ?? [],
            writingStyle: voice?.writing_style ?? null,
            formality: voice?.formality ?? null,
            visualStyles: voice?.visual_styles ?? [],
            recurringThemes: voice?.recurring_themes ?? [],
            narrativeStyle: voice?.narrative_style ?? "",
            vocabulary: voice?.vocabulary ?? "",
            codeSwitching: voice?.code_switching ?? false,
            experimentation: (voice?.experimentation as "balanced") ?? "balanced",
          }}
          boundaries={boundaries}
          autonomy={autonomy}
          collaboration={collaboration}
          brand={brand}
          blocked={(blocks.data ?? []).map((b) => ({ id: b.blocked_creator_id, name: (b.creators as { display_name: string } | null)?.display_name ?? "Creator", handle: (b.creators as { handle: string | null } | null)?.handle ?? null }))}
          readiness={{ ai: providerReadiness(), mediaConfigured: selectMediaProvider().configured }}
        />
      </div>
    </>
  );
}
