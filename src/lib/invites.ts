import type { Firestore } from "firebase-admin/firestore";

/**
 * Invitations live in `invites/{email}_{householdId}` — one document per
 * (address, cookbook) — so the same person can be invited to more than one
 * book. They used to live in `invitedUsers/{email}`, keyed by the address
 * alone, which made a second invitation to anybody impossible: `/api/invite`
 * refused with `invited_elsewhere` for life once the address had ever been
 * invited anywhere. Nobody in production was ever in two books (2026-09-05).
 *
 * ⚠ THE LEGACY DOC IS KEPT AS A MIRROR while the 1.10 apps are in the wild:
 * they read `invitedUsers/{email}` directly — the pending-invite check on a
 * fresh sign-up, the owner's invite list, revoke. `syncLegacyMirror` rewrites
 * that doc from the new collection after every change, choosing the one
 * invite an address-keyed doc CAN represent: the newest pending one, else the
 * newest registered one. Drop the mirror (and this note) once 1.11+ is what
 * people run.
 */
export const INVITES = "invites";
export const LEGACY_INVITES = "invitedUsers";

export function inviteId(email: string, householdId: string): string {
  return `${email.toLowerCase().trim()}_${householdId}`;
}

export interface InviteDoc {
  email: string;
  householdId: string;
  name: string;
  invitedBy: string;
  status: "pending" | "registered";
  createdAt: string;
  resentAt?: string;
  registeredAt?: string;
}

/** Every invite for an address, newest first. */
export async function invitesFor(db: Firestore, email: string): Promise<InviteDoc[]> {
  const snap = await db.collection(INVITES).where("email", "==", email.toLowerCase().trim()).get();
  return snap.docs
    .map((d) => d.data() as InviteDoc)
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

/** Rewrite (or remove) the address-keyed legacy doc from the new collection. */
export async function syncLegacyMirror(db: Firestore, email: string): Promise<void> {
  const all = await invitesFor(db, email);
  const ref = db.collection(LEGACY_INVITES).doc(email.toLowerCase().trim());
  const pick = all.find((i) => i.status === "pending") ?? all[0];
  if (!pick) {
    await ref.delete().catch(() => {});
    return;
  }
  // Same shape the old clients expect; `email` is harmless extra.
  const { email: _e, ...rest } = pick;
  void _e;
  await ref.set({ ...rest, email: pick.email }, { merge: false });
}
