"use client";
import { Button, ConfirmDialog, Menu, MenuContent, MenuItem, MenuTrigger, buttonClasses } from "@wonder/ui";
import { Ban, MoreHorizontal, Radio, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client";

export function ProfileActions({ creatorId, following, myLiveHuddleId }: { creatorId: string; following: boolean; myLiveHuddleId: string | null }) {
  const router = useRouter();
  const [f, setF] = useState(following);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          variant={f ? "secondary" : "primary"}
          onClick={async () => {
            try {
              await api(`/api/v1/creators/${creatorId}/follow`, { method: "POST", json: { on: !f } });
              setF(!f);
            } catch (e) {
              setMsg(errorMessage(e));
            }
          }}
        >
          <UserPlus className="size-4" aria-hidden /> {f ? "Following" : "Follow"}
        </Button>
        {myLiveHuddleId ? (
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await api(`/api/v1/huddles/${myLiveHuddleId}/invite`, { method: "POST", json: { creatorId } });
                setMsg("Invited to your Huddle.");
              } catch (e) {
                setMsg(errorMessage(e));
              }
            }}
          >
            <Radio className="size-4" aria-hidden /> Invite to Huddle
          </Button>
        ) : null}
        <Menu>
          <MenuTrigger className={buttonClasses({ variant: "ghost", className: "px-3" })} aria-label="More">
            <MoreHorizontal className="size-5" aria-hidden />
          </MenuTrigger>
          <MenuContent>
            <MenuItem destructive onSelect={() => setConfirmBlock(true)}>
              <Ban className="size-4" aria-hidden /> Block
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      {msg ? (
        <p role="status" className="text-sm text-ink-muted">
          {msg}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirmBlock}
        onOpenChange={setConfirmBlock}
        destructive
        title="Block this creator?"
        body="They won't see your profile, find your Huddles or ask to join them. You can unblock in Settings."
        confirmLabel="Block"
        onConfirm={async () => {
          try {
            await api(`/api/v1/creators/${creatorId}/block`, { method: "POST", json: { on: true } });
            router.push("/");
          } catch (e) {
            setMsg(errorMessage(e));
          }
          setConfirmBlock(false);
        }}
      />
    </div>
  );
}
