"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Live dictation into a text field, using the browser's own speech-to-text (Web Speech API). Nothing is recorded or
 * uploaded by us: words appear as the browser recognises them and the creator can keep typing around them. Browsers
 * without it get an honest notice instead. Used by Quick Capture's note and the universal composer.
 */
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function getSpeech(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const DICTATION_UNAVAILABLE = "Dictation isn't available in this browser. You can type, or record a voice note instead.";
export const DICTATION_LISTENING = "Listening… your browser turns speech into text.";
export const DICTATION_BLOCKED = "Microphone access was blocked. You can allow it in your browser settings.";

/**
 * `toggle(current)` starts listening and appends what's said after `current` (calling `setText` as words arrive), or
 * stops if already listening. `stop()` ends it and drops words still arriving: call it when the creator types or saves.
 */
export function useDictation(setText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const rec = useRef<SpeechRecognitionLike | null>(null);

  // Stopping ignores any words still on their way, so text typed after stopping is never overwritten.
  const stop = useCallback(() => {
    if (!rec.current) return;
    rec.current.onresult = null;
    rec.current.stop();
  }, []);

  useEffect(() => stop, [stop]);

  const toggle = useCallback(
    (current: string) => {
      if (rec.current) {
        // Tapping the mic again keeps the last words the browser is still finishing.
        rec.current.stop();
        return;
      }
      const Speech = getSpeech();
      if (!Speech) {
        setNotice(DICTATION_UNAVAILABLE);
        return;
      }
      const r = new Speech();
      r.continuous = true;
      r.interimResults = true;
      r.lang = navigator.language || "en-US";
      const base = current.trim() ? `${current.trimEnd()} ` : "";
      let finalText = "";
      r.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        setText(base + `${finalText}${interim}`.trim());
      };
      r.onend = () => {
        if (rec.current === r) rec.current = null;
        setListening(false);
        setNotice((n) => (n === DICTATION_LISTENING ? null : n));
      };
      r.onerror = (e) => {
        if (rec.current === r) rec.current = null;
        setListening(false);
        setNotice(e.error === "not-allowed" || e.error === "service-not-allowed" ? DICTATION_BLOCKED : null);
      };
      rec.current = r;
      try {
        r.start();
      } catch {
        rec.current = null;
        setNotice(DICTATION_UNAVAILABLE);
        return;
      }
      setListening(true);
      setNotice(DICTATION_LISTENING);
    },
    [setText],
  );

  return { listening, notice, toggle, stop };
}
