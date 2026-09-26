import { listMemories } from "@wonder/creator-brain";
import { PageTitle } from "@wonder/ui";
import { requireSession } from "@/lib/session";
import { MemoryView } from "./memory-view";

export const metadata = { title: "Creative Memory" };

export default async function MemoryPage() {
  const { db } = await requireSession();
  const memories = await listMemories(db);
  return (
    <div>
      <PageTitle title="Creative Memory" subtitle="What Wonder Creator remembers about your creative practice — and why. You can edit or remove anything." />
      <MemoryView
        initial={memories.map((m) => ({ id: m.id, category: m.category, statement: m.statement, sourceKind: m.source_kind, sourceLabel: m.source_label, createdAt: m.created_at, lastUsedAt: m.last_used_at }))}
      />
    </div>
  );
}
