"use client";
import Link from "next/link";
import { api } from "@/lib/client";

export type CommunityKind = "conversation" | "conversation_reply" | "scrapbook_entry";
export interface StudioNote {
  text: string;
  href: string;
  link: string;
}

/**
 * "Bring to Studio" / "Use in Studio" / "Use as inspiration" from Community (Phase 04 §6): puts it on the Working Table
 * of the Studio the creator was last in — Available, by reference, keeping who said it. With no Studio open yet, it
 * says where to start one instead.
 */
export async function bringToStudio(type: CommunityKind, id: string): Promise<StudioNote> {
  const { session } = await api<{ session: { id: string; artifactId: string } | null }>("/api/v1/studio-sessions/active");
  if (!session) return { text: "Open a Creation in Creative Studio first, then bring this in.", href: "/materials?tab=creations", link: "Your Creations" };
  await api(`/api/v1/studio-sessions/${session.id}/sources/from-community`, { method: "POST", json: { type, id } });
  return { text: "On your Working Table.", href: `/creations/${session.artifactId}/studio`, link: "Open Studio" };
}

export function StudioNoteLine({ note }: { note: StudioNote | null }) {
  if (!note) return null;
  return (
    <p role="status" className="flex flex-wrap items-center gap-x-2 rounded-2xl bg-accent-softer px-3 py-1.5 text-[13px] text-ink">
      {note.text}
      <Link href={note.href} className="inline-flex min-h-9 items-center font-medium text-accent-ink hover:underline">
        {note.link}
      </Link>
    </p>
  );
}
