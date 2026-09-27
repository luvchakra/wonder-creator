/** The Soundtrack (docs/ui-redesign/music-player.md). Pure data — no React, no I/O. */

export const MOODS = ["calm", "dreamy", "focus", "creative", "energy", "cinematic", "nature"] as const;
export type Mood = (typeof MOODS)[number];
export type MoodFilter = Mood | "all";

export const MOOD_LABEL: Record<MoodFilter, string> = {
  calm: "Calm",
  dreamy: "Dreamy",
  focus: "Focus",
  creative: "Creative",
  energy: "Energy",
  cinematic: "Cinematic",
  nature: "Nature",
  all: "All",
};

export type Energy = "low" | "medium" | "high";

export interface Track {
  id: string;
  title: string;
  artist: string;
  collection?: string;
  /** Seconds. */
  duration: number;
  moods: readonly Mood[];
  genre?: string;
  energy: Energy;
  instrumental: boolean;
  license: string;
  licenseUrl: string;
  /** The exact credit the license asks for, when it asks for one. */
  attribution?: string;
  source: string;
  /** Where the licensed file comes from; the server mirrors it and checks `sha256`. */
  sourceUrl: string;
  infoUrl?: string;
  sha256: string;
  bytes: number;
}
