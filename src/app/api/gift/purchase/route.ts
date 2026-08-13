import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { verifyAppStoreTransaction, appAccountTokenForUid } from "@/lib/appstore-verify";
import { verifyPlayProduct, obfuscatedAccountIdForUid } from "@/lib/play-verify";
import {
  GIFT_DAYS,
  GIFT_PRODUCT_ID,
  generateGiftCode,
  type Gift,
} from "@/lib/gift";
import { sendTransactionalEmail } from "@/lib/email";
import { buildGiftCardEmail } from "@/lib/auth-email";
import { mayCopyCookbook } from "@/lib/cookbook-copy";
import { reportError } from "@/lib/error-reporting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.afishinthekitchen.com";

// Records a gift purchase and mints its code.
//
// ⚠ The gift is for a cookbook the recipient will own OUTRIGHT. Nothing here
// touches the buyer's household, membership or seats — see the header of
// lib/gift.ts, which explains at length why this is not an invite.
//
// The store is the source of truth for payment: this route refuses to mint a
// code without a receipt it has verified itself. A client saying "I bought it"
// is not evidence.
export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let uid: string;
    let buyerName: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      uid = decoded.uid;
      buyerName = ((decoded.name as string | undefined) ?? "").trim();
    } catch {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const body = (await req.json()) as {
      platform?: "appstore" | "play";
      jws?: string; // App Store signed transaction
      purchaseToken?: string; // Play purchase token
      productId?: string;
      recipientName?: string;
      recipientEmail?: string;
      message?: string;
      sendOn?: string; // ISO date, optional — defaults to now
      includeCookbook?: boolean;
      householdId?: string; // whose cookbook to copy, if includeCookbook
    };

    const recipientName = (body.recipientName ?? "").trim();
    const recipientEmail = (body.recipientEmail ?? "").trim().toLowerCase();
    const message = (body.message ?? "").trim().slice(0, 500);
    if (!recipientName || !recipientEmail) {
      return NextResponse.json({ error: "missing_recipient" }, { status: 400 });
    }
    // Deliberately loose. A stricter pattern rejects real addresses, and the
    // cost of a typo here is a bounced card the buyer can resend — not a lost
    // payment. The store has the money either way.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
      return NextResponse.json({ error: "bad_recipient_email" }, { status: 400 });
    }

    // ── Verify the purchase with the store ──────────────────────────────────
    let transactionId: string;
    let platform: "appstore" | "play";

    if (body.platform === "play") {
      platform = "play";
      const purchaseToken = (body.purchaseToken ?? "").trim();
      if (!purchaseToken) return NextResponse.json({ error: "missing_token" }, { status: 400 });
      const purchase = await verifyPlayProduct(purchaseToken, body.productId ?? GIFT_PRODUCT_ID);
      if (!purchase.purchased) {
        return NextResponse.json({ error: "not_purchased" }, { status: 400 });
      }
      // Same account binding the subscription flow uses: a receipt bought by a
      // different account must not mint a gift on this one.
      if (
        purchase.obfuscatedAccountId &&
        purchase.obfuscatedAccountId !== (await obfuscatedAccountIdForUid(uid))
      ) {
        return NextResponse.json({ error: "account_mismatch" }, { status: 403 });
      }
      transactionId = purchase.orderId;
    } else {
      platform = "appstore";
      const jws = (body.jws ?? "").trim();
      if (!jws) return NextResponse.json({ error: "missing_jws" }, { status: 400 });
      const tx = await verifyAppStoreTransaction(jws);
      if (tx.productId !== (body.productId ?? GIFT_PRODUCT_ID)) {
        return NextResponse.json({ error: "wrong_product" }, { status: 400 });
      }
      if (tx.appAccountToken && tx.appAccountToken !== appAccountTokenForUid(uid)) {
        return NextResponse.json({ error: "account_mismatch" }, { status: 403 });
      }
      transactionId = String(tx.transactionId ?? "");
    }

    if (!transactionId) {
      return NextResponse.json({ error: "no_transaction_id" }, { status: 400 });
    }

    const db = getAdminDb();

    // ⚠ OWNERS ONLY may send a copy of a cookbook, enforced here rather than
    // trusted from the request. The body names the household to copy and it
    // arrives from a client; without this check anyone could ask for any
    // household id and walk off with a family's entire cookbook.
    //
    // A non-owner who somehow got this far still GETS THEIR GIFT — the year is
    // the thing they paid for. The copy is simply not recorded, which is the
    // only outcome that does not either charge them for nothing or leak a book.
    let includeCookbook = body.includeCookbook === true;
    if (includeCookbook) {
      const allowed = await mayCopyCookbook(uid, body.householdId ?? "");
      if (!allowed) {
        console.warn(`gift/purchase: ${uid} asked to copy ${body.householdId} without owning it`);
        includeCookbook = false;
      }
    }

    // ⚠ Idempotent on the store transaction. Both stores can deliver the same
    // purchase more than once — a retried finish, a restored transaction, a
    // replayed notification — and each redelivery arriving as a fresh year
    // would be free money out the door. Returns the existing gift instead.
    const dupe = await db
      .collection("gifts")
      .where("transactionId", "==", transactionId)
      .limit(1)
      .get();
    if (!dupe.empty) {
      const existing = dupe.docs[0].data() as Gift;
      return NextResponse.json({ ok: true, code: existing.code, duplicate: true });
    }

    // ── Mint the code ───────────────────────────────────────────────────────
    // Retry on collision rather than trusting 8 characters to be unique. The
    // odds are tiny and the failure mode — one buyer's gift silently
    // overwriting another's — is not one to leave to chance.
    let code = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateGiftCode((n) => new Uint8Array(randomBytes(n)));
      const taken = await db.collection("gifts").doc(candidate).get();
      if (!taken.exists) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      reportError(new Error("gift code collision after 5 attempts"), { route: "gift/purchase" });
      return NextResponse.json({ error: "code_generation_failed" }, { status: 500 });
    }

    const now = new Date();
    const sendOnRaw = (body.sendOn ?? "").trim();
    const sendOnDate = sendOnRaw ? new Date(sendOnRaw) : now;
    const sendOn = Number.isNaN(sendOnDate.getTime()) || sendOnDate < now
      ? now.toISOString()
      : sendOnDate.toISOString();

    const gift: Gift = {
      code,
      productId: body.productId ?? GIFT_PRODUCT_ID,
      days: GIFT_DAYS,
      platform,
      transactionId,
      purchasedByUid: uid,
      purchasedByName: buyerName,
      recipientName,
      recipientEmail,
      message,
      sendOn,
      includeCookbook: includeCookbook,
      sourceHouseholdId: includeCookbook ? (body.householdId ?? null) : null,
      createdAt: now.toISOString(),
      status: "unredeemed",
      // ⚠ Explicitly null, not omitted. The sweep finds undelivered cards with
      // `where("sentAt","==",null)`, and Firestore cannot match equality
      // against a field that does not exist — omitting it makes the card
      // invisible to the retry and it would never be sent.
      sentAt: null,
    };

    await db.collection("gifts").doc(code).set(gift);

    // Deliver now if it isn't post-dated; the nightly sweep picks up the rest.
    //
    // ⚠ A failed send must NOT fail the request. The money has already left the
    // buyer's account and the gift exists — throwing here would show them an
    // error for a purchase that actually succeeded, and the obvious response to
    // that is to buy it again. The card is retried by the sweep, and the buyer
    // has the code on screen regardless.
    let sent = false;
    if (new Date(sendOn) <= now) {
      try {
        const { subject, html, text } = buildGiftCardEmail({
          recipientName, fromName: buyerName, message, code,
          redeemUrl: `${SITE_URL}/g/${code}`,
          includesCookbook: includeCookbook,
        });
        await sendTransactionalEmail({ to: recipientEmail, subject, html, text });
        await db.collection("gifts").doc(code).update({ sentAt: new Date().toISOString() });
        sent = true;
      } catch (err) {
        console.error("gift/purchase: card send failed:", err);
        reportError(err, { route: "gift/purchase", stage: "send-card", code });
      }
    }

    return NextResponse.json({ ok: true, code, sendOn, sent });
  } catch (err) {
    console.error("gift/purchase error:", err);
    reportError(err, { route: "gift/purchase" });
    return NextResponse.json({ error: "gift_failed" }, { status: 500 });
  }
}
