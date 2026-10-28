// Server-only: verify that an API caller is a platform super admin
// (config/superAdmins), distinct from a cookbook owner. Used by /api/admin/*.
import { getAdminAuth, getAdminDb } from "./firebase-admin";

type SuperAdminResult =
  | { ok: true; email: string; uid: string }
  | { ok: false; status: number; error: string };

export async function verifySuperAdmin(authHeader: string | null): Promise<SuperAdminResult> {
  const token = (authHeader ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "unauthorized" };

  let email: string;
  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    // ⚠ The admin list is keyed by EMAIL, so the email must be proven. On
    // 2026-10-28 admin@afishinthekitchen.com was on the list with no account
    // behind it: anyone could have registered that address (unverified) and
    // walked into the superadmin console. Firestore's isSuperAdmin() has the
    // same check.
    if (decoded.email_verified !== true) {
      return { ok: false, status: 403, error: "forbidden" };
    }
    email = (decoded.email ?? "").toLowerCase().trim();
    uid = decoded.uid;
  } catch {
    return { ok: false, status: 401, error: "invalid_token" };
  }

  const snap = await getAdminDb().doc("config/superAdmins").get();
  const emails: string[] = snap.exists ? (snap.data()?.emails ?? []) : [];
  if (!email || !emails.map((e) => e.toLowerCase().trim()).includes(email)) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true, email, uid };
}
