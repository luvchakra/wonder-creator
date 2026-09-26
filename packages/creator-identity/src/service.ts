import { audit, DomainError, fromDbError, must, publishEvent } from "@wonder/core";
import type { Db, Tables } from "@wonder/db";
import type { AutonomyDomain, AutonomyLevel } from "./autonomy";
import { clampLevel, DEFAULT_AUTONOMY } from "./autonomy";
import {
  aboutSchema,
  boundariesSchema,
  identitySchema,
  normalizeTags,
  profileSettingsSchema,
  voiceSchema,
  type OnboardingStep,
} from "./schemas";

export type Creator = Tables<"creators">;
export type VoiceProfile = Tables<"creator_voice_profiles">;

export interface CreatorIdentity {
  creator: Creator;
  disciplines: string[];
  skills: string[];
  languages: string[];
  interests: string[];
}

type FacetTable = "creator_disciplines" | "creator_skills" | "creator_languages" | "creator_interests";

async function readFacet(db: Db, table: FacetTable, creatorId: string): Promise<string[]> {
  const { data, error } = await db.from(table).select("value, position").eq("creator_id", creatorId).order("position");
  if (error) throw fromDbError(error);
  return (data ?? []).map((r) => r.value);
}

async function replaceFacet(db: Db, table: FacetTable, creatorId: string, values: string[]): Promise<void> {
  const clean = normalizeTags(values);
  const del = await db.from(table).delete().eq("creator_id", creatorId);
  if (del.error) throw fromDbError(del.error);
  if (clean.length) {
    const ins = await db.from(table).insert(clean.map((value, position) => ({ creator_id: creatorId, value, position })));
    if (ins.error) throw fromDbError(ins.error);
  }
}

export async function getCreatorByUser(db: Db, userId: string): Promise<Creator | null> {
  const { data, error } = await db.from("creators").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw fromDbError(error);
  return data;
}

export async function getIdentity(db: Db, creatorId: string): Promise<CreatorIdentity> {
  const creator = must(await db.from("creators").select("*").eq("id", creatorId).maybeSingle(), "Creator not found.");
  const [disciplines, skills, languages, interests] = await Promise.all([
    readFacet(db, "creator_disciplines", creatorId),
    readFacet(db, "creator_skills", creatorId),
    readFacet(db, "creator_languages", creatorId),
    readFacet(db, "creator_interests", creatorId),
  ]);
  return { creator, disciplines, skills, languages, interests };
}

export async function getCreatorByHandle(db: Db, handle: string): Promise<CreatorIdentity | null> {
  const { data, error } = await db.from("creators").select("id").eq("handle", handle.toLowerCase()).maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) return null;
  return getIdentity(db, data.id);
}

async function ensureHandleAvailable(db: Db, creatorId: string, handle: string) {
  const { data, error } = await db.rpc("handle_available", { p_handle: handle });
  if (error) throw fromDbError(error);
  if (!data) {
    const own = await db.from("creators").select("handle").eq("id", creatorId).maybeSingle();
    if (own.data?.handle !== handle) throw new DomainError("conflict", "That handle is taken. Try another.");
  }
}

export async function setOnboardingStep(db: Db, creatorId: string, step: OnboardingStep | "complete") {
  const res = await db.from("creators").update({ onboarding_step: step }).eq("id", creatorId);
  if (res.error) throw fromDbError(res.error);
}

export async function saveAbout(db: Db, creatorId: string, raw: unknown) {
  const input = aboutSchema.parse(raw);
  await ensureHandleAvailable(db, creatorId, input.handle);
  const res = await db
    .from("creators")
    .update({
      display_name: input.displayName,
      handle: input.handle,
      bio: input.bio || null,
      location: input.location || null,
      show_location: input.showLocation,
    })
    .eq("id", creatorId);
  if (res.error) throw fromDbError(res.error);
  await replaceFacet(db, "creator_languages", creatorId, input.languages);
  await publishEvent(db, { type: "CreatorUpdated", aggregate: "creator", aggregateId: creatorId, payload: { section: "about" } });
}

export async function saveIdentity(db: Db, creatorId: string, raw: unknown) {
  const input = identitySchema.parse(raw);
  await replaceFacet(db, "creator_disciplines", creatorId, input.disciplines);
  await replaceFacet(db, "creator_skills", creatorId, input.skills);
  await replaceFacet(db, "creator_interests", creatorId, input.interests);
  await publishEvent(db, { type: "CreatorUpdated", aggregate: "creator", aggregateId: creatorId, payload: { section: "identity" } });
}

export async function getVoice(db: Db, creatorId: string): Promise<VoiceProfile | null> {
  const { data, error } = await db.from("creator_voice_profiles").select("*").eq("creator_id", creatorId).maybeSingle();
  if (error) throw fromDbError(error);
  return data;
}

export async function saveVoice(db: Db, creatorId: string, raw: unknown) {
  const v = voiceSchema.parse(raw);
  const res = await db.from("creator_voice_profiles").upsert({
    creator_id: creatorId,
    tones: normalizeTags(v.tones),
    formality: v.formality ?? null,
    writing_style: v.writingStyle ?? null,
    vocabulary: v.vocabulary ?? null,
    language_style: v.languageStyle ?? null,
    code_switching: v.codeSwitching ?? false,
    narrative_style: v.narrativeStyle ?? null,
    recurring_themes: normalizeTags(v.recurringThemes),
    visual_styles: normalizeTags(v.visualStyles),
    visual_moods: normalizeTags(v.visualMoods),
    color_preferences: normalizeTags(v.colorPreferences),
    composition_notes: v.compositionNotes ?? null,
    experimentation: v.experimentation ?? "balanced",
  });
  if (res.error) throw fromDbError(res.error);
  await publishEvent(db, { type: "CreatorUpdated", aggregate: "creator", aggregateId: creatorId, payload: { section: "voice" } });
}

export interface Boundaries {
  preserve: string[];
  avoid: string[];
  sensitive: string[];
}

export async function getBoundaries(db: Db, creatorId: string): Promise<Boundaries> {
  const { data, error } = await db.from("creator_boundaries").select("kind, label").eq("creator_id", creatorId).order("created_at");
  if (error) throw fromDbError(error);
  const pick = (k: string) => (data ?? []).filter((r) => r.kind === k).map((r) => r.label);
  return { preserve: pick("preserve"), avoid: pick("avoid"), sensitive: pick("sensitive") };
}

export async function saveBoundaries(db: Db, creatorId: string, raw: unknown) {
  const b = boundariesSchema.parse(raw);
  const del = await db.from("creator_boundaries").delete().eq("creator_id", creatorId).in("kind", ["preserve", "avoid", "sensitive"]);
  if (del.error) throw fromDbError(del.error);
  const rows = [
    ...normalizeTags(b.preserve).map((label) => ({ creator_id: creatorId, kind: "preserve", label })),
    ...normalizeTags(b.avoid).map((label) => ({ creator_id: creatorId, kind: "avoid", label })),
    ...normalizeTags(b.sensitive).map((label) => ({ creator_id: creatorId, kind: "sensitive", label })),
  ];
  if (rows.length) {
    const ins = await db.from("creator_boundaries").insert(rows);
    if (ins.error) throw fromDbError(ins.error);
  }
  await publishEvent(db, { type: "CreatorUpdated", aggregate: "creator", aggregateId: creatorId, payload: { section: "boundaries" } });
}

export async function getAutonomy(db: Db, creatorId: string): Promise<Record<AutonomyDomain, AutonomyLevel>> {
  const { data, error } = await db.from("creator_autonomy_policies").select("domain, level").eq("creator_id", creatorId);
  if (error) throw fromDbError(error);
  const out = { ...DEFAULT_AUTONOMY };
  for (const row of data ?? []) out[row.domain] = row.level;
  return out;
}

export async function setAutonomy(db: Db, creatorId: string, domain: AutonomyDomain, level: AutonomyLevel) {
  const clamped = clampLevel(domain, level);
  if (clamped !== level) {
    throw new DomainError("validation", "CreatorBrain can't act on its own here. The most it can do is ask for your approval.");
  }
  const res = await db.from("creator_autonomy_policies").update({ level }).eq("creator_id", creatorId).eq("domain", domain);
  if (res.error) throw fromDbError(res.error);
  await audit(db, { action: "autonomy.update", objectType: "creator_autonomy_policy", objectId: creatorId, metadata: { domain, level } });
}

export async function resetAutonomy(db: Db, creatorId: string) {
  for (const [domain, level] of Object.entries(DEFAULT_AUTONOMY) as Array<[AutonomyDomain, AutonomyLevel]>) {
    const res = await db.from("creator_autonomy_policies").update({ level }).eq("creator_id", creatorId).eq("domain", domain);
    if (res.error) throw fromDbError(res.error);
  }
  await audit(db, { action: "autonomy.reset", objectType: "creator_autonomy_policy", objectId: creatorId });
}

export async function saveProfileSettings(db: Db, creatorId: string, raw: unknown) {
  const p = profileSettingsSchema.parse(raw);
  await ensureHandleAvailable(db, creatorId, p.handle);
  const res = await db
    .from("creators")
    .update({
      display_name: p.displayName,
      handle: p.handle,
      bio: p.bio || null,
      location: p.location || null,
      show_location: p.showLocation,
      visibility: p.visibility,
      collaboration_availability: p.collaborationAvailability,
    })
    .eq("id", creatorId);
  if (res.error) throw fromDbError(res.error);
  await audit(db, { action: "profile.update", objectType: "creator", objectId: creatorId, metadata: { visibility: p.visibility } });
  await publishEvent(db, { type: "CreatorUpdated", aggregate: "creator", aggregateId: creatorId, payload: { section: "profile" } });
}

export async function setAvatar(db: Db, creatorId: string, storageObjectId: string | null) {
  const res = await db.from("creators").update({ avatar_object_id: storageObjectId }).eq("id", creatorId);
  if (res.error) throw fromDbError(res.error);
}

export async function follow(db: Db, creatorId: string, targetId: string, on: boolean) {
  if (creatorId === targetId) throw new DomainError("validation", "You can't follow yourself.");
  const res = on
    ? await db.from("creator_follows").upsert({ follower_creator_id: creatorId, followed_creator_id: targetId })
    : await db.from("creator_follows").delete().eq("follower_creator_id", creatorId).eq("followed_creator_id", targetId);
  if (res.error) throw fromDbError(res.error);
}

export async function block(db: Db, creatorId: string, targetId: string, on: boolean) {
  if (creatorId === targetId) throw new DomainError("validation", "You can't block yourself.");
  const res = on
    ? await db.from("creator_blocks").upsert({ blocker_creator_id: creatorId, blocked_creator_id: targetId })
    : await db.from("creator_blocks").delete().eq("blocker_creator_id", creatorId).eq("blocked_creator_id", targetId);
  if (res.error) throw fromDbError(res.error);
  await audit(db, { action: on ? "creator.block" : "creator.unblock", objectType: "creator", objectId: targetId });
}
