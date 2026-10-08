import { DomainError } from "@wonder/core";
import { saveAbout, saveBoundaries, saveIdentity, saveVoice } from "@wonder/creator-identity";
import { readJson, withApi } from "@/lib/api";
import { seedProfileMemories } from "@/lib/profile-memories";

/** Settings edits (never touch onboarding progress). Identity, style and boundaries also teach Creative Memory (profile-memories.ts). */
export const PUT = withApi<{ section: string }>(async ({ db, creatorId, req }, { section }) => {
  const body = await readJson(req);
  switch (section) {
    case "about":
      await saveAbout(db, creatorId, body);
      break;
    case "identity":
      await saveIdentity(db, creatorId, body);
      break;
    case "style":
      await saveVoice(db, creatorId, body);
      break;
    case "boundaries":
      await saveBoundaries(db, creatorId, body);
      break;
    default:
      throw new DomainError("not_found", "Unknown section.");
  }
  if (section !== "about") await seedProfileMemories(db, creatorId);
  return { ok: true };
});
