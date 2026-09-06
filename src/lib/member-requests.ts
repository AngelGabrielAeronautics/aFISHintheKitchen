import type { Firestore } from "firebase-admin/firestore";

/**
 * `memberRequests/{id}` — a member asking the owner to let somebody in.
 *
 * Only the owner can add people (`canManage`), which left every other member
 * at a dead end: they know the person, the owner has the button. A request
 * closes that gap without handing the seat budget to everyone — the member
 * asks, the owner decides, and approving is what mints the join code.
 *
 * The requester shares the code themselves (Dylan, 2026-09-06): they are the
 * one who knows the person. That is why `joinCode` is stored here — the
 * `joinCodes` collection itself is unreadable by clients, so this doc is the
 * one place a member may see the code they were granted, and only their own.
 */
export const MEMBER_REQUESTS = "memberRequests";

export type MemberRequestStatus = "pending" | "approved" | "declined";

export interface MemberRequest {
  id?: string;
  householdId: string;
  /** The member who asked. */
  requestedBy: string;
  requestedByName: string;
  /** Who they want to add — a name, never an email. Display only. */
  forName: string;
  /** Optional line for the owner ("she's Mum's sister"). */
  note?: string;
  status: MemberRequestStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  /** Set when approved — the code the requester passes on. */
  joinCode?: string;
  joinCodeExpiresAt?: string;
}

/** Pending requests for a cookbook, oldest first (the queue the owner works). */
export async function pendingFor(db: Firestore, householdId: string): Promise<MemberRequest[]> {
  const snap = await db
    .collection(MEMBER_REQUESTS)
    .where("householdId", "==", householdId)
    .where("status", "==", "pending")
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<MemberRequest, "id">) }))
    .sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0));
}

/** One member's own requests, newest first. */
export async function minesFor(db: Firestore, householdId: string, uid: string): Promise<MemberRequest[]> {
  const snap = await db
    .collection(MEMBER_REQUESTS)
    .where("householdId", "==", householdId)
    .where("requestedBy", "==", uid)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<MemberRequest, "id">) }))
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}
