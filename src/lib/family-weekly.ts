import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendHouseholdPush } from "@/lib/push-send";

/**
 * Monday: "This week: Poppie's Chakalaka" — the FAMILY's own Recipe of the
 * Week, pushed to every member the same morning. Their food beats our Learn
 * content every time; a book with fewer than MIN_OWN recipes of its own still
 * gets the Learn push instead (lib/learn-weekly excludes the books served here).
 *
 * ⚠ THE PICK IS THE PHONES' PICK. Both apps compute Recipe of the Week with
 * the same rule (RecipeListView.RecipeOfWeek on iOS, RecipeBrowse on Android):
 * the pool is the published recipes with a photo (all of them if none has
 * one), ordered by FNV-1a of the id, first one not yet in `rotwShown`; when
 * every one has had a turn the cycle resets. The first device of the week
 * pins the result on the household (`recipeOfWeek {weekId, recipeId}`) and
 * every other client honours the pin. This runs first and pins the same
 * thing, so what was pushed is what the phones show. Change all three or none.
 *
 * ⚠ weekId is a Monday-aligned count of weeks since Monday 2024-01-01, which
 * the phones compute in LOCAL time. 07:00 UTC Monday is already Monday from
 * UTC-7 eastwards — everywhere this app has a user. A phone still on Sunday
 * (US west coast) would re-pin its own week over this one; tolerated.
 */
const MIN_OWN = 5;
const REF_MONDAY_UTC = Date.UTC(2024, 0, 1);

export function weekId(now: Date): string {
  const day = now.getUTCDay();
  const sinceMonday = (day + 6) % 7;
  const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - sinceMonday * 86_400_000;
  return String(Math.round((monday - REF_MONDAY_UTC) / (7 * 86_400_000)));
}

function fnv1a(s: string): number {
  let h = 2166136261;
  for (const byte of Buffer.from(s, "utf8")) {
    h ^= byte;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

interface RecipeRow {
  id: string;
  title: string;
  slug: string;
  contributedBy: string;
  hasImage: boolean;
}

export function pickOfTheWeek(recipes: RecipeRow[], shown: string[]): { pick: RecipeRow | null; cycleDone: boolean } {
  if (recipes.length === 0) return { pick: null, cycleDone: false };
  const withImages = recipes.filter((r) => r.hasImage);
  const pool = withImages.length > 0 ? withImages : recipes;
  const ordered = [...pool].sort((a, b) => fnv1a(a.id) - fnv1a(b.id));
  const shownSet = new Set(shown);
  const candidates = ordered.filter((r) => !shownSet.has(r.id));
  if (candidates.length === 0) return { pick: ordered[0], cycleDone: true };
  return { pick: candidates[0], cycleDone: false };
}

export interface FamilyWeeklyResult {
  skipped?: string;
  week?: string;
  served: string[];
  pushed: number;
}

/** Mondays only, once per week. Returns the household ids it served. */
export async function sendFamilyRecipeOfWeekIfDue(now = new Date()): Promise<FamilyWeeklyResult> {
  if (now.getUTCDay() !== 1) return { skipped: "not_monday", served: [], pushed: 0 };
  const db: Firestore = getAdminDb();
  const wid = weekId(now);
  const stampRef = db.collection("config").doc("familyWeekly");
  const stamp = await stampRef.get();
  if (stamp.data()?.lastWeekId === wid) {
    return { skipped: "already_sent", week: wid, served: (stamp.data()?.served as string[]) ?? [], pushed: 0 };
  }

  const [households, recipes] = await Promise.all([
    db.collection("households").get(),
    db.collection("recipes").select("householdId", "title", "slug", "contributedBy", "image", "images", "starter", "draft").get(),
  ]);
  const byHousehold = new Map<string, RecipeRow[]>();
  recipes.docs.forEach((d) => {
    const r = d.data();
    if (r.draft === true || !r.householdId) return;
    const list = byHousehold.get(r.householdId) ?? [];
    list.push({
      id: d.id,
      title: String(r.title ?? ""),
      slug: String(r.slug ?? ""),
      contributedBy: String(r.contributedBy ?? ""),
      hasImage: (typeof r.image === "string" && r.image !== "") || (Array.isArray(r.images) && r.images.length > 0),
    });
    byHousehold.set(r.householdId, list);
  });

  const served: string[] = [];
  let pushed = 0;
  for (const hhSnap of households.docs) {
    const hh = hhSnap.data();
    if ((hh.accessState ?? "active") !== "active") continue;
    const all = byHousehold.get(hhSnap.id) ?? [];
    // The family's own recipes decide whether the book qualifies; the pick
    // itself comes from everything published, starter recipes included —
    // exactly the pool the phones rotate through.
    const ownCount = recipes.docs.filter((d) => d.data().householdId === hhSnap.id && d.data().starter !== true && d.data().draft !== true).length;
    if (ownCount < MIN_OWN) continue;

    // A phone east of UTC may already have pinned this week (Monday 01:00 in
    // Johannesburg is Sunday 23:00 UTC). Its pin is the truth — push that,
    // don't pick again over the top of it and burn a turn in the rotation.
    const existing = hh.recipeOfWeek as { weekId?: string; recipeId?: string } | undefined;
    let pick: RecipeRow | null = null;
    let cycleDone = false;
    if (existing?.weekId === wid) {
      pick = all.find((r) => r.id === existing.recipeId) ?? null;
    }
    const alreadyPinned = pick !== null;
    if (!pick) ({ pick, cycleDone } = pickOfTheWeek(all, (hh.rotwShown as string[] | undefined) ?? []));
    if (!pick) continue;
    try {
      if (!alreadyPinned) {
        await hhSnap.ref.update({
          recipeOfWeek: { weekId: wid, recipeId: pick.id },
          rotwShown: cycleDone ? [pick.id] : FieldValue.arrayUnion(pick.id),
        });
      }
      const from = pick.contributedBy ? ` — ${pick.contributedBy}'s` : "";
      const res = await sendHouseholdPush(db, {
        householdId: hhSnap.id,
        type: "rotw",
        title: "This week's recipe",
        message: `This week: ${pick.title}${from}`,
        link: `/recipes/${pick.slug}`,
        prefKey: "notifyWeekly",
      });
      pushed += res.sent;
      served.push(hhSnap.id);
    } catch (err) {
      console.error(`family-weekly: ${hhSnap.id} failed`, err);
    }
  }
  await stampRef.set({ lastWeekId: wid, served, pushed, at: now.toISOString() }, { merge: true });
  return { week: wid, served, pushed };
}
