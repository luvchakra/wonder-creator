"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client";

type Requested = { parent: { id: string } | null; jobs: Array<{ id: string; connectionId: string | null; status: string }> };
const ACTIVE = new Set(["queued", "running", "paused"]);

/**
 * Start a sync and follow it at a restrained cadence (spec §9: never tie the UI to it). The page stays usable the
 * whole time; when the work settles the screen refreshes to show what was found.
 */
export function useSync(opts: { activeJobIds?: string[]; onSettled?: () => void } = {}) {
  const router = useRouter();
  const [jobIds, setJobIds] = useState<string[]>(opts.activeJobIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const settled = useRef(opts.onSettled);
  useEffect(() => {
    settled.current = opts.onSettled;
  });

  useEffect(() => {
    if (!jobIds.length) return;
    let stop = false;
    let delay = 2000;
    const tick = async () => {
      if (stop) return;
      try {
        const states = await Promise.all(jobIds.map((id) => api<{ job: { status: string } }>(`/api/v1/personal-sources/sync/${id}`).then((r) => r.job.status)));
        if (stop) return;
        if (!states.some((s) => ACTIVE.has(s))) {
          setJobIds([]);
          settled.current?.();
          router.refresh();
          return;
        }
      } catch {
        // A blip: try again a little later.
      }
      delay = Math.min(delay * 1.4, 8000);
      timer = setTimeout(tick, delay);
    };
    let timer = setTimeout(tick, delay);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [jobIds, router]);

  const start = useCallback(async (connectionId?: string) => {
    setError(null);
    setStarting(true);
    try {
      const r = await api<Requested>("/api/v1/personal-sources/sync", { method: "POST", json: connectionId ? { connectionId } : {} });
      const ids = r.jobs.filter((j) => ACTIVE.has(j.status)).map((j) => j.id);
      if (ids.length) setJobIds(ids);
      else setError("Nothing to sync yet — connect a source first.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setStarting(false);
    }
  }, []);

  const cancel = useCallback(async () => {
    await Promise.all(jobIds.map((id) => api(`/api/v1/personal-sources/sync/${id}/cancel`, { method: "POST" }).catch(() => undefined)));
    setJobIds([]);
    router.refresh();
  }, [jobIds, router]);

  return { syncing: jobIds.length > 0, starting, error, start, cancel };
}
