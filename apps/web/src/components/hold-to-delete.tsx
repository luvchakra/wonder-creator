"use client";
import { ConfirmDialog } from "@wonder/ui";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import { forget } from "@/components/nav-memory";

/**
 * Press and hold a card to delete it (owner, 4 Oct 2026: "long press the items here to delete them"). The hold — or a
 * right-click / the keyboard's context-menu key — asks first, because deleting can't be undone; a tap still opens the
 * card. The server decides who may delete (RLS); this only asks.
 */
const HOLD_MS = 550;
const SLOP = 10;

export function HoldToDelete({ kind, id, title, children }: { kind: "material" | "creation"; id: string; title: string; children: React.ReactNode }) {
  const router = useRouter();
  const hint = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const held = useRef(false);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  const ask = () => {
    setError(null);
    setOpen(true);
  };

  async function remove() {
    setBusy(true);
    try {
      await api(kind === "material" ? `/api/v1/materials/${id}?confirm=true` : `/api/v1/artifacts/${id}?confirm=true`, { method: "DELETE" });
      forget(kind === "material" ? `/materials/${id}` : `/creations/${id}`);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const name = title.trim() || "Untitled";
  return (
    <div
      aria-describedby={hint}
      className="select-none [-webkit-touch-callout:none]"
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        held.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(() => {
          held.current = true;
          timer.current = null;
          navigator.vibrate?.(12);
          ask();
        }, HOLD_MS);
      }}
      onPointerMove={(e) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > SLOP) cancel();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      // A hold ends in a click on the card's link; it mustn't open the card.
      onClickCapture={(e) => {
        if (held.current) {
          e.preventDefault();
          e.stopPropagation();
          held.current = false;
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        cancel();
        ask();
      }}
    >
      {children}
      <span id={hint} className="sr-only">
        Press and hold, or open the context menu, to delete.
      </span>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive
        busy={busy}
        title={`Delete “${name}”?`}
        body={
          error ??
          (kind === "material"
            ? "The original and its details are removed. Creations made from it keep their words but lose this source. This can't be undone."
            : "All its versions, lineage and rights records are removed. The Materials it was made from stay. This can't be undone.")
        }
        confirmLabel="Delete"
        onConfirm={() => void remove()}
      />
    </div>
  );
}
