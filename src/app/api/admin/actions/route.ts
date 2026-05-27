import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifySuperAdmin } from "@/lib/admin-auth";
import { TRIAL_DAYS } from "@/lib/access";

export const runtime = "nodejs";

// Super-admin subscription/household actions. Refunds are intentionally NOT here —
// those happen in the payment provider's dashboard (added at the billing milestone).
export async function POST(req: NextRequest) {
  const auth = await verifySuperAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json()) as { householdId?: string; action?: string; days?: number };
  const { householdId, action } = body;
  if (!householdId || !action) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const db = getAdminDb();
  const hhRef = db.collection("households").doc(householdId);
  const hhSnap = await hhRef.get();
  if (!hhSnap.exists) return NextResponse.json({ error: "household_not_found" }, { status: 404 });

  const ownerId = hhSnap.data()!.ownerId as string;
  const subRef = db.collection("subscriptions").doc(ownerId);
  const now = new Date().toISOString();

  switch (action) {
    case "suspend":
      await hhRef.set({ accessState: "suspended", stateChangedAt: now }, { merge: true });
      break;

    case "reactivate":
      await hhRef.set({ accessState: "active", stateChangedAt: now }, { merge: true });
      await subRef.set(
        { status: "active", householdId, lapsedAt: FieldValue.delete(), updatedAt: now },
        { merge: true }
      );
      break;

    case "comp": // grant free access
      await hhRef.set({ accessState: "active", stateChangedAt: now }, { merge: true });
      await subRef.set(
        { status: "active", plan: null, comped: true, householdId, lapsedAt: FieldValue.delete(), updatedAt: now },
        { merge: true }
      );
      break;

    case "extend_trial": {
      const days = Number(body.days) > 0 ? Number(body.days) : TRIAL_DAYS;
      const trialEndsAt = new Date(Date.now() + days * 86_400_000).toISOString();
      await hhRef.set({ accessState: "active", stateChangedAt: now }, { merge: true });
      await subRef.set(
        { status: "trialing", trialEndsAt, hasUsedTrial: true, householdId, lapsedAt: FieldValue.delete(), updatedAt: now },
        { merge: true }
      );
      break;
    }

    case "cancel": // starts the lapse ladder; the cron advances accessState over time
      await subRef.set({ status: "canceled", householdId, lapsedAt: now, updatedAt: now }, { merge: true });
      break;

    default:
      return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
