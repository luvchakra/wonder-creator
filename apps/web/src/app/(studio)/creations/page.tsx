import { redirect } from "next/navigation";

/** /creations — your Creations live in Materials › Creations (and old /artifacts links land here). */
export default function CreationsIndex() {
  redirect("/materials?tab=creations");
}
