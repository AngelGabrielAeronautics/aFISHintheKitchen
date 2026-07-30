import { getStorage } from "firebase-admin/storage";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import type { Firestore } from "firebase-admin/firestore";

// Deleting data, in the two shapes this product actually has.
//
// The public promise on /delete-account draws the line, and it is a considered
// one — read it before changing anything here:
//
//   1. Deleting your sign-in IN THE APP removes your account and the data that
//      is yours alone. It does NOT remove the cookbook, because a cookbook is
//      shared with the people you invited and one person leaving must not wipe
//      something a family is still using.
//   2. The cookbook goes only when its OWNER asks for it, by email, within 30
//      days.
//
// So there are two functions here, not one. Conflating them is the bug this file
// exists to prevent: a cascade hung off account deletion would quietly destroy
// other people's recipes, which is the opposite of what this app is for.
//
// ⚠ Both are irreversible. Firestore PITR (7 days), daily backups (14 days) and
// weekly backups (14 weeks) exist precisely so a mistake in here is survivable —
// see the launch-audit notes. Cloud Storage keeps deleted objects for 90 days.
// Do not remove those safety nets on the assumption this code is correct.

/**
 * Collections whose documents carry a `householdId` and belong to the cookbook.
 *
 * ⚠ `sharedRecipes` and `sharedMenus` were missing from the original list in
 * lapse-sweep, so a hard-deleted household left its PUBLIC share links working:
 * `/r/<token>` kept serving a snapshot of a family's recipe after everything else
 * about them was gone. Anything added here must also be reachable by
 * `where("householdId", "==", …)` or it will be silently skipped.
 */
const HOUSEHOLD_SCOPED_COLLECTIONS = [
  "recipes",
  "members",
  "mealPlans",
  "collections",
  "tips",
  "notifications",
  "householdMembers",
  "invitedUsers",
  "sharedRecipes",
  "sharedMenus",
  "deviceTokens",
] as const;

/**
 * Per-user documents, keyed by uid. These are the ones an account deletion takes
 * with it — nobody else can see them and nobody else loses anything.
 */
const USER_KEYED_COLLECTIONS = [
  "userPreferences",
  "authEmailThrottle",
  "checkThrottle",
  "enhanceThrottle",
  "tagThrottle",
  "importThrottle",
  "suggestThrottle",
] as const;

/** Firestore caps a batch at 500 writes; stay under it with room to spare. */
const BATCH = 450;

async function deleteQuery(
  db: Firestore,
  col: string,
  field: string,
  value: string
): Promise<number> {
  const snap = await db.collection(col).where(field, "==", value).get();
  for (let i = 0; i < snap.docs.length; i += BATCH) {
    const batch = db.batch();
    snap.docs.slice(i, i + BATCH).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

/**
 * The object path inside the bucket, read out of a Firebase download URL.
 *
 * Download URLs look like
 * `https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<url-encoded path>?alt=media&token=…`
 * so the path is the `/o/` segment, decoded. Anything else — a preset hero served
 * from the site, an empty string, a URL we didn't mint — returns null and is
 * skipped rather than guessed at.
 */
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
 * Every uploaded file belonging to a household: recipe covers, thumbnails,
 * galleries and videos, tip photos and videos, member avatars, the custom hero.
 *
 * ⚠ Nothing deleted Storage at all before this existed. A household hard-deleted
 * at day 365 kept every photo and video in the bucket indefinitely — a bill that
 * never stops, and a family's pictures retained long after their recipes were
 * gone.
 *
 * ⚠ This deletes EXACT OBJECT PATHS taken from the documents, and must keep
 * doing so. The obvious implementation — delete the `recipe-images/{slug}/`
 * prefix — is unsafe here, because a slug is unique only WITHIN a household:
 * `getRecipeBySlug` scopes its lookup by householdId. Two families can each own a
 * recipe called Chakalaka, and both their photos live under
 * `recipe-images/chakalaka/`. A prefix delete would take one family's pictures
 * while deleting another's cookbook. Only `{householdId}/…` (avatars, branding) is
 * genuinely tenant-scoped, and even that is reached through the documents here.
 *
 * The consequence of the URL-driven approach: a file whose document no longer
 * references it — an AI-enhanced photo the cook previewed and rejected, a cover
 * that was replaced — is not found and stays. Cloud Storage's 90-day soft delete
 * does not help with that because nothing deletes it in the first place. Tracked
 * as orphaned media; it is not personal data anyone can reach, since the URL is
 * unguessable and no document points at it.
 */
async function deleteStorageFor(
  db: Firestore,
  householdId: string
): Promise<{ deleted: number; failed: number }> {
  const name = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    // enhance-photo hardcodes this literal and works in production, so it is the
    // known-good fallback if the env var is absent server-side.
    ?? "a-fish-in-the-kitchen.firebasestorage.app";
  const bucket = getStorage().bucket(name);

  const paths = new Set<string>();
  const add = (v: unknown) => {
    const p = objectPathFromUrl(v);
    if (p) paths.add(p);
  };

  const [recipes, tips, members, household] = await Promise.all([
    db.collection("recipes").where("householdId", "==", householdId).get(),
    db.collection("tips").where("householdId", "==", householdId).get(),
    db.collection("members").where("householdId", "==", householdId).get(),
    db.collection("households").doc(householdId).get(),
  ]);

  for (const doc of recipes.docs) {
    const r = doc.data();
    add(r.image);
    add(r.thumbUrl);
    add(r.video);
    (Array.isArray(r.images) ? r.images : []).forEach(add);
  }
  for (const doc of tips.docs) {
    const t = doc.data();
    add(t.video);
    (Array.isArray(t.images) ? t.images : []).forEach(add);
  }
  for (const doc of members.docs) add(doc.data().photoUrl);
  add(household.data()?.customisation?.heroUrl);

  // One failure must not abandon the rest — report the count instead.
  let failed = 0;
  await Promise.all(
    [...paths].map(async (p) => {
      try {
        await bucket.file(p).delete({ ignoreNotFound: true });
      } catch (err) {
        failed++;
        console.error(`delete-data: could not delete ${p}`, err);
      }
    })
  );
  return { deleted: paths.size - failed, failed };
}

export type DeletionReport = Record<string, number>;

/**
 * Delete a whole cookbook: its content, its media, its share links, and the
 * owner's subscription record.
 *
 * Only for the owner's own request or the day-365 lapse sweep. Never call this
 * because a member deleted their account.
 *
 * @returns what was removed, per collection — so an operator answering a deletion
 *   request can say what happened rather than "it's done, probably".
 */
export async function deleteHouseholdData(
  householdId: string,
  ownerId: string
): Promise<DeletionReport> {
  const db = getAdminDb();
  const report: DeletionReport = {};

  // ⚠ Media FIRST. The file paths are read out of the recipe, tip, member and
  // household documents, so deleting those rows first would throw away the only
  // record of which objects belong to this cookbook — leaving them orphaned in
  // the bucket with nothing left to identify their owner.
  const media = await deleteStorageFor(db, householdId);
  report["storageFiles"] = media.deleted;
  if (media.failed) report["storageFilesFailed"] = media.failed;

  for (const col of HOUSEHOLD_SCOPED_COLLECTIONS) {
    report[col] = await deleteQuery(db, col, "householdId", householdId);
  }

  await db.collection("subscriptions").doc(ownerId).delete();
  report["subscriptions"] = 1;
  await db.collection("households").doc(householdId).delete();
  report["households"] = 1;

  return report;
}

/**
 * Delete one person's account and the data that is theirs alone.
 *
 * Deliberately does NOT touch the cookbook, even when the caller owns it — see
 * the promise quoted at the top of this file. Recipes they contributed stay with
 * the family, attributed, the way a name in a cookbook stays in it.
 *
 * ⚠ The Auth user goes LAST. If a Firestore delete fails partway, the account
 * still exists, we can still tell whose data it is, and the call can be retried.
 * Removing the sign-in first would leave data with no way left to identify its
 * owner — unrecoverable by inspection, and exactly the state a half-finished
 * deletion must not end in.
 */
export async function deleteUserData(uid: string): Promise<DeletionReport> {
  const db = getAdminDb();
  const report: DeletionReport = {};

  for (const col of USER_KEYED_COLLECTIONS) {
    const ref = db.collection(col).doc(uid);
    const snap = await ref.get();
    if (snap.exists) {
      await ref.delete();
      report[col] = 1;
    }
  }

  // Push registrations are keyed by FCM token, not uid, so they need a query.
  // Left behind, they would keep this phone receiving a family's notifications
  // after its owner deleted their account.
  report["deviceTokens"] = await deleteQuery(db, "deviceTokens", "uid", uid);

  await getAdminAuth().deleteUser(uid);
  report["authUser"] = 1;

  return report;
}
