"use client";
import { ORNAMENTS, ORNAMENT_LABEL, Ornament, cn, type OrnamentKind } from "@wonder/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setDeviceCookie } from "@/lib/device-cookie";

/**
 * The separator under the top bar, chosen from Roman architecture (owner, 4 Oct 2026). Kept on this device (a cookie the
 * server reads, so the page renders with it at once); nothing about it is private.
 */
export function OrnamentPicker({ initial }: { initial: OrnamentKind }) {
  const router = useRouter();
  const [value, setValue] = useState<OrnamentKind>(initial);
  function choose(k: OrnamentKind) {
    setValue(k);
    setDeviceCookie("wc-ornament", k);
    router.refresh();
  }
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">Ornament</p>
      <p className="-mt-1.5 mb-2 text-[12.5px] text-ink-subtle">The line under the top bar, after Roman architecture.</p>
      <div role="radiogroup" aria-label="Ornament" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {ORNAMENTS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            onClick={() => choose(k)}
            className={cn("flex min-h-14 flex-col justify-center gap-2 rounded-xl border px-3 py-2 text-left", value === k ? "border-accent bg-accent-softer" : "border-border-soft hover:border-accent/50")}
          >
            <Ornament kind={k} className="text-ink/40" />
            <span className="text-[12.5px] font-medium text-ink">{ORNAMENT_LABEL[k]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
