import {
  SignedDataVerifier,
  Environment,
  type JWSTransactionDecodedPayload,
} from "@apple/app-store-server-library";

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
function peekEnvironment(jws: string): Environment {
  try {
    const payload = JSON.parse(Buffer.from(jws.split(".")[1] ?? "", "base64").toString("utf-8"));
    return payload.environment === "Production" ? Environment.PRODUCTION : Environment.SANDBOX;
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
