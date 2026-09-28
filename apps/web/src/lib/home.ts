import "server-only";
import { liveCards } from "@wonder/creator-huddle";
import { listPosts, signedUrlsFor } from "@wonder/creator-library";
import type { Db } from "@wonder/db";
import { avatarUrls } from "./avatars";
import { coverUrls } from "./covers";
import { pickSpark, splitHomeItems, SPARK_MIN_AGE_DAYS, type HomeItem } from "./home-sections";
import { listNotifications } from "./notifications";

const DAY = 86_400_000;

/**
 * Everything Home shows, read through the creator's RLS client. Marks this visit and uses the end of the previous one
 * for "You were last here" and "While you were away".
 */
export async function loadHome(db: Db, creatorId: string) {
  const now = Date.now();
  const visit = await db.rpc("mark_home_visit");
  const lastVisit = (visit.data as string | null) ?? null;
  const since = lastVisit ?? new Date(now - 3 * DAY).toISOString();

  const [current, notifications, visuals, oldImages, live, feed, materialCount] = await Promise.all([
    db.from("artifacts").select("id, title, artifact_type, status, updated_at, cover_material_id, current_version_id").eq("creator_id", creatorId).neq("status", "archived").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    listNotifications(db, creatorId).catch(() => []),
    // Visuals that finished while you were away.
    db.from("image_generations").select("id, artifact_id, completed_at, artifacts(title)").eq("creator_id", creatorId).in("status", ["complete", "partial"]).not("artifact_id", "is", null).gt("completed_at", since).order("completed_at", { ascending: false }).limit(3),
    // Your own older image Materials, for "A little spark".
    db
      .from("creative_materials")
      .select("id, title, created_at, storage_object_id")
      .eq("creator_id", creatorId)
      .eq("type", "image")
      .not("storage_object_id", "is", null)
      .lt("created_at", new Date(now - SPARK_MIN_AGE_DAYS * DAY).toISOString())
      .order("created_at", { ascending: false })
      .limit(60),
    liveCards(db, { limit: 1 }).catch(() => []),
    // Chronological, from people you follow — never ranked by replies or popularity.
    listPosts(db, creatorId, { scope: "following", creatorId }, { limit: 8 }).catch(() => ({ posts: [] })),
    db.from("creative_materials").select("id", { count: "exact", head: true }).eq("creator_id", creatorId),
  ]);

  const creation = current.data;
  const items: HomeItem[] = [
    ...notifications,
    ...(visuals.data ?? []).map((g) => ({
      id: `visuals:${g.id}`,
      kind: "visuals_ready",
      title: `Visuals for “${(g.artifacts as { title: string } | null)?.title ?? "your Creation"}” are ready`,
      href: `/artifacts/${g.artifact_id}`,
      at: g.completed_at!,
    })),
  ];
  const { away, asks } = splitHomeItems(items, lastVisit, now);
  const spark = pickSpark(oldImages.data ?? [], now);
  const post = feed.posts.find((p) => !p.mine) ?? null;
  const huddle = live[0] ?? null;

  const [covers, version, previews, avatars] = await Promise.all([
    creation ? coverUrls(db, [creation]) : Promise.resolve({} as Record<string, string>),
    creation?.current_version_id ? db.from("artifact_versions").select("version_number").eq("id", creation.current_version_id).maybeSingle() : Promise.resolve({ data: null }),
    signedUrlsFor(db, [spark?.storage_object_id]),
    avatarUrls(db, [...away, ...asks].map((i) => i.actor?.id ?? "").concat(post ? [post.author.id] : [], huddle?.participantIds.slice(0, 1) ?? [])),
  ]);

  return {
    lastVisit,
    creation,
    version: (version.data as { version_number: number } | null)?.version_number ?? null,
    cover: creation ? (covers[creation.id] ?? null) : null,
    away,
    asks,
    spark,
    sparkUrl: spark?.storage_object_id ? (previews[spark.storage_object_id] ?? null) : null,
    post,
    huddle,
    avatars,
    hasMaterials: (materialCount.count ?? 0) > 0,
  };
}
