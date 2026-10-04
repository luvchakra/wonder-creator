import "server-only";
import { DEFAULT_ORNAMENT, isOrnament, type OrnamentKind } from "@wonder/ui";
import { cookies } from "next/headers";

/** The creator's chosen separator for header and footer (Settings › Preferences), kept on the device in a cookie. */
export const ORNAMENT_COOKIE = "wc-ornament";

export async function ornamentPreference(): Promise<OrnamentKind> {
  const v = (await cookies()).get(ORNAMENT_COOKIE)?.value;
  return isOrnament(v) ? v : DEFAULT_ORNAMENT;
}
