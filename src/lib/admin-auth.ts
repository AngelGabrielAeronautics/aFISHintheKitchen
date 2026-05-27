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
