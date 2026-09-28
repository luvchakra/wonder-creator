import { listIntake } from "@wonder/creator-send";
import { PageTitle, KIT } from "@wonder/ui";
import { intakeViews } from "@/lib/intake-view";
import { requireSession } from "@/lib/session";
import { SendInbox } from "./inbox";

export const metadata = { title: "CreatorSend" };

export default async function SendPage() {
  const { db } = await requireSession();
  const views = await intakeViews(db, await listIntake(db, { limit: 40 }));
  return (
    <div>
      <PageTitle art={KIT.painted.lavenderSprig} title="CreatorSend" subtitle="Drop, upload, paste or record anything. We'll help you turn it into creative material." />
      <SendInbox initial={views} />
    </div>
  );
}
