// Ops script: grant platform super-admin to an email.
//
//   node scripts/grant-superadmin.mjs admin@afishinthekitchen.com
//
// Adds the email to config/superAdmins.emails (the list isSuperAdmin() checks,
// in both the app and the Firestore rules). Also ensures a Firebase Auth user
// exists for that email with emailVerified=true, and prints a password-reset
// link so the owner can set their own password.
//
// Requires FIREBASE_SERVICE_ACCOUNT_B64 in .env.local (already present here).
// Non-destructive: it only adds to the list, never removes existing admins.

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// --- Load FIREBASE_SERVICE_ACCOUNT_B64 from .env.local (plain node doesn't) ---
function readEnvVar(name) {
  if (process.env[name]) return process.env[name];
  let text;
  try {
    text = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
  } catch {
    return undefined;
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() !== name) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return undefined;
}

const email = (process.argv[2] || "").toLowerCase().trim();
if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/grant-superadmin.mjs <email>");
  process.exit(1);
}

const b64 = readEnvVar("FIREBASE_SERVICE_ACCOUNT_B64");
if (!b64) {
  console.error("FIREBASE_SERVICE_ACCOUNT_B64 is not set in .env.local");
  process.exit(1);
}

const decoded = Buffer.from(b64, "base64").toString("utf-8");
if (!decoded.trim().startsWith("{")) {
  console.error(
    "FIREBASE_SERVICE_ACCOUNT_B64 in .env.local is not a real key (looks like the\n" +
      "placeholder). Generate one: Firebase Console -> Project Settings -> Service\n" +
      "Accounts -> Generate new private key, then:\n" +
      "  base64 -i service-account.json | pbcopy\n" +
      "and paste it as FIREBASE_SERVICE_ACCOUNT_B64 in .env.local."
  );
  process.exit(1);
}
const serviceAccount = JSON.parse(decoded);
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth(app);
const db = getFirestore(app);

// --- 1. Ensure the auth user exists (verified) ---
let createdUser = false;
try {
  await auth.getUserByEmail(email);
  console.log(`✓ Auth user already exists: ${email}`);
} catch (err) {
  if (err?.code === "auth/user-not-found") {
    await auth.createUser({ email, emailVerified: true, password: randomUUID() });
    createdUser = true;
    console.log(`✓ Created auth user: ${email} (email marked verified)`);
  } else {
    throw err;
  }
}

// --- 2. Add the email to config/superAdmins.emails ---
await db.doc("config/superAdmins").set(
  { emails: FieldValue.arrayUnion(email) },
  { merge: true }
);
const after = (await db.doc("config/superAdmins").get()).data()?.emails ?? [];
console.log(`✓ config/superAdmins.emails now: ${JSON.stringify(after)}`);

// --- 3. If we just created the user, hand back a password-reset link ---
if (createdUser) {
  try {
    const link = await auth.generatePasswordResetLink(email);
    console.log(`\nSet the password by opening this link:\n${link}`);
  } catch {
    console.log("\nUser created. Use the app's 'Forgot password' flow to set a password.");
  }
}

console.log("\nDone.");
process.exit(0);
