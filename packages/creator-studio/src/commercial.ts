import { channelLabels, LICENSE_USES } from "./licensing-options";

/**
 * Commercial rights preparation (P1-17). Client-safe. Wonder Creator never concludes that something is "cleared" for
 * commercial use: readiness is a list of facts from the creator's own records, each either recorded or worth checking.
 */

export const COMMERCIAL_USE = [
  { value: "not_offered", label: "Not offered", note: "Commercial license requests are turned away" },
  { value: "on_request", label: "On request", note: "People can ask; you decide each time" },
  { value: "open", label: "Open to licensing", note: "Shown as available for commercial licensing" },
] as const;
export type CommercialUse = (typeof COMMERCIAL_USE)[number]["value"];
export const commercialUseLabel = (v: string) => COMMERCIAL_USE.find((c) => c.value === v)?.label ?? "On request";

export const READINESS_NOTE = "These are facts from your records, not legal advice. Whether a use is allowed depends on your agreements and the law where you are.";

export interface ReadinessInput {
  ownershipKind: string;
  owners: Array<{ name: string; sharePercent: number }>;
  copyrightHolder: string;
  commercialUse: string;
  commercialChannels: string[];
  contributors: number;
  outsideMaterials: number;
  derivedFrom: string | null;
  licenses: Array<{ license_type: string; exclusive: boolean; status: string; territory: string; ends_on: string | null; licensee_name: string | null; usage_channels?: string[] | null }>;
  today?: string;
}

export interface ReadinessItem {
  key: string;
  state: "recorded" | "check";
  label: string;
  detail: string;
}

export function commercialReadiness(i: ReadinessInput): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  const total = Math.round(i.owners.reduce((s, o) => s + Number(o.sharePercent), 0) * 100) / 100;
  const who = i.owners.map((o) => `${o.name} (${Number(o.sharePercent)}%)`).join(", ");
  if (i.ownershipKind === "transferred") items.push({ key: "ownership", state: "check", label: "Ownership was transferred", detail: `Recorded owners: ${who || "none"}. Only the current owner can offer licenses.` });
  else if (total !== 100 || !i.owners.length) items.push({ key: "ownership", state: "check", label: "Ownership isn't complete", detail: "Owners' shares should add up to 100%." });
  else if (i.owners.length > 1) items.push({ key: "ownership", state: "check", label: `${i.owners.length} owners recorded`, detail: `${who}. Everyone who owns it should agree to commercial terms.` });
  else items.push({ key: "ownership", state: "recorded", label: "Ownership recorded", detail: who });

  items.push(
    i.copyrightHolder.trim()
      ? { key: "copyright", state: "recorded", label: "Copyright holder named", detail: i.copyrightHolder }
      : { key: "copyright", state: "check", label: "No copyright holder named", detail: "Name who holds the copyright." },
  );
  if (i.contributors > 0) {
    items.push({ key: "contributors", state: "check", label: `${i.contributors} ${i.contributors === 1 ? "contributor" : "contributors"}`, detail: "Their credit and anything you agreed with them travel with commercial use." });
  }
  if (i.outsideMaterials > 0) {
    items.push({
      key: "materials",
      state: "check",
      label: `${i.outsideMaterials} ${i.outsideMaterials === 1 ? "Material" : "Materials"} from outside sources`,
      detail: "Links and imports keep their own rights. Make sure you may use them commercially.",
    });
  }
  if (i.derivedFrom) items.push({ key: "derived", state: "check", label: "Made from another Creation", detail: `“${i.derivedFrom}” — its rights and licenses apply too.` });

  const today = i.today ?? new Date().toISOString().slice(0, 10);
  const exclusive = i.licenses.filter((l) => l.status === "active" && l.exclusive && (!l.ends_on || l.ends_on >= today));
  for (const l of exclusive.slice(0, 3)) {
    const use = LICENSE_USES.find((u) => u.value === l.license_type)?.label ?? l.license_type;
    const channels = l.usage_channels?.length ? ` · ${channelLabels(l.usage_channels).join(", ")}` : "";
    items.push({
      key: `exclusive-${items.length}`,
      state: "check",
      label: `Exclusive ${use.toLowerCase()} license active`,
      detail: `${l.licensee_name ? `For ${l.licensee_name} · ` : ""}${l.territory}${channels}${l.ends_on ? ` · until ${l.ends_on}` : ""}. It may limit what else you can offer.`,
    });
  }
  items.push({
    key: "stance",
    state: "recorded",
    label: `Commercial use: ${commercialUseLabel(i.commercialUse)}`,
    detail: i.commercialChannels.length ? `Open to ${channelLabels(i.commercialChannels).join(", ")}` : i.commercialUse === "not_offered" ? "Commercial requests are turned away." : "Any channel, case by case.",
  });
  return items;
}
