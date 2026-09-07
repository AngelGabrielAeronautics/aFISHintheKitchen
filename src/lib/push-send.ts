import type { Firestore } from "firebase-admin/firestore";
import { getAdminMessaging } from "@/lib/firebase-admin";
import { deleteTokenEverywhere } from "@/lib/device-tokens";
import { honourPushPrefs, type PushPrefKey } from "@/lib/push-prefs";

/**
 * Every push that goes to a cookbook's members leaves through here — /api/push
 * (the apps' new-recipe / cooked / loved / noted / event-assignment) and the
 * server's own "Mum joined" — so the rules are stated once:
 *
 * - CURRENT members only. A device registration outlives a membership, so
 *   without the join-row check a leaver kept getting the family's pushes.
 * - Never the person who did the thing.
 * - Optionally only named people (the recipe's author, the assignee) — resolved
 *   through householdMembers by displayName, because identity in a cookbook
 *   is the NAME and the request value is client-supplied.
 * - The recipient's own preference for this kind of push (lib/push-prefs).
 * - Tokens FCM reports dead are forgotten everywhere.
 */
export interface HouseholdPush {
  householdId: string;
  title: string;
  message: string;
  link: string;
  /** Goes into `data.type`; the apps route on it. */
  type: string;
  prefKey: PushPrefKey;
  excludeUid?: string;
  /** Display names; when given, only those members' devices are targeted. */
  targetNames?: string[];
}

export async function sendHouseholdPush(db: Firestore, push: HouseholdPush): Promise<{ sent: number; failed: number }> {
  const [devices, members] = await Promise.all([
    db.collection("deviceTokens").where("householdId", "==", push.householdId).get(),
    db.collection("householdMembers").where("householdId", "==", push.householdId).get(),
  ]);
  const memberUids = new Set(members.docs.map((d) => d.data().userId as string));
  let targets = devices.docs
    .map((d) => d.data() as { token: string; uid: string })
    .filter((t) => memberUids.has(t.uid) && t.uid !== push.excludeUid);

  if (push.targetNames && push.targetNames.length > 0) {
    const wanted = new Set(push.targetNames);
    const uids = new Set(members.docs.filter((d) => wanted.has(d.data().displayName as string)).map((d) => d.data().userId as string));
    targets = targets.filter((t) => uids.has(t.uid));
  }
  targets = await honourPushPrefs(db, targets, push.prefKey);

  const tokens = [...new Set(targets.map((t) => t.token))].filter(Boolean);
  if (tokens.length === 0) return { sent: 0, failed: 0 };

  const res = await getAdminMessaging().sendEachForMulticast({
    tokens,
    notification: { title: push.title, body: push.message.slice(0, 240) },
    data: { link: push.link, type: push.type },
    apns: { payload: { aps: { sound: "default" } } },
  });
  const stale: string[] = [];
  res.responses.forEach((r, i) => {
    const code = r.error?.code;
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
      stale.push(tokens[i]);
    }
  });
  await Promise.all(stale.map((t) => deleteTokenEverywhere(db, t)));
  return { sent: res.successCount, failed: res.failureCount };
}

/** The in-app inbox row that goes with a push (the apps' NotificationsView). */
export async function addInboxNotification(
  db: Firestore,
  n: { householdId: string; type: string; message: string; link: string; authorName: string; recipeId?: string }
): Promise<void> {
  await db.collection("notifications").add({
    ...n,
    createdAt: new Date().toISOString(),
    readBy: [],
  });
}
