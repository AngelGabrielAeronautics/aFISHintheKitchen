import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { computeAccessStateFromLapse, DELETE_DAYS } from "@/lib/access";
import { sendTransactionalEmail } from "@/lib/email";
import {
  buildTrialEndingEmail,
  buildGiftEndingEmail,
  buildGiftCardEmail,
  buildGiftReminderEmail,
  buildGiftUnclaimedEmail,
} from "@/lib/auth-email";
// Shared with the admin delete action. The copy that used to live here missed
// Storage entirely and left sharedRecipes/sharedMenus behind, so a household
// deleted at day 365 kept every photo in the bucket and its PUBLIC share links
// working.
import { deleteHouseholdData } from "@/lib/delete-data";
import { copyGiftedImages } from "@/lib/cookbook-copy";
import { reportError } from "@/lib/error-reporting";

const TRIAL_WARNING_DAYS = 3;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.afishinthekitchen.com"; // email the owner this many days before trial end

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
          reportError(err, { route: "cron/lapse-sweep", stage: "trial-warning", subId: subSnap.id });
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

  // Deliver gift cards that are due: post-dated ones, and any whose send failed
  // at purchase time.
  //
  // ⚠ This lives in the lapse sweep rather than a cron of its own ON PURPOSE.
  // It is a daily job either way, and Vercel's Hobby plan allows only two cron
  // entries — a third would silently not be scheduled. If this file is ever
  // split up, check the plan before adding a cron rather than assuming.
  //
  // The cost is timing: a card dated for today goes out at 03:00 rather than
  // the moment the day starts. Cards for "today" are sent immediately at
  // purchase instead, so this only ever handles future dates and retries.
  let giftCardsSent = 0;
  //
  // ⚠ ONE equality filter, and the date compared in code. Two reasons. Every
  // other query in this file is single-filter and the two-field queries in this
  // codebase have hand-declared composite indexes — an undeclared one throws,
  // and a throw here takes down the REAL lapse ladder along with it. And a
  // range on sendOn would re-read every gift ever sent, for ever; unsent gifts
  // are a naturally tiny set. This is why purchase/route.ts writes
  // `sentAt: null` explicitly rather than omitting the field — you cannot query
  // equality against a field that isn't there.
  const dueCards = await db.collection("gifts").where("sentAt", "==", null).get();
  for (const giftSnap of dueCards.docs) {
    const gift = giftSnap.data();
    if (gift.status === "revoked") continue;
    if (!gift.sendOn || new Date(gift.sendOn) > now) continue;
    try {
      const { subject, html, text } = buildGiftCardEmail({
        recipientName: gift.recipientName ?? "",
        fromName: gift.purchasedByName ?? "",
        message: gift.message ?? "",
        code: giftSnap.id,
        redeemUrl: `${SITE_URL}/g/${giftSnap.id}`,
        includesCookbook: gift.includeCookbook === true,
      });
      await sendTransactionalEmail({ to: gift.recipientEmail, subject, html, text });
      await giftSnap.ref.update({ sentAt: now.toISOString() });
      giftCardsSent++;
    } catch (err) {
      // Retried tomorrow. A gift nobody can find is worse than a late one, so
      // this never gives up — but it also never blocks the rest of the sweep.
      console.error(`lapse-sweep: gift card send failed for ${giftSnap.id}:`, err);
      reportError(err, { route: "cron/lapse-sweep", stage: "gift-card", code: giftSnap.id });
    }
  }

  // Chase gifts nobody has claimed.
  //
  // ⚠ This matters more than it looks. A gift is a ONE-OFF purchase taken at
  // checkout, so an unclaimed code is money the buyer has already spent for
  // nothing delivered — the only failure in this feature that costs a real
  // customer real money. Two nudges: the recipient at 7 days, then the buyer at
  // 21 so they can chase it themselves (wrong address, spam folder).
  //
  // ⚠ ONE equality filter, dates compared in code — same reason as everywhere
  // else in this file. Unclaimed gifts are a naturally small set.
  let giftReminders = 0;
  let giftUnclaimedNotices = 0;
  const unclaimed = await db.collection("gifts").where("status", "==", "unredeemed").get();
  for (const giftSnap of unclaimed.docs) {
    const gift = giftSnap.data();
    if (!gift.sentAt) continue;   // not delivered yet; nothing to chase
    const daysSince = (now.getTime() - new Date(gift.sentAt).getTime()) / 86_400_000;

    if (daysSince >= 7 && !gift.reminderSentAt) {
      try {
        const { subject, html, text } = buildGiftReminderEmail({
          recipientName: gift.recipientName ?? "",
          fromName: gift.purchasedByName ?? "",
          code: giftSnap.id,
        });
        await sendTransactionalEmail({ to: gift.recipientEmail, subject, html, text });
        await giftSnap.ref.update({ reminderSentAt: now.toISOString() });
        giftReminders++;
      } catch (err) {
        console.error(`lapse-sweep: gift reminder failed for ${giftSnap.id}:`, err);
        reportError(err, { route: "cron/lapse-sweep", stage: "gift-reminder", code: giftSnap.id });
      }
      continue;
    }

    if (daysSince >= 21 && !gift.unclaimedNoticeAt) {
      try {
        const buyerEmail = (await getAdminAuth().getUser(gift.purchasedByUid)).email;
        if (buyerEmail) {
          const { subject, html, text } = buildGiftUnclaimedEmail({
            recipientName: gift.recipientName ?? "",
            recipientEmail: gift.recipientEmail ?? "",
            code: giftSnap.id,
            days: Math.floor(daysSince),
          });
          await sendTransactionalEmail({ to: buyerEmail, subject, html, text });
        }
        await giftSnap.ref.update({ unclaimedNoticeAt: now.toISOString() });
        giftUnclaimedNotices++;
      } catch (err) {
        console.error(`lapse-sweep: unclaimed notice failed for ${giftSnap.id}:`, err);
        reportError(err, { route: "cron/lapse-sweep", stage: "gift-unclaimed", code: giftSnap.id });
      }
    }
  }

  // Duplicate the Storage files behind any gifted cookbook, so the copy stops
  // depending on the giver's account. See lib/cookbook-copy.ts for why a gifted
  // book that points at somebody else's files is a hostage.
  let giftImages = { copied: 0, failed: 0, recipes: 0, done: true };
  try {
    giftImages = await copyGiftedImages();
  } catch (err) {
    console.error("lapse-sweep: gifted image copy failed:", err);
    reportError(err, { route: "cron/lapse-sweep", stage: "gift-images" });
  }

  // Expire GIFTED years. Same problem as the signup trial and the same
  // solution: nobody is billed at the end of a gift, so no ASSN or RTDN will
  // ever arrive to close it — only the clock can. A gift that outlives its year
  // would be free access forever.
  //
  // ⚠ Deliberately keyed on provider "gift" AND status "active". A gift that
  // has already been walked down the ladder is "canceled" and belongs to the
  // loop below; picking it up again here would keep resetting its lapsedAt to
  // the same expiry date and freeze it at day zero of the ladder for ever.
  let giftsExpired = 0;
  let giftWarningsSent = 0;
  //
  // ⚠ ONE filter, status checked in code — the same reason as above, and the
  // same shape the trial loop uses ("status == trialing", then provider tested
  // in code). Adding `.where("status","==","active")` here needs a composite
  // index that is not declared, and the failure is not a slow query: the whole
  // cron throws and every lapsed household stops advancing.
  const gifted = await db.collection("subscriptions").where("provider", "==", "gift").get();
  for (const subSnap of gifted.docs) {
    const sub = subSnap.data();
    // Already walked down the ladder — the unpaid loop below owns it now.
    // Re-expiring it would reset lapsedAt every night and freeze it at day zero.
    if (sub.status !== "active") continue;
    if (!sub.currentPeriodEnd) continue;
    const endsAt = new Date(sub.currentPeriodEnd);

    if (endsAt > now) {
      const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000);
      if (daysLeft <= TRIAL_WARNING_DAYS && !sub.giftWarningSentAt) {
        try {
          const email = (await getAdminAuth().getUser(subSnap.id)).email;
          if (email) {
            // Name the giver — a year on, "your gift" alone is ambiguous.
            let fromName = "";
            if (sub.giftCode) {
              const giftSnap = await db.collection("gifts").doc(sub.giftCode).get();
              fromName = (giftSnap.data()?.purchasedByName as string | undefined) ?? "";
            }
            const { subject, html, text } = buildGiftEndingEmail(daysLeft, fromName);
            await sendTransactionalEmail({ to: email, subject, html, text });
            await subSnap.ref.update({ giftWarningSentAt: now.toISOString() });
            giftWarningsSent++;
          }
        } catch (err) {
          console.error(`lapse-sweep: gift warning failed for ${subSnap.id}:`, err);
          reportError(err, { route: "cron/lapse-sweep", stage: "gift-warning", subId: subSnap.id });
        }
      }
      continue;
    }

    await subSnap.ref.update({
      status: "canceled",
      lapsedAt: sub.currentPeriodEnd,
      updatedAt: now.toISOString(),
    });
    giftsExpired++;
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
        await deleteHouseholdData(sub.householdId, subSnap.id);
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
    giftsExpired,
    giftWarningsSent,
    giftCardsSent,
    giftImages,
    giftReminders,
    giftUnclaimedNotices,
    transitioned,
    flaggedForDelete,
    deleted,
    hardDelete,
  });
}
