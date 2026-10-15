"use client";
import { Button, Select } from "@wonder/ui";
import { UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

export type RoomChoice = { id: string; title: string; own: boolean; community: boolean };

/**
 * "Add to a Creative Room" (P1-01) for one Material or Creation: the Rooms it's in, as links, and one picker to add it to
 * another. In a Room someone else owns, it goes in shared with the crew (the database refuses anything else). Removing
 * stays in the Room, where the link lives.
 */
export function AddToRoom({ kind, itemId, rooms, inRooms }: { kind: "material" | "artifact"; itemId: string; rooms: RoomChoice[]; inRooms: string[] }) {
  const router = useRouter();
  const [inSet, setInSet] = useState(() => new Set(inRooms));
  const member = rooms.filter((r) => inSet.has(r.id));
  const addable = rooms.filter((r) => !inSet.has(r.id));
  const [room, setRoom] = useState(addable[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const href = (r: RoomChoice) => (r.community ? `/communities/${r.id}` : `/rooms/${r.id}`);

  async function add() {
    const r = addable.find((x) => x.id === room);
    if (!r) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await api(`/api/v1/projects/${r.id}/items`, { method: "POST", json: { kind, ids: [itemId], shared: !r.own } });
      const next = new Set(inSet).add(r.id);
      setInSet(next);
      setRoom(rooms.find((x) => !next.has(x.id))?.id ?? "");
      setMsg(r.own ? `Added to ${r.title}.` : `Added to ${r.title}, shared with its crew.`);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {member.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="In Creative Rooms">
          {member.map((r) => (
            <li key={r.id}>
              <Link href={href(r)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface-muted px-3 text-[13px] text-ink hover:bg-accent-softer">
                <UsersRound className="size-3.5 text-ink-subtle" aria-hidden /> {r.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-muted">Not in a Creative Room yet.</p>
      )}
      {addable.length ? (
        <div className="flex gap-2">
          <label htmlFor={`room-${itemId}`} className="sr-only">
            Creative Room
          </label>
          <Select id={`room-${itemId}`} value={room} onChange={(e) => setRoom(e.target.value)}>
            {addable.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
                {r.own ? "" : " · shared with the crew"}
              </option>
            ))}
          </Select>
          <Button variant="secondary" loading={busy} disabled={!room} onClick={add}>
            Add<span className="sr-only"> to the Creative Room</span>
          </Button>
        </div>
      ) : rooms.length ? null : (
        <Link href="/rooms" className="inline-flex min-h-11 items-center text-[13px] font-medium text-accent-ink hover:underline">
          Start a Creative Room
        </Link>
      )}
      {msg ? (
        <p role="status" className="text-[13px] text-ink-muted">
          {msg}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
