import { getAdminDb } from "./firebase-admin";
import { getStorage } from "firebase-admin/storage";

/**
 * Copy a whole cookbook into a newly gifted one — recipes, their photos, and
 * the kitchen tips.
 *
 * ⚠⚠ OWNERS ONLY. This hands one household's entire private content to another
 * person, so only the OWNER of a cookbook may send a copy of it. A guest who
 * was invited into a family's cookbook cannot export it.
 *
 * Dylan first chose to let any member send it and reversed the decision the
 * same day (2026-08-13), which is worth keeping: the store listing promises
 * "Nothing is public, nothing is searchable. Only the people you invite can see
 * them", and letting an invitee re-export the book to an outsider would have
 * quietly broken that promise for every family in the app. The restriction is
 * the feature working, not a limitation to be relaxed later.
 *
 * ⚠ Enforced SERVER-SIDE in [assertMayCopy] as well as hidden in both apps.
 * Hiding a control is not access control — the purchase body says which
 * household to copy, and that field arrives from a client.
 *
 * ⚠ DRAFTS ARE NEVER COPIED. A draft is an unfinished thought belonging to the
 * person writing it — it is hidden from the rest of their own household, so
 * shipping it to a stranger's cookbook would be a leak, not a gift.
 *
 * ⚠ FAMILY-PRIVATE FIELDS ARE DROPPED: verdicts (who loved what), notes and
 * edit history. Those are a record of one family's conversation about a dish,
 * not part of the recipe. `buildShareSnapshot` makes the same distinction for
 * the same reason.
 *
 * Attribution is kept exactly: `contributedBy` still says Poppie, because "these
 * are Poppie's recipes" is the entire emotional point of the gift.
 */

const BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ?? "a-fish-in-the-kitchen.firebasestorage.app";

/** Firestore caps a batch at 500 writes; stay under it with room to spare. */
const BATCH_LIMIT = 400;

/** The `/o/<path>` segment of a Firebase download URL, decoded. */
function objectPathFromUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url.includes("/o/")) return null;
  const match = url.match(/\/o\/([^?]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * May this user hand out a copy of this cookbook?
 *
 * Only its owner. Checked against `householdMembers`, the same record the
 * security rules and every other server route trust.
 */
export async function mayCopyCookbook(uid: string, householdId: string): Promise<boolean> {
  if (!uid || !householdId) return false;
  const snap = await getAdminDb()
    .collection("householdMembers")
    .doc(`${householdId}_${uid}`)
    .get();
  return snap.exists && snap.data()?.role === "owner";
}

export interface CopyResult {
  recipes: number;
  tips: number;
  skippedDrafts: number;
}

/**
 * Copy the published recipes and tips of `sourceHouseholdId` into
 * `targetHouseholdId`.
 *
 * ⚠ Image URLs are carried over AS-IS here, and the files are duplicated later
 * by [copyGiftedImages]. That split is deliberate: Storage objects are
 * world-readable (storage.rules), so the recipient sees a complete, working
 * cookbook the instant they redeem, while the slow part happens out of band.
 * Doing the file copies inline would put a few hundred Storage calls inside an
 * HTTP request that a person is waiting on.
 */
export async function copyCookbook(
  sourceHouseholdId: string,
  targetHouseholdId: string,
  opts: { includeTips?: boolean } = {}
): Promise<CopyResult> {
  const db = getAdminDb();
  const result: CopyResult = { recipes: 0, tips: 0, skippedDrafts: 0 };

  const recipes = await db
    .collection("recipes")
    .where("householdId", "==", sourceHouseholdId)
    .get();

  let batch = db.batch();
  let queued = 0;
  const commit = async () => {
    if (queued > 0) {
      await batch.commit();
      batch = db.batch();
      queued = 0;
    }
  };

  for (const snap of recipes.docs) {
    const r = snap.data();
    if (r.draft === true) {
      result.skippedDrafts++;
      continue;
    }
    const ref = db.collection("recipes").doc();
    batch.set(ref, {
      householdId: targetHouseholdId,
      title: r.title ?? "",
      slug: r.slug ?? ref.id,
      description: r.description ?? "",
      image: r.image ?? "",
      images: r.images ?? null,
      thumbUrl: r.thumbUrl ?? null,
      video: r.video ?? null,
      instructionImages: r.instructionImages ?? null,
      category: r.category ?? "other",
      prepTime: r.prepTime ?? 0,
      cookTime: r.cookTime ?? 0,
      noCook: r.noCook ?? null,
      servings: r.servings ?? 0,
      difficulty: r.difficulty ?? null,
      protein: r.protein ?? null,
      heat: r.heat ?? null,
      seasons: r.seasons ?? null,
      ingredients: r.ingredients ?? [],
      instructions: r.instructions ?? [],
      story: r.story ?? null,
      tags: r.tags ?? [],
      // Attribution survives the journey — see the header.
      contributedBy: r.contributedBy ?? "",
      originalSource: r.originalSource ?? null,
      createdAt: r.createdAt ?? new Date().toISOString(),
      // ⚠ Deliberately absent: lovedBy / mustTry / triedBy / dislikedBy, notes,
      // editHistory, draft, featured, versionOf / versionAuthor / forkedFrom.
      // One family's verdicts and conversation are not part of the recipe.
      giftedFrom: sourceHouseholdId,
      // ⚠ The worklist flag for [copyGiftedImages]. A single boolean queried
      // with ONE equality filter — see that function for why that matters.
      imagesPending: true,
    });
    queued++;
    result.recipes++;
    if (queued >= BATCH_LIMIT) await commit();
  }
  await commit();

  if (opts.includeTips) {
    const tips = await db
      .collection("tips")
      .where("householdId", "==", sourceHouseholdId)
      .get();
    for (const snap of tips.docs) {
      const t = snap.data();
      const ref = db.collection("tips").doc();
      batch.set(ref, {
        householdId: targetHouseholdId,
        title: t.title ?? "",
        content: t.content ?? "",
        category: t.category ?? "general",
        author: t.author ?? "",
        images: t.images ?? null,
        video: t.video ?? null,
        // ⚠ linkedRecipes is dropped: it holds ids from the SOURCE household,
        // which point at recipes the recipient cannot see. A tip pinned to a
        // recipe that 404s is worse than a tip pinned to nothing.
        createdAt: t.createdAt ?? new Date().toISOString(),
        giftedFrom: sourceHouseholdId,
      });
      queued++;
      result.tips++;
      if (queued >= BATCH_LIMIT) await commit();
    }
    await commit();
  }

  return result;
}

/**
 * Duplicate every Storage object a gifted cookbook still points at, and rewrite
 * the copies' URLs to the new files.
 *
 * ⚠ WHY THIS EXISTS AT ALL. Left pointing at the giver's files, a gifted
 * cookbook is a hostage: `deleteHouseholdData` removes a household's Storage at
 * day 365 of a lapse, and every photo in the gift would blank at once. The
 * whole principle of this feature is that the recipient owns their cookbook
 * outright — a copy that dies with somebody else's account does not.
 *
 * Uses Storage's SERVER-SIDE copy, so bytes never travel through us.
 *
 * Works through a global worklist of recipes flagged `imagesPending`, so one
 * call drains whatever is outstanding across every gift. Safe to re-run.
 */
export async function copyGiftedImages(
  limit = 300
): Promise<{ copied: number; failed: number; recipes: number; done: boolean }> {
  const db = getAdminDb();
  const bucket = getStorage().bucket(BUCKET);
  let copied = 0;
  let failed = 0;

  // ⚠ ONE equality filter, across all households, and that is the point. The
  // obvious shape — householdId == target AND imagesPending == true — is two
  // equality filters and needs a composite index that is not declared; an
  // undeclared index does not run slowly, it THROWS. The same trap took out the
  // gift-expiry query earlier in this feature, where it would have killed the
  // whole nightly cron. `imagesPending` is naturally tiny: it exists only on
  // gifted recipes that have not been processed yet.
  const pending = await db
    .collection("recipes")
    .where("imagesPending", "==", true)
    .limit(200)
    .get();

  const remap = new Map<string, string>();
  const dup = async (url: unknown, householdId: string): Promise<string | null> => {
    const path = objectPathFromUrl(url);
    if (!path) return null;
    const key = `${householdId}|${path}`;
    if (remap.has(key)) return remap.get(key)!;
    if (copied + failed >= limit) return null;
    // Keep the original filename, re-homed under the recipient's household so
    // the deletion sweep finds it by the same householdId prefix convention.
    const leaf = path.split("/").pop() ?? "image";
    const dest = `${householdId}/recipe-images/gift-${Date.now()}-${leaf}`;
    try {
      await bucket.file(path).copy(bucket.file(dest));
      const [meta] = await bucket.file(dest).getMetadata();
      const token = (meta.metadata as Record<string, string> | undefined)
        ?.firebaseStorageDownloadTokens;
      const fresh =
        `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(dest)}` +
        `?alt=media${token ? `&token=${token}` : ""}`;
      remap.set(key, fresh);
      copied++;
      return fresh;
    } catch {
      failed++;
      return null;
    }
  };

  let recipes = 0;
  for (const snap of pending.docs) {
    const r = snap.data();
    const hh = r.householdId as string | undefined;
    if (!hh) {
      await snap.ref.update({ imagesPending: false });
      continue;
    }
    const patch: Record<string, unknown> = {};
    const image = await dup(r.image, hh);
    if (image) patch.image = image;
    const thumb = await dup(r.thumbUrl, hh);
    if (thumb) patch.thumbUrl = thumb;
    if (Array.isArray(r.images) && r.images.length) {
      const next: string[] = [];
      for (const u of r.images) next.push((await dup(u, hh)) ?? u);
      patch.images = next;
    }
    // ⚠ Cleared even when some copies failed. A photo that could not be
    // duplicated still WORKS — Storage objects are world-readable, so the
    // recipient sees the giver's original. Retrying for ever would spend the
    // budget re-failing on the same broken object every night and starve every
    // gift behind it in the queue.
    patch.imagesPending = false;
    await snap.ref.update(patch);
    recipes++;
    if (copied + failed >= limit) return { copied, failed, recipes, done: false };
  }

  return { copied, failed, recipes, done: pending.size < 200 };
}
