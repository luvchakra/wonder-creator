"use client";
import { cn } from "@wonder/ui";
import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { errorMessage } from "@/lib/client";
import { shrinkImage, uploadError } from "@/lib/shrink-image";

/** Owner and moderators: change the community's profile picture (a small camera on the avatar). */
export function CommunityAvatarButton({ communityId, className }: { communityId: string; className?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", await shrinkImage(file));
      const res = await fetch(`/api/v1/communities/${communityId}/avatar`, { method: "POST", body });
      if (!res.ok) throw new Error(await uploadError(res, "We couldn't save that picture."));
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <>
      <input ref={input} id="community-avatar-file" type="file" accept="image/*" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label="Change the community's picture"
        className={cn("inline-flex size-11 items-center justify-center rounded-full", className)}
      >
        <span className={cn("grid size-8 place-items-center rounded-full bg-white text-ink shadow-md ring-1 ring-black/5", busy && "animate-pulse")}>
          <Camera className="size-4" aria-hidden />
        </span>
      </button>
      {error ? (
        <span role="alert" className="sr-only">
          {error}
        </span>
      ) : null}
    </>
  );
}
