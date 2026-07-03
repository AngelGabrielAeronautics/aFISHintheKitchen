import { createHash } from "crypto";
import {
  SignedDataVerifier,
  Environment,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";

// The appAccountToken a genuine purchase from this Firebase user carries.
// Deterministic UUID derived from the uid (first 16 bytes of SHA-256, with
// RFC-4122 version/variant bits) — the iOS app computes the identical value
// (StoreKitManager.appAccountToken(for:)) and attaches it at purchase time, so
// a JWS can be tied to the account that bought it without a lookup table.
export function appAccountTokenForUid(uid: string): string {
  const b = createHash("sha256").update(uid).digest().subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Apple Root CA - G3 (DER), embedded as base64 so it ships in the serverless
// bundle without a runtime file read. Source:
// https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
const APPLE_ROOT_CA_G3_B64 =
  "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";

const BUNDLE_ID = "angelgabriel.afishinthekitchen";
const APP_APPLE_ID = 6780944935; // App Store Connect numeric app id

function appleRootCAs(): Buffer[] {
  return [Buffer.from(APPLE_ROOT_CA_G3_B64, "base64")];
}

// Read the (unverified) environment so we can build the matching verifier.
// Transactions carry `environment` at the top level; notifications carry it at
// `data.environment`.
function peekEnvironment(jws: string): Environment {
  try {
    const payload = JSON.parse(Buffer.from(jws.split(".")[1] ?? "", "base64").toString("utf-8"));
    const env = payload.environment ?? payload.data?.environment;
    return env === "Production" ? Environment.PRODUCTION : Environment.SANDBOX;
  } catch {
    return Environment.SANDBOX;
  }
}

// Verify a StoreKit 2 signed transaction (JWS) against Apple's certificate chain
// and decode it. Throws if the signature/chain/bundle id don't check out — i.e.
// a forged or tampered purchase can't pass. Online (OCSP) checks are disabled to
// avoid serverless network flakiness; the full chain-to-Apple-root verification
// still proves authenticity.
export async function verifyAppStoreTransaction(jws: string): Promise<JWSTransactionDecodedPayload> {
  const env = peekEnvironment(jws);
  const verifier = new SignedDataVerifier(appleRootCAs(), false, env, BUNDLE_ID, APP_APPLE_ID);
  return verifier.verifyAndDecodeTransaction(jws);
}

// Verify + decode an App Store Server Notification V2 (signedPayload). Throws if
// the signature/chain don't verify — so only genuine Apple notifications pass.
export async function verifyAppStoreNotification(signedPayload: string): Promise<ResponseBodyV2DecodedPayload> {
  const env = peekEnvironment(signedPayload);
  const verifier = new SignedDataVerifier(appleRootCAs(), false, env, BUNDLE_ID, APP_APPLE_ID);
  return verifier.verifyAndDecodeNotification(signedPayload);
}
