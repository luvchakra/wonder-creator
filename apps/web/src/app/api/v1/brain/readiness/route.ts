import { providerReadiness, selectProvider } from "@wonder/creator-brain";
import { selectMediaProvider } from "@wonder/creator-huddle/media";
import { withApi } from "@/lib/api";
import { serviceConfigured } from "@/lib/supabase/service";

/** Provider readiness for the creator UI and admin tooling. Never pretends a provider is live. */
export const GET = withApi(async () => {
  const media = selectMediaProvider();
  const ai = selectProvider();
  const canTranscribe = ai.live && typeof ai.transcribe === "function";
  return {
    ai: providerReadiness(),
    media: { provider: media.name, configured: media.configured },
    backgroundJobs: { configured: serviceConfigured() },
    transcription: canTranscribe
      ? { configured: true, note: `Audio and video are transcribed by ${ai.name} after upload.` }
      : { configured: false, note: "Voice notes are stored; transcription needs an AI provider that supports audio (gemini). Live dictation uses the browser's speech recognition where available." },
  };
});
