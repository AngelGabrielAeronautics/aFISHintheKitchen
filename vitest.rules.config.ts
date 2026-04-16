import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Runs only the Firestore rules tests. Invoke via `npm run test:rules`,
// which wraps vitest in `firebase emulators:exec` so the Firestore emulator
// is available on FIRESTORE_EMULATOR_HOST.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.rules.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    globals: false,
  },
});
