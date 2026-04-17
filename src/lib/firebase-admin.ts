import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

// Lazy-initialized Admin SDK for server-side code (API routes).
//
// Credentials are taken, in order, from:
//   1. FIREBASE_SERVICE_ACCOUNT_KEY — the full service-account JSON, inline.
//   2. Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS path or
//      Google-managed runtime).
//
// In tests, this module is mocked — the real init never runs.

let _app: App | null = null;

function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApp();
    return _app;
  }

  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (inline) {
    const parsed = JSON.parse(inline) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    _app = initializeApp({
      credential: cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
      }),
    });
    return _app;
  }

  // No explicit credential — rely on Application Default Credentials.
  _app = initializeApp();
  return _app;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
