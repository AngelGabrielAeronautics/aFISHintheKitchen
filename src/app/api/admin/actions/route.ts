import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { sendTransactionalEmail } from "@/lib/email";
import { buildCompedEmail, buildTrialExtendedEmail } from "@/lib/auth-email";
import { verifySuperAdmin } from "@/lib/admin-auth";
import { deleteHouseholdData } from "@/lib/delete-data";
import { TRIAL_DAYS } from "@/lib/access";
// ⚠ Checked HERE as well as inside sendTransactionalEmail, because the console
// reports back WHICH address it wrote to — a suppressed send must not be
// reported to the operator as an email that went out.
import { isNeverEmail } from "@/lib/never-email";

export const runtime = "nodejs";

// Super-admin subscription/household actions. Refunds are intentionally NOT here —
// those happen in the payment provider's dashboard (added at the billing milestone).
export async function POST(req: NextRequest) {
  const auth = await verifySuperAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json()) as {
    householdId?: string;
    action?: string;
    days?: number;
    confirmName?: string;
  };
  const { householdId, action } = body;
  if (!householdId || !action) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const db = getAdminDb();
  const hhRef = db.collection("households").doc(householdId);
  const hhSnap = await hhRef.get();
  if (!hhSnap.exists) return NextResponse.json({ error: "household_not_found" }, { status: 404 });

  const ownerId = hhSnap.data()!.ownerId as string;
  /// Set when a comp actually mailed someone, so the console can say so.
  let emailed: string | null = null;
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

    case "comp": {
      // Grant free access, and TELL THEM. Comping used to be silent, so the
      // only way anyone learned we had given them the app was to notice they
      // were no longer being asked to pay.
      //
      // ⚠ Only mail on the transition. Re-comping an already-comped household
      // (fixing a state, re-running an action) must not send "your cookbook is
      // on us" a second time — it reads as a mistake, or worse as a second
      // gift that isn't real.
      const alreadyComped = (await subRef.get()).data()?.comped === true;
      await hhRef.set({ accessState: "active", stateChangedAt: now }, { merge: true });
      await subRef.set(
        { status: "active", plan: null, comped: true, householdId, lapsedAt: FieldValue.delete(), updatedAt: now },
        { merge: true }
      );
      if (!alreadyComped) {
        // ⚠ Best-effort: a failed send must never fail the comp itself. The
        // access is the thing that matters; an unsent email can be re-sent by
        // hand, an ungranted subscription leaves someone locked out.
        try {
          const email = (await getAdminAuth().getUser(ownerId)).email;
          if (email && !isNeverEmail(email)) {
            const { subject, html, text } = buildCompedEmail();
            await sendTransactionalEmail({ to: email, subject, html, text });
            await subRef.set({ compedEmailSentAt: now }, { merge: true });
            emailed = email;
          }
        } catch (err) {
          console.error("comp email failed", err);
        }
      }
      break;
    }

    case "extend_trial": {
      const days = Number(body.days) > 0 ? Number(body.days) : TRIAL_DAYS;
      const trialEndsAt = new Date(Date.now() + days * 86_400_000).toISOString();
      await hhRef.set({ accessState: "active", stateChangedAt: now }, { merge: true });
      await subRef.set(
        {
          status: "trialing",
          trialEndsAt,
          hasUsedTrial: true,
          householdId,
          // ⚠⚠ THE GRANT MUST SAY WHOSE TRIAL IT IS. The lapse sweep only
          // expires trials nobody else will close, and it decides that from
          // `provider`. This action used to leave `provider` alone, so
          // extending the trial of anyone who had ever touched a store left a
          // trial no store would ever close and the sweep would never touch —
          // permanent free access, invisible because the console still said
          // "In trial". No store event is coming for a trial WE granted, so
          // "none" is simply the truth; a later real purchase overwrites it
          // via applyBillingEvent. `plan` goes with it — a granted trial is on
          // no plan. providerSubscriptionId is deliberately KEPT: Apple's and
          // Play's notification handlers look the doc up by it.
          provider: "none",
          plan: null,
          trialGrantedAt: now,
          lapsedAt: FieldValue.delete(),
          // A fresh trial deserves a fresh warning — without this the sweep
          // thinks the "ending soon" email was already sent and the extended
          // trial expires unannounced. Same for the ended notice.
          trialWarningSentAt: FieldValue.delete(),
          trialEndedEmailSentAt: FieldValue.delete(),
          updatedAt: now,
        },
        { merge: true }
      );
      // Tell them the deadline moved. ⚠ Sent EVERY time, unlike the comp mail:
      // a second extension is genuinely more time, and the new date is the
      // point of the message. Best-effort for the same reason as comp — the
      // access matters more than the note about it.
      try {
        const email = (await getAdminAuth().getUser(ownerId)).email;
        if (email && !isNeverEmail(email)) {
          const { subject, html, text } = buildTrialExtendedEmail(trialEndsAt);
          await sendTransactionalEmail({ to: email, subject, html, text });
          emailed = email;
        }
      } catch (err) {
        console.error("extend_trial email failed", err);
      }
      break;
    }

    case "cancel": // starts the lapse ladder; the cron advances accessState over time
      await subRef.set({ status: "canceled", householdId, lapsedAt: now, updatedAt: now }, { merge: true });
      break;

    case "clear_seat_request": // dismiss a handled "more seats" request
      await hhRef.set({ seatUpgradeRequestedAt: FieldValue.delete() }, { merge: true });
      break;

    // The owner asked us to delete their cookbook (the emailed request the
    // /delete-account page promises to honour within 30 days). Previously this
    // meant a human deleting documents in the Firebase console by hand, which
    // missed Storage and the public share links every time.
    //
    // ⚠ Irreversible, and it destroys content belonging to everyone the owner
    // invited. `confirmName` must match the household's own name exactly: the
    // failure mode to design against is a mistyped or stale householdId wiping
    // the wrong family's cookbook, and an id is unmemorable where a name is not.
    case "delete_household": {
      const name = (hhSnap.data()!.name as string | undefined) ?? "";
      if (!body.confirmName || body.confirmName.trim() !== name.trim()) {
        return NextResponse.json(
          { error: "confirm_name_mismatch", expected: name },
          { status: 400 }
        );
      }
      const report = await deleteHouseholdData(householdId, ownerId);
      console.warn(
        `admin: deleted household ${householdId} ("${name}") owner ${ownerId}`,
        report
      );
      return NextResponse.json({ ok: true, report });
    }

    default:
      return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  // `emailed` lets the console say who was told, so a silent send failure is
  // visible rather than assumed.
  return NextResponse.json({ ok: true, emailed });
}
