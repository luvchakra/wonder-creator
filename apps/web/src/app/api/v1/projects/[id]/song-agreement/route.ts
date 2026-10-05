import { proposeSong, songAgreement } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** The Room's credits and shares (step 5a): the open proposal or the agreed one, with who has signed off. */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => ({ agreement: await songAgreement(db, requireUuid(id, "Room")) }));

/** Propose them — the Room's owner or admins, once every part is final. Equal shares unless `shares` says otherwise. */
export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => ({ id: await proposeSong(db, requireUuid(id, "Room"), await readJson(req, 20_000)) }));
