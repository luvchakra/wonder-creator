import { AppNav } from "@/components/app-nav";
import { FeaturesProvider } from "@/components/features";
import { PaletteProvider } from "@/components/creative-palette";
import { NavMemory } from "@/components/nav-memory";
import { AudioProvider } from "@/components/soundtrack/audio-provider";
import { MiniPlayer, SoundtrackPanel } from "@/components/soundtrack/soundtrack-ui";
import { mediaLink } from "@wonder/core/server";
import { preloadPaletteButton } from "@/lib/brand-preload";
import { flags } from "@/lib/features";
import { requireSession } from "@/lib/session";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  // The creator's own avatar: the creator row names its object, and the stable link checks the object again when it
  // is fetched. No further lookups before the shell can render (performance.md, phase 1a).
  const avatarUrl = s.creator.avatar_object_id ? mediaLink(s.creator.avatar_object_id) : null;
  preloadPaletteButton();
  return (
    // CreativeRadio lives above every route so music keeps playing while the creator moves around (music-player §18).
    <FeaturesProvider value={flags()}>
    <AudioProvider>
      <PaletteProvider>
        <AppNav me={{ name: s.creator.display_name || "You", handle: s.creator.handle, avatarUrl }} />
        <main id="main" className="relative mx-auto w-full max-w-7xl px-4 pb-[calc(var(--palette-clearance)+env(safe-area-inset-bottom)+1rem)] pt-6 sm:px-6">
          {children}
        </main>
        <NavMemory />
        <MiniPlayer />
        <SoundtrackPanel />
      </PaletteProvider>
    </AudioProvider>
    </FeaturesProvider>
  );
}
