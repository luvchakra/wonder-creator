"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Recording from the device microphone, shared by Quick Capture's voice note and the Audio page (creation-pages.md,
 * step 3). Starts as soon as it's mounted; a live level is drawn straight onto `levelRef` (no re-render per frame);
 * stops itself at `maxSeconds`. The recording stays in memory until the caller keeps it.
 */
export type RecorderState =
  | { phase: "starting" }
  | { phase: "recording" }
  | { phase: "recorded"; blob: Blob; url: string; seconds: number }
  | { phase: "blocked"; message: string };

export const MAX_RECORD_SECONDS = 20 * 60;
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function useAudioRecorder({ maxSeconds = MAX_RECORD_SECONDS, fallback = "write a quick note instead" }: { maxSeconds?: number; fallback?: string } = {}) {
  const [state, setState] = useState<RecorderState>({ phase: "starting" });
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const levelRef = useRef<HTMLSpanElement>(null);
  const startedAt = useRef(0);
  const release = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let tick: ReturnType<typeof setInterval> | undefined;
    let ctx: AudioContext | null = null;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setState({ phase: "blocked", message: `This browser can't record audio. Try another browser, or ${fallback}.` });
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported?.(t));
        const r = new MediaRecorder(s, type ? { mimeType: type } : undefined);
        const chunks: Blob[] = [];
        r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        r.onstop = () => {
          const blob = new Blob(chunks, { type: r.mimeType || type || "audio/webm" });
          const secs = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
          release();
          setState({ phase: "recorded", blob, url: URL.createObjectURL(blob), seconds: secs });
        };
        rec.current = r;
        startedAt.current = Date.now();
        r.start(250);
        setState({ phase: "recording" });
        tick = setInterval(() => {
          const secs = Math.floor((Date.now() - startedAt.current) / 1000);
          setSeconds(secs);
          if (secs >= maxSeconds && r.state === "recording") r.stop();
        }, 250);
        try {
          ctx = new AudioContext();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          ctx.createMediaStreamSource(s).connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const draw = () => {
            analyser.getByteTimeDomainData(data);
            let peak = 0;
            for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
            if (levelRef.current) levelRef.current.style.transform = `scaleX(${Math.min(1, 0.06 + peak / 70).toFixed(3)})`;
            raf = requestAnimationFrame(draw);
          };
          draw();
        } catch {
          /* no meter; recording still works */
        }
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        setState({
          phase: "blocked",
          message:
            name === "NotAllowedError" || name === "SecurityError"
              ? `Microphone access is off. Allow it for this site in your browser, or ${fallback}.`
              : name === "NotFoundError"
                ? `No microphone was found. Connect one, or ${fallback}.`
                : `The microphone couldn't start. Try again, or ${fallback}.`,
        });
      }
    })();
    return () => {
      cancelled = true;
      if (tick) clearInterval(tick);
      cancelAnimationFrame(raf);
      void ctx?.close().catch(() => undefined);
      if (rec.current?.state === "recording") {
        rec.current.onstop = null;
        rec.current.stop();
      }
      release();
    };
  }, [release, maxSeconds, fallback]);

  const stop = useCallback(() => {
    if (rec.current?.state === "recording") rec.current.stop();
  }, []);
  return { state, seconds, levelRef, stop };
}

/**
 * Keep a recording as a voice Material through Quick Capture's endpoint (exactly once per `clientId`; transcription
 * follows when the provider is live). Progress is reported so a slow upload shows movement.
 */
export function uploadRecording(rec: { blob: Blob; seconds: number }, clientId: string, onProgress: (pct: number | null) => void): Promise<{ materialId: string | null }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.set("clientId", clientId);
    form.set("seconds", String(rec.seconds));
    form.set("file", new File([rec.blob], "voice-note", { type: rec.blob.type }));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/v1/capture");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      onProgress(null);
      let body: { materialId?: string | null; error?: { message?: string } } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* handled below */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve({ materialId: body.materialId ?? null });
      else reject(new Error(`${body.error?.message ?? "We couldn't save it."} Your recording is still here — try again.`));
    };
    xhr.onerror = () => {
      onProgress(null);
      reject(new Error(navigator.onLine ? "The connection dropped. Your recording is still here — try again." : "You're offline. Your recording is still here — save it when you're back online."));
    };
    xhr.send(form);
  });
}
