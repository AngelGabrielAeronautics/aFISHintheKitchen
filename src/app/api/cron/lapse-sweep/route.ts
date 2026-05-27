import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { computeAccessStateFromLapse, DELETE_DAYS } from "@/lib/access";
import type { Firestore } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Collections whose docs carry a householdId and are deleted with the household.
const HOUSEHOLD_SCOPED_COLLECTIONS = [
  "recipes",
  "members",
  "mealPlans",
  "collections",
  "tips",
  "notifications",
  "householdMembers",
  "invitedUsers",
];

async function deleteByHousehold(db: Firestore, col: string, householdId: string): Promise<void> {
  const snap = await db.collection(col).where("householdId", "==", householdId).get();
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = db.batch();
    snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

async function deleteHouseholdData(db: Firestore, householdId: string, ownerId: string): Promise<void> {
  for (const col of HOUSEHOLD_SCOPED_COLLECTIONS) {
    await deleteByHousehold(db, col, householdId);
  }
  await db.collection("subscriptions").doc(ownerId).delete();
  await db.collection("households").doc(householdId).delete();
}

// Daily lapse sweep (Vercel Cron). Advances each lapsed household along the
// ladder: active → read-only (day 7) → suspended (day 30) → deleted (day 365).
// The webhook only sets the starting state; this job moves it over time.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const hardDelete = process.env.LAPSE_HARD_DELETE === "true";
  const db = getAdminDb();
  const now = new Date();

  // Only unpaid subscriptions drive the ladder; recovered ones are reset to
  // active by the webhook and have no lapsedAt.
  const unpaid = await db
    .collection("subscriptions")
    .where("status", "in", ["past_due", "canceled", "incomplete"])
    .get();

  let transitioned = 0;
  let flaggedForDelete = 0;
  let deleted = 0;

  for (const subSnap of unpaid.docs) {
    const sub = subSnap.data();
    if (!sub.lapsedAt || !sub.householdId) continue;

    const { accessState, shouldDelete } = computeAccessStateFromLapse(sub.lapsedAt, now);
    const hhRef = db.collection("households").doc(sub.householdId);

    if (shouldDelete) {
      if (hardDelete) {
        await deleteHouseholdData(db, sub.householdId, subSnap.id);
        deleted++;
      } else {
        // Safety default: mark for review instead of unattended cascade deletion.
        const deleteAfter = new Date(
          new Date(sub.lapsedAt).getTime() + DELETE_DAYS * 86_400_000
        ).toISOString();
        await hhRef.set(
          { accessState: "suspended", deleteAfter, stateChangedAt: now.toISOString() },
          { merge: true }
        );
        flaggedForDelete++;
        console.warn(`lapse-sweep: household ${sub.householdId} past delete horizon (hard-delete disabled)`);
      }
      continue;
    }

    const hhSnap = await hhRef.get();
    if (hhSnap.exists && (hhSnap.data()?.accessState ?? "active") !== accessState) {
      await hhRef.update({ accessState, stateChangedAt: now.toISOString() });
      transitioned++;
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: unpaid.size,
    transitioned,
    flaggedForDelete,
    deleted,
    hardDelete,
  });
}
