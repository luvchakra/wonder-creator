import { listIntake } from "@wonder/creator-send";
import { PageTitle } from "@wonder/ui";
import { requireSession } from "@/lib/session";
import { SendInbox } from "./inbox";

export const metadata = { title: "CreatorSend" };

export default async function SendPage() {
  const { db } = await requireSession();
  const items = await listIntake(db, { limit: 40 });
  return (
    <div>
      <PageTitle title="CreatorSend" subtitle="Drop, upload, paste or record anything. We'll help you turn it into creative material." />
      <SendInbox
        initial={items.map((i) => ({
          id: i.id,
          state: i.state,
          kind: i.input_kind,
          error: i.error_message,
          createdAt: i.created_at,
          material: i.creative_materials as { id: string; title: string | null; type: string } | null,
        }))}
      />
    </div>
  );
}
