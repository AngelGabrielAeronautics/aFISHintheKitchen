import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { verifySuperAdmin } from "@/lib/admin-auth";
import { classifyFunding } from "@/lib/funding";

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

  // Owner emails, so a row says WHO rather than a cookbook name and a uid.
  // ⚠ Best-effort and batched: a missing or deleted auth user must not take the
  // table down, and one lookup per household would be 12+ round trips.
  const emailByUid = await lookupEmails(
    householdsSnap.docs.map((d) => String(d.data().ownerId ?? "")).filter(Boolean)
  );

  const households = householdsSnap.docs.map((d) => {
    const h = d.data();
    const sub = subsByOwner.get(h.ownerId);
    return {
      id: d.id,
      name: h.name ?? "",
      ownerId: h.ownerId ?? "",
      ownerEmail: emailByUid.get(String(h.ownerId ?? "")) ?? null,
      memberCount: memberCountByHousehold.get(d.id) ?? 0,
      accessState: h.accessState ?? "active",
      subscriptionStatus: sub?.status ?? "none",
      // ⚠ THE FIELD THE TABLE ACTUALLY SHOWS. A comped year, a gifted year and
      // a real store subscription all carry status "active"; this is the one
      // label that tells them apart, and the Money panel counts the very same
      // function. See lib/funding.ts.
      funding: classifyFunding(sub, d.id),
      provider: sub?.provider ?? null,
      plan: sub?.plan ?? null,
      trialEndsAt: sub?.trialEndsAt ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      lapsedAt: sub?.lapsedAt ?? null,
      createdAt: h.createdAt ?? null,
      // Owner clicked "Notify me" at the seat cap — captured demand for the
      // paid extra-seats add-on (lands with billing). null once handled.
      seatUpgradeRequestedAt: h.seatUpgradeRequestedAt ?? null,
    };
  });

  const metrics = {
    households: households.length,
    members: membersSnap.size,
    seatRequests: households.filter((h) => h.seatUpgradeRequestedAt).length,
    byAccessState: countBy(households, (h) => h.accessState),
    bySubscription: countBy(households, (h) => h.subscriptionStatus),
    byFunding: countBy(households, (h) => h.funding),
  };

  return NextResponse.json({ ok: true, metrics, households });
}

/**
 * uid → email, via the Auth admin API in batches of 100 (its hard limit).
 *
 * ⚠ Deliberately swallows failures per batch. The email is a convenience on a
 * row; the row's ACTIONS suspend and cancel real families' cookbooks, and none
 * of that should be unavailable because an auth lookup had a bad minute.
 */
async function lookupEmails(uids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(uids)];
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100).map((uid) => ({ uid }));
    try {
      const res = await getAdminAuth().getUsers(batch);
      res.users.forEach((u) => {
        if (u.email) out.set(u.uid, u.email);
      });
    } catch (err) {
      console.error("admin/overview: email lookup failed for a batch:", err);
    }
  }
  return out;
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
