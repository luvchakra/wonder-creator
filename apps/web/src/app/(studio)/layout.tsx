import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { PaletteProvider } from "@/components/creative-palette";
import { NavMemory } from "@/components/nav-memory";
import { AudioProvider } from "@/components/soundtrack/audio-provider";
import { MiniPlayer, SoundtrackPanel } from "@/components/soundtrack/soundtrack-ui";
import { avatarUrls } from "@/lib/avatars";
import { preloadPaletteButton } from "@/lib/brand-preload";
import { requireSession } from "@/lib/session";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const avatars = await avatarUrls(s.db, [s.creator.id]);
  preloadPaletteButton();
  return (
    // CreativeRadio lives above every route so music keeps playing while the creator moves around (music-player §18).
    <AudioProvider>
      <PaletteProvider>
        <AppNav me={{ name: s.creator.display_name || "You", handle: s.creator.handle, avatarUrl: avatars[s.creator.id] ?? null }} />
        <main id="main" className="relative mx-auto w-full max-w-7xl px-4 pb-[calc(var(--palette-clearance)+env(safe-area-inset-bottom)+1rem)] pt-6 sm:px-6">
          {children}
        </main>
        <Suspense fallback={null}>
          <NavMemory />
        </Suspense>
        <MiniPlayer />
        <SoundtrackPanel />
      </PaletteProvider>
    </AudioProvider>
  );
}
