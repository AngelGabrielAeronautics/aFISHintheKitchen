import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifySuperAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Platform-wide overview for the super-admin console: a row per cookbook plus
// headline metrics. Reads everything via the Admin SDK (bypasses rules).
export async function GET(req: NextRequest) {
  const auth = await verifySuperAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getAdminDb();
  const [householdsSnap, subsSnap, membersSnap] = await Promise.all([
    db.collection("households").get(),
    db.collection("subscriptions").get(),
    db.collection("householdMembers").get(),
  ]);

  const subsByOwner = new Map<string, FirebaseFirestore.DocumentData>();
  subsSnap.docs.forEach((d) => subsByOwner.set(d.id, d.data()));

  const memberCountByHousehold = new Map<string, number>();
  membersSnap.docs.forEach((d) => {
    const hid = d.data().householdId as string | undefined;
    if (hid) memberCountByHousehold.set(hid, (memberCountByHousehold.get(hid) ?? 0) + 1);
  });

  const households = householdsSnap.docs.map((d) => {
    const h = d.data();
    const sub = subsByOwner.get(h.ownerId);
    return {
      id: d.id,
      name: h.name ?? "",
      ownerId: h.ownerId ?? "",
      memberCount: memberCountByHousehold.get(d.id) ?? 0,
      accessState: h.accessState ?? "active",
      subscriptionStatus: sub?.status ?? "none",
      plan: sub?.plan ?? null,
      trialEndsAt: sub?.trialEndsAt ?? null,
      lapsedAt: sub?.lapsedAt ?? null,
      createdAt: h.createdAt ?? null,
    };
  });

  const metrics = {
    households: households.length,
    members: membersSnap.size,
    byAccessState: countBy(households, (h) => h.accessState),
    bySubscription: countBy(households, (h) => h.subscriptionStatus),
  };

  return NextResponse.json({ ok: true, metrics, households });
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
