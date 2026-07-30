import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { deleteUserData } from "@/lib/delete-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Delete the caller's own account and the data that is theirs alone.
//
// Both apps used to call Firebase Auth's client-side `user.delete()` directly,
// which removed the sign-in and nothing else: `userPreferences`, the AI throttle
// counters, and — worst — the `deviceTokens` row kept a deleted user's phone
// receiving a family's push notifications. The /delete-account page promises "your
// device's push-notification registration" is removed, so that was a promise the
// code didn't keep.
//
// The apps now call this instead, because the security rules forbid a client from
// touching most of these documents. It finishes by deleting the Auth user itself,
// so the client's job is: re-authenticate (Firebase requires a recent sign-in for
// anything this destructive), call this, sign out.
//
// ⚠ This deliberately does NOT delete the caller's cookbook, even when they own
// it. A cookbook is shared with everyone they invited, and one person leaving must
// not wipe something a family is still using — see /delete-account, which promises
// exactly that and routes full deletion through an emailed request. `ownsCookbook`
// comes back in the response so the app can point the owner at that route rather
// than leaving them thinking it's all gone.

export async function POST(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  try {
    // checkRevoked: a token minted before a sign-out shouldn't be able to delete
    // an account.
    uid = (await getAdminAuth().verifyIdToken(token, true)).uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    // Read this BEFORE deleting anything — householdMembers is one of the things
    // that goes, and afterwards there is no way to answer the question.
    const owned = await getAdminDb()
      .collection("households")
      .where("ownerId", "==", uid)
      .limit(1)
      .get();
    const ownsCookbook = !owned.empty;
    const cookbookName = owned.empty ? null : (owned.docs[0].data().name ?? null);

    const report = await deleteUserData(uid);

    return NextResponse.json({ ok: true, ownsCookbook, cookbookName, report });
  } catch (err) {
    console.error("delete-account failed", err);
    // The Auth user is deleted last, so a failure here leaves the account intact
    // and the call safe to retry.
    return NextResponse.json(
      { error: "Couldn't delete your account. Please try again, or email us." },
      { status: 500 }
    );
  }
}
