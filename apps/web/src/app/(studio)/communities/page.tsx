import { redirect } from "next/navigation";

/** /communities — the list lives in Explore › Pulse › Communities (docs/communities.md). */
export default function CommunitiesIndex() {
  redirect("/pulse?filter=communities");
}
