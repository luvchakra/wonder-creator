import { providerReadiness } from "@wonder/creator-brain";
import { selectMediaProvider } from "@wonder/creator-huddle/media";
import { withApi } from "@/lib/api";
import { serviceConfigured } from "@/lib/supabase/service";

/** Provider readiness for the creator UI and admin tooling. Never pretends a provider is live. */
export const GET = withApi(async () => {
  const media = selectMediaProvider();
  return {
    ai: providerReadiness(),
    media: { provider: media.name, configured: media.configured },
    backgroundJobs: { configured: serviceConfigured() },
    transcription: { configured: false, note: "Voice notes are stored; server-side transcription is not connected. Live dictation uses the browser's speech recognition where available." },
  };
});
