import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { computeAccessStateFromLapse, DELETE_DAYS } from "@/lib/access";
import { sendTransactionalEmail } from "@/lib/email";
import { buildTrialEndingEmail } from "@/lib/auth-email";
import type { Firestore } from "firebase-admin/firestore";

const TRIAL_WARNING_DAYS = 3; // email the owner this many days before trial end

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

  // Expire signup trials that never converted. Only provider "none" (the
  // placeholder written by create-household): store-backed trials are advanced
  // by their own verified events, never by the clock here. Expiry marks the
  // sub canceled with lapsedAt = trialEndsAt, and the unpaid loop below walks
  // the household down the same ladder as any other lapse.
  let trialsExpired = 0;
  let trialWarningsSent = 0;
  const trialing = await db.collection("subscriptions").where("status", "==", "trialing").get();
  for (const subSnap of trialing.docs) {
    const sub = subSnap.data();
    if (sub.provider !== "none") continue;
    if (!sub.trialEndsAt) continue;
    const endsAt = new Date(sub.trialEndsAt);

    if (endsAt > now) {
      // Still trialing — send the one-time "ending soon" warning inside the
      // final window, so expiry never arrives unannounced.
      const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000);
      if (daysLeft <= TRIAL_WARNING_DAYS && !sub.trialWarningSentAt) {
        try {
          const email = (await getAdminAuth().getUser(subSnap.id)).email;
          if (email) {
            const { subject, html, text } = buildTrialEndingEmail(daysLeft);
            await sendTransactionalEmail({ to: email, subject, html, text });
            await subSnap.ref.update({ trialWarningSentAt: now.toISOString() });
            trialWarningsSent++;
          }
        } catch (err) {
          // Best-effort: a failed email must not block the sweep; retried tomorrow.
          console.error(`lapse-sweep: trial warning failed for ${subSnap.id}:`, err);
        }
      }
      continue;
    }

    await subSnap.ref.update({
      status: "canceled",
      lapsedAt: sub.trialEndsAt,
      updatedAt: now.toISOString(),
    });
    trialsExpired++;
  }

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
    trialsExpired,
    trialWarningsSent,
    transitioned,
    flaggedForDelete,
    deleted,
    hardDelete,
  });
}
