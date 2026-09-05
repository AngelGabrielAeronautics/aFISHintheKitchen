import type { Firestore } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { generateGiftCode, normaliseGiftCode } from "@/lib/gift";

/**
 * Join codes — `joinCodes/{CODE}` — the invitation that does not need an
 * email address.
 *
 * Email invites match on the address the invitee is SIGNED IN with, and that
 * is where they broke in practice (2026-09-05): Donna invited Meg's Gmail,
 * Meg's real account is her me.com Apple ID, so accepting created a second
 * Meg; Michael signed up with Sign in with Apple + Hide My Email and does not
 * know his own address at all. A join code sidesteps the question. The owner
 * hands over a code (or the /join/CODE link), the invitee redeems it INSIDE
 * the app as whoever they already are, and the seat and guest caps are checked
 * at redemption exactly as for an email invite.
 *
 * ⚠ A code is a BEARER TOKEN — whoever holds it can join. So: crypto random
 * from the gift alphabet, single use, seven-day expiry, no client reads at all
 * (the rules mirror /gifts), and the owner can revoke it from the invite list.
 */
export const JOIN_CODES = "joinCodes";
export const JOIN_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface JoinCode {
  code: string; // doc id, bare upper-case
  householdId: string;
  createdBy: string; // owner uid
  createdByName: string;
  /** Who the owner meant it for — display only, never enforced. */
  forName?: string;
  createdAt: string;
  expiresAt: string;
  status: "open" | "used" | "revoked";
  usedAt?: string;
  usedBy?: string;
  usedByName?: string;
}

export function newJoinCode(): string {
  return generateGiftCode((n) => new Uint8Array(randomBytes(n)));
}

/** Anything a person might type or paste, including a `/join/CODE` link. */
export function normaliseJoinCode(input: string): string {
  return normaliseGiftCode(input.trim().replace(/^.*\/join\//i, ""));
}

export function joinLink(code: string): string {
  return `https://www.afishinthekitchen.com/join/${code}`;
}

export function isOpen(code: JoinCode, now = Date.now()): boolean {
  return code.status === "open" && Date.parse(code.expiresAt) > now;
}

export async function loadJoinCode(db: Firestore, raw: string): Promise<JoinCode | null> {
  const code = normaliseJoinCode(raw);
  if (code.length < 6) return null;
  const snap = await db.collection(JOIN_CODES).doc(code).get();
  return snap.exists ? ({ ...(snap.data() as Omit<JoinCode, "code">), code } as JoinCode) : null;
}
