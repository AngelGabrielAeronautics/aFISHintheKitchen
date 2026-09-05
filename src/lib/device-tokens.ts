import type { Firestore } from "firebase-admin/firestore";

/**
 * `deviceTokens/{token}_{householdId}` — one registration per (device, book).
 *
 * The doc used to be keyed by the FCM token alone, carrying ONE householdId:
 * whichever cookbook the device had open last. Switch to a guest book and the
 * re-registration silently moved you off your own book's pushes — new recipe,
 * a menu assignment — until you switched back (2026-09-05). Now a device is
 * registered to every book its user is in, and a fan-out by `householdId`
 * finds it under each.
 *
 * Legacy `deviceTokens/{token}` docs from 1.10 apps are still honoured by the
 * fan-outs (same `householdId` field) and are retired the first time that
 * device registers on a new build.
 */
export const DEVICE_TOKENS = "deviceTokens";

export function deviceTokenId(token: string, householdId: string): string {
  return `${token}_${householdId}`;
}

/** Every registration of one physical device — new-shape and legacy alike. */
export async function registrationsFor(db: Firestore, token: string) {
  const snap = await db.collection(DEVICE_TOKENS).where("token", "==", token).get();
  return snap.docs;
}

/**
 * Forget a token FCM says is dead — under every household it was registered
 * to. A prune by doc id would miss every doc but the legacy one.
 */
export async function deleteTokenEverywhere(db: Firestore, token: string): Promise<void> {
  const docs = await registrationsFor(db, token);
  await Promise.all(docs.map((d) => d.ref.delete().catch(() => {})));
}
