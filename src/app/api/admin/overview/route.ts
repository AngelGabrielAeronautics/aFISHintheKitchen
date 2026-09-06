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
  // ⚠ `.select(...)` on the usage reads: only the fields the counts need come
  // back, so this stays cheap as cookbooks fill up. At ~200 recipes a full read
  // is nothing; if that ever reaches five figures, move these to per-household
  // count() aggregations rather than dropping the numbers.
  const [householdsSnap, subsSnap, membersSnap, recipesSnap, tipsSnap, collectionsSnap, plansSnap, listsSnap, tokensSnap, profilesSnap, sharedSnap] =
    await Promise.all([
      db.collection("households").get(),
      db.collection("subscriptions").get(),
      db.collection("householdMembers").get(),
      db.collection("recipes").select("householdId", "starter", "draft", "image", "images", "createdAt").get(),
      db.collection("tips").select("householdId", "createdAt").get(),
      db.collection("collections").select("householdId", "createdAt").get(),
      db.collection("mealPlans").select("householdId").get(),
      db.collection("shoppingLists").select("householdId", "entries", "extras", "checked").get(),
      db.collection("deviceTokens").select("householdId").get(),
      db.collection("members").select("householdId", "sample").get(),
      db.collection("sharedRecipes").select("householdId", "createdAt").get(),
    ]);

  // ── Usage, per cookbook ──
  // The question these answer is "is anybody actually using this?", and the
  // number that answers it is OWN recipes: a book sitting on nothing but the
  // five starter recipes we gave it has never really been opened. 9 of 13 were
  // in exactly that state when this was added (2026-09-06).
  const usage = new Map<string, Usage>();
  const forHousehold = (hid: string): Usage => {
    let u = usage.get(hid);
    if (!u) {
      u = { ownRecipes: 0, starterRecipes: 0, drafts: 0, withPhoto: 0, tips: 0, menus: 0,
            plans: 0, shoppingListsUsed: 0, devices: 0, profiles: 0, sharedRecipes: 0, lastActivityAt: null };
      usage.set(hid, u);
    }
    return u;
  };
  const seen = (u: Usage, at: unknown) => {
    const iso = typeof at === "string" ? at : null;
    if (iso && (!u.lastActivityAt || iso > u.lastActivityAt)) u.lastActivityAt = iso;
  };
  recipesSnap.docs.forEach((d) => {
    const r = d.data();
    const hid = r.householdId as string | undefined;
    if (!hid) return;
    const u = forHousehold(hid);
    if (r.starter === true) u.starterRecipes += 1;
    else u.ownRecipes += 1;
    if (r.draft === true) u.drafts += 1;
    // ⚠ OWN recipes only. Starter content ships with photos, so counting them
    // put "with a photo" ABOVE "recipes written" — a subset larger than the
    // set it belongs to, which is how you know a number is lying.
    const hasPhoto =
      (typeof r.image === "string" && r.image !== "") || (Array.isArray(r.images) && r.images.length > 0);
    if (r.starter !== true && hasPhoto) u.withPhoto += 1;
    // Starter content arrives with the cookbook; counting its date as activity
    // would make every untouched book look freshly used.
    if (r.starter !== true) seen(u, r.createdAt);
  });
  const bump = (snap: FirebaseFirestore.QuerySnapshot, field: keyof Usage) =>
    snap.docs.forEach((d) => {
      const hid = d.data().householdId as string | undefined;
      if (!hid) return;
      const u = forHousehold(hid);
      (u[field] as number) += 1;
      seen(u, d.data().createdAt);
    });
  bump(tipsSnap, "tips");
  bump(collectionsSnap, "menus");
  bump(sharedSnap, "sharedRecipes");
  plansSnap.docs.forEach((d) => {
    const hid = d.data().householdId as string | undefined;
    if (hid) forHousehold(hid).plans += 1;
  });
  listsSnap.docs.forEach((d) => {
    const l = d.data();
    const hid = l.householdId as string | undefined;
    if (!hid) return;
    // An empty list doc is created just by opening the tab — only count one
    // that has something in it.
    const used = (l.entries?.length ?? 0) + (l.extras?.length ?? 0) + (l.checked?.length ?? 0) > 0;
    if (used) forHousehold(hid).shoppingListsUsed += 1;
  });
  tokensSnap.docs.forEach((d) => {
    const hid = d.data().householdId as string | undefined;
    if (hid) forHousehold(hid).devices += 1;
  });
  profilesSnap.docs.forEach((d) => {
    const m = d.data();
    const hid = m.householdId as string | undefined;
    // `sample: true` are the example cards the setup screen can add — they are
    // ours, not people.
    if (hid && m.sample !== true) forHousehold(hid).profiles += 1;
  });

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
      usage: usage.get(d.id) ?? {
        ownRecipes: 0, starterRecipes: 0, drafts: 0, withPhoto: 0, tips: 0, menus: 0,
        plans: 0, shoppingListsUsed: 0, devices: 0, profiles: 0, sharedRecipes: 0, lastActivityAt: null,
      },
    };
  });

  const daysAgo = (iso: string | null) =>
    iso ? Math.floor((Date.now() - Date.parse(iso)) / 86_400_000) : null;
  const metrics = {
    households: households.length,
    members: membersSnap.size,
    seatRequests: households.filter((h) => h.seatUpgradeRequestedAt).length,
    byAccessState: countBy(households, (h) => h.accessState),
    bySubscription: countBy(households, (h) => h.subscriptionStatus),
    byFunding: countBy(households, (h) => h.funding),
    // ── Is the app being used? ──
    // Deliberately blunt. "Signed up" was never the question.
    usage: {
      /** Cookbooks whose owner has added at least one recipe of their own. */
      activated: households.filter((h) => h.usage.ownRecipes > 0).length,
      /** …and the ones still sitting on nothing but starter content. */
      neverAddedARecipe: households.filter((h) => h.usage.ownRecipes === 0).length,
      activeLast7Days: households.filter((h) => {
        const d = daysAgo(h.usage.lastActivityAt);
        return d !== null && d <= 7;
      }).length,
      activeLast30Days: households.filter((h) => {
        const d = daysAgo(h.usage.lastActivityAt);
        return d !== null && d <= 30;
      }).length,
      ownRecipes: households.reduce((n, h) => n + h.usage.ownRecipes, 0),
      recipesWithPhoto: households.reduce((n, h) => n + h.usage.withPhoto, 0),
      devices: tokensSnap.size,
      /** Cookbooks nobody has ever signed into on a device. */
      noDevice: households.filter((h) => h.usage.devices === 0).length,
      plansMade: plansSnap.size,
      shoppingListsUsed: households.reduce((n, h) => n + h.usage.shoppingListsUsed, 0),
      sharedRecipes: sharedSnap.size,
      /** ⚠ Cook Mode keeps its session on the DEVICE, so how often anyone
       *  actually cooks cannot be measured from here. The nearest proxies are
       *  recipes-with-photos and shared recipes. */
      cookSessionsMeasurable: false,
    },
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

/** Per-cookbook usage counters. */
interface Usage {
  ownRecipes: number;
  starterRecipes: number;
  drafts: number;
  withPhoto: number;
  tips: number;
  menus: number;
  plans: number;
  shoppingListsUsed: number;
  devices: number;
  profiles: number;
  sharedRecipes: number;
  lastActivityAt: string | null;
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
