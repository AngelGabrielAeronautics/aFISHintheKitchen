// Pure access-control logic — no Firebase imports. Mirrored by the Firestore
// security rules so client and server enforce the same model. See the
// project_subscription_model memory for the agreed spec.

import type { Household, HouseholdMember, HouseholdAccessState } from "./types";

// ── Limits ──
export const MAX_SEATS = 5; // members an owner may invite (the owner is not counted)
export const MAX_GUEST_BOOKS = 3; // cookbooks a user may be a guest member of
export const TRIAL_DAYS = 14;

// ── Lapse ladder thresholds (days since the account lapsed) ──
export const GRACE_DAYS = 7; // 0–7: full access while payment is retried
export const SUSPEND_DAYS = 30; // 7–30: read-only, then suspended
export const DELETE_DAYS = 365; // suspended for ~1 year, then data deleted

export interface Access {
  canView: boolean;
  canEdit: boolean; // add/edit recipes, meal plans, tips
  canManage: boolean; // billing, invites, members, settings (owner only)
  reason: "ok" | "not_a_member" | "read_only" | "suspended";
}

const NO_ACCESS: Access = { canView: false, canEdit: false, canManage: false, reason: "not_a_member" };

/**
 * What can this user do in this household, given their membership, the
 * household's access state, and whether they're platform staff?
 */
export function resolveAccess(params: {
  household: Pick<Household, "accessState"> | null;
  membership: Pick<HouseholdMember, "role"> | null;
  isSuperAdmin?: boolean;
}): Access {
  const { household, membership, isSuperAdmin } = params;

  // Platform staff have full access everywhere.
  if (isSuperAdmin) return { canView: true, canEdit: true, canManage: true, reason: "ok" };

  if (!household || !membership) return NO_ACCESS;

  const state: HouseholdAccessState = household.accessState ?? "active";

  if (state === "suspended") {
    return { canView: false, canEdit: false, canManage: false, reason: "suspended" };
  }
  if (state === "read_only") {
    return { canView: true, canEdit: false, canManage: false, reason: "read_only" };
  }

  const isOwner = membership.role === "owner";
  return { canView: true, canEdit: true, canManage: isOwner, reason: "ok" };
}

/**
 * The unified lapse ladder: given when an account lapsed, what access state
 * should its cookbook be in now, and is it past the deletion horizon?
 */
export function computeAccessStateFromLapse(
  lapsedAt: string | undefined,
  now: Date = new Date()
): { accessState: HouseholdAccessState; shouldDelete: boolean } {
  if (!lapsedAt) return { accessState: "active", shouldDelete: false };
  const days = (now.getTime() - new Date(lapsedAt).getTime()) / 86_400_000;
  if (days >= DELETE_DAYS) return { accessState: "suspended", shouldDelete: true };
  if (days >= SUSPEND_DAYS) return { accessState: "suspended", shouldDelete: false };
  if (days >= GRACE_DAYS) return { accessState: "read_only", shouldDelete: false };
  return { accessState: "active", shouldDelete: false }; // still in grace
}

// ── Seat / guest-book math ──
export function seatLimit(extraSeats = 0): number {
  return MAX_SEATS + extraSeats;
}
export function seatsUsed(activeMembers: number, pendingInvites: number): number {
  return activeMembers + pendingInvites;
}
export function canAddSeat(activeMembers: number, pendingInvites: number, extraSeats = 0): boolean {
  return seatsUsed(activeMembers, pendingInvites) < seatLimit(extraSeats);
}
export function canJoinGuestBook(currentGuestBooks: number): boolean {
  return currentGuestBooks < MAX_GUEST_BOOKS;
}
