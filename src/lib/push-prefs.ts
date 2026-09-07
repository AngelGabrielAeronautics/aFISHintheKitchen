import type { Firestore } from "firebase-admin/firestore";

/**
 * Which `userPreferences` flag a push kind answers to. The apps' More →
 * Notifications screen writes these; a missing field means yes.
 *
 *   notifyNewRecipes — a new recipe from someone in the book (/api/push)
 *   notifyEvents     — event assignments and menu replies
 *   notifyWeekly     — Monday's recipe and Learn publishes
 */
export type PushPrefKey = "notifyNewRecipes" | "notifyEvents" | "notifyWeekly";

interface Registration {
  token: string;
  uid?: string;
}

/**
 * Drop the devices of anyone who turned this kind off. One read per distinct
 * uid; a registration with no uid (legacy 1.10 docs) is kept — better a push
 * someone could have muted than a mute nobody asked for.
 */
export async function honourPushPrefs<T extends Registration>(
  db: Firestore,
  targets: T[],
  key: PushPrefKey
): Promise<T[]> {
  const uids = [...new Set(targets.map((t) => t.uid).filter((u): u is string => !!u))];
  if (uids.length === 0) return targets;
  const snaps = await Promise.all(uids.map((uid) => db.collection("userPreferences").doc(uid).get()));
  const optedOut = new Set(snaps.filter((s) => s.exists && s.data()?.[key] === false).map((s) => s.id));
  return targets.filter((t) => !t.uid || !optedOut.has(t.uid));
}
