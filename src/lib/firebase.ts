import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getApp(): FirebaseApp {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

let _db: Firestore;
let _auth: Auth;
let _storage: FirebaseStorage;

export function getDb(): Firestore {
  if (_db) return _db;
  const app = getApp();
  try {
    // Auto-detect when the WebChannel/QUIC stream is unreliable (VPNs, proxies,
    // flaky networks) and fall back to HTTP long-polling. Avoids the noisy
    // "WebChannelConnection RPC 'Listen' stream transport errored" + QUIC errors.
    _db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    // Already initialized (HMR / double import) — reuse the existing instance.
    _db = getFirestore(app);
  }
  return _db;
}

export function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(getApp());
  return _auth;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!_storage) _storage = getStorage(getApp());
  return _storage;
}
