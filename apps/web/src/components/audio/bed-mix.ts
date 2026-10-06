"use client";
import { BED_FADE_SECONDS, bedLength, type AudioBed } from "@wonder/creator-studio/audio";
import { encodeWav } from "@/lib/wav";
import { stretch } from "./time-stretch";

/**
 * The take with its background music, mixed on the creator's device (owner, 6 Oct 2026): the music trimmed, at its
 * tempo (pitch kept), at its level, faded in and out, under the voice — one WAV. Nothing is mixed on the server. Long
 * pieces are written at a lower sample rate so the file stays within the upload limit (50 MB).
 */
const LIMIT_BYTES = 45 * 1024 * 1024;
const FADE_IN = 0.25;

async function decode(url: string, rate: number): Promise<AudioBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("We couldn't load the audio. Try again.");
  return new OfflineAudioContext(1, 1, rate).decodeAudioData(await res.arrayBuffer());
}

/** Seconds of the finished mix: the take or the music, whichever runs longer. */
export const mixSeconds = (takeSeconds: number, bed: Pick<AudioBed, "from" | "to" | "tempo">) => Math.max(takeSeconds, bedLength(bed));

export async function renderBedMix(input: { takeUrl: string; musicUrl: string; bed: Pick<AudioBed, "from" | "to" | "tempo" | "level">; takeSeconds: number }): Promise<{ blob: Blob; seconds: number }> {
  const guess = mixSeconds(input.takeSeconds, input.bed) + 1;
  const rate = [44_100, 32_000, 22_050].find((r) => guess * r * 4 < LIMIT_BYTES) ?? 16_000;
  const [take, music] = await Promise.all([decode(input.takeUrl, rate), decode(input.musicUrl, rate)]);

  // The music: trimmed, then stretched to its tempo.
  const from = Math.floor(Math.max(0, input.bed.from) * rate);
  const to = Math.min(music.length, Math.floor(input.bed.to * rate));
  const cut = Array.from({ length: Math.min(2, music.numberOfChannels) }, (_, c) => music.getChannelData(c).slice(from, Math.max(from, to)));
  const bed = stretch(cut.length === 1 ? [cut[0]!, cut[0]!] : cut, input.bed.tempo, rate);
  const bedLen = bed[0]?.length ?? 0;

  const length = Math.max(take.length, bedLen);
  const out = [new Float32Array(length), new Float32Array(length)];
  for (let c = 0; c < 2; c++) {
    const voice = take.getChannelData(Math.min(c, take.numberOfChannels - 1));
    out[c]!.set(voice);
  }
  const fadeIn = Math.max(1, Math.floor(FADE_IN * rate));
  const fadeOut = Math.max(1, Math.min(Math.floor(BED_FADE_SECONDS * rate), Math.floor(bedLen / 2)));
  for (let i = 0; i < bedLen; i++) {
    const g = input.bed.level * Math.min(1, i / fadeIn, (bedLen - i) / fadeOut);
    out[0]![i]! += bed[0]![i]! * g;
    out[1]![i]! += bed[1]![i]! * g;
  }
  // Never clip: bring the whole mix down if its peak goes over.
  let peak = 0;
  for (const ch of out) for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(ch[i]!));
  if (peak > 0.98) {
    const k = 0.98 / peak;
    for (const ch of out) for (let i = 0; i < length; i++) ch[i]! *= k;
  }
  return { blob: new Blob([encodeWav(out, rate)], { type: "audio/wav" }), seconds: length / rate };
}
