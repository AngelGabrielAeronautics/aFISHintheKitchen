import type { Firestore } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { sendTransactionalEmail } from "@/lib/email";
import { buildFamilyDigestEmail } from "@/lib/auth-email";

/**
 * Sunday: "This week in Our Family Table" — one email per member, only when
 * the book had news. The same people-news principle as the pushes, by the
 * channel that reaches the members who declined push (most of them). An
 * empty week sends nothing.
 *
 * Built from the in-app inbox (`notifications`): every push kind writes a row
 * there with a human sentence as `message`, so the digest is the week's inbox
 * read out. Family-activity opt-outs (userPreferences.notifyNewRecipes
 * === false) are honoured here too; the footer says so.
 */
const LOOKBACK_DAYS = 7;
const MAX_LINES = 12;
const DIGEST_TYPES = new Set(["new-recipe", "cooked", "loved", "noted", "joined", "event-assignment", "rotw"]);

export async function sendFamilyDigestIfDue(now = new Date()): Promise<Record<string, unknown>> {
  if (now.getUTCDay() !== 0) return { skipped: "not_sunday" };
  const db: Firestore = getAdminDb();
  const weekKey = now.toISOString().slice(0, 10);
  const stampRef = db.collection("config").doc("familyDigest");
  const stamp = await stampRef.get();
  if (stamp.data()?.lastSent === weekKey) return { skipped: "already_sent", week: weekKey };

  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString();
  // One range query on createdAt, grouped in memory — a householdId +
  // createdAt query needs a composite index this project has not declared,
  // and an undeclared index THROWS.
  const [events, households, members] = await Promise.all([
    db.collection("notifications").where("createdAt", ">=", since).get(),
    db.collection("households").get(),
    db.collection("householdMembers").get(),
  ]);
  const byHousehold = new Map<string, { message: string; createdAt: string }[]>();
  events.docs.forEach((d) => {
    const n = d.data();
    if (!n.householdId || !DIGEST_TYPES.has(String(n.type)) || !n.message) return;
    const list = byHousehold.get(n.householdId) ?? [];
    list.push({ message: String(n.message), createdAt: String(n.createdAt) });
    byHousehold.set(n.householdId, list);
  });

  let emails = 0;
  const booksWithNews: string[] = [];
  for (const hhSnap of households.docs) {
    const hh = hhSnap.data();
    if ((hh.accessState ?? "active") !== "active") continue;
    const lines = (byHousehold.get(hhSnap.id) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (lines.length === 0) continue;
    const bookName: string = hh.customisation?.brandName ?? hh.name ?? "your cookbook";
    const uids = members.docs.filter((m) => m.data().householdId === hhSnap.id).map((m) => m.data().userId as string);
    if (uids.length === 0) continue;

    const [users, prefs] = await Promise.all([
      getAdminAuth().getUsers(uids.map((uid) => ({ uid }))),
      Promise.all(uids.map((uid) => db.collection("userPreferences").doc(uid).get())),
    ]);
    const optedOut = new Set(prefs.filter((p) => p.exists && p.data()?.notifyNewRecipes === false).map((p) => p.id));
    const shown = lines.slice(-MAX_LINES).map((l) => l.message);
    const more = lines.length - shown.length;
    const { subject, html, text } = buildFamilyDigestEmail(bookName, shown, more);
    for (const u of users.users) {
      if (!u.email || optedOut.has(u.uid)) continue;
      try {
        await sendTransactionalEmail({ to: u.email, subject, html, text });
        emails++;
      } catch (err) {
        console.error(`family-digest: ${u.email} failed`, err);
      }
    }
    booksWithNews.push(hhSnap.id);
  }
  await stampRef.set({ lastSent: weekKey, emails, books: booksWithNews, at: now.toISOString() }, { merge: true });
  return { week: weekKey, emails, books: booksWithNews.length };
}
