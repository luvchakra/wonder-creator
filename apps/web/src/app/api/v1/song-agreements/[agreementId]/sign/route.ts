import { signSong } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Sign off on the credits and shares, or object with what you'd change — only the people credited. */
export const POST = withApi<{ agreementId: string }>(async ({ db, req }, { agreementId }) => ({ status: await signSong(db, requireUuid(agreementId, "Agreement"), await readJson(req, 5_000)) }));
