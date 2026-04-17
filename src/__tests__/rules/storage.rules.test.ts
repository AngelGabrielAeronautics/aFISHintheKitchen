import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { ref, uploadBytes, getBytes } from "firebase/storage";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "afk-test",
    storage: {
      rules: readFileSync(resolve(process.cwd(), "storage.rules"), "utf8"),
      host: "127.0.0.1",
      port: 9199,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearStorage();
});

function aliceStorage() {
  return testEnv.authenticatedContext("alice").storage();
}
function bobStorage() {
  return testEnv.authenticatedContext("bob").storage();
}
function anonStorage() {
  return testEnv.unauthenticatedContext().storage();
}

// 1MB of zeros — well under every size limit in storage.rules.
const SMALL_IMAGE = new Uint8Array(1024 * 1024);
// 12MB — over the 10MB recipe-images limit, under the 50MB tip-images limit.
const LARGE_IMAGE = new Uint8Array(12 * 1024 * 1024);

async function seedSmallImage(path: string, contentType: string) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), path), SMALL_IMAGE, { contentType });
  });
}

describe("storage rules — recipe-images (legacy path)", () => {
  it("allows unauthenticated reads", async () => {
    await seedSmallImage("recipe-images/foo/bar.jpg", "image/jpeg");
    await assertSucceeds(getBytes(ref(anonStorage(), "recipe-images/foo/bar.jpg")));
  });

  it("denies unauthenticated writes", async () => {
    await assertFails(
      uploadBytes(ref(anonStorage(), "recipe-images/foo/bar.jpg"), SMALL_IMAGE, {
        contentType: "image/jpeg",
      })
    );
  });

  it("allows authenticated image uploads under 10MB", async () => {
    await assertSucceeds(
      uploadBytes(ref(aliceStorage(), "recipe-images/alice/bread.jpg"), SMALL_IMAGE, {
        contentType: "image/jpeg",
      })
    );
  });

  it("denies uploads over the 10MB cap", async () => {
    await assertFails(
      uploadBytes(ref(aliceStorage(), "recipe-images/alice/huge.jpg"), LARGE_IMAGE, {
        contentType: "image/jpeg",
      })
    );
  });

  it("denies non-image content types (e.g. video)", async () => {
    await assertFails(
      uploadBytes(ref(aliceStorage(), "recipe-images/alice/clip.mp4"), SMALL_IMAGE, {
        contentType: "video/mp4",
      })
    );
  });

  it("[known-permissive] lets any authenticated user write to anyone's recipe folder", async () => {
    // Legacy path has no per-user or per-household isolation.
    // Pinning so that adding ownership checks forces this test to update.
    await assertSucceeds(
      uploadBytes(ref(bobStorage(), "recipe-images/alice/overwrite.jpg"), SMALL_IMAGE, {
        contentType: "image/jpeg",
      })
    );
  });
});

describe("storage rules — tip-images (legacy path)", () => {
  it("accepts videos under the 50MB cap", async () => {
    await assertSucceeds(
      uploadBytes(ref(aliceStorage(), "tip-images/clip.mp4"), SMALL_IMAGE, {
        contentType: "video/mp4",
      })
    );
  });

  it("denies non-image, non-video content types", async () => {
    await assertFails(
      uploadBytes(ref(aliceStorage(), "tip-images/doc.pdf"), SMALL_IMAGE, {
        contentType: "application/pdf",
      })
    );
  });
});

describe("storage rules — household-scoped paths", () => {
  it("allows authenticated image uploads under the household path", async () => {
    await assertSucceeds(
      uploadBytes(
        ref(aliceStorage(), "h1/recipe-images/pie.jpg"),
        SMALL_IMAGE,
        { contentType: "image/jpeg" }
      )
    );
  });

  it("denies unauthenticated writes on household paths", async () => {
    await assertFails(
      uploadBytes(
        ref(anonStorage(), "h1/recipe-images/pie.jpg"),
        SMALL_IMAGE,
        { contentType: "image/jpeg" }
      )
    );
  });

  it("[known-permissive] lets an authenticated user in household B write into household A", async () => {
    // Rules authorise any signed-in caller; there is no cross-check that the
    // caller actually belongs to {householdId}. Pin this so that tightening
    // the rule forces the test to be updated.
    await assertSucceeds(
      uploadBytes(
        ref(bobStorage(), "h1/recipe-images/hack.jpg"),
        SMALL_IMAGE,
        { contentType: "image/jpeg" }
      )
    );
  });
});

describe("storage rules — household branding", () => {
  it("enforces the 5MB cap for logos", async () => {
    // 6MB — over the 5MB branding cap.
    const bytes = new Uint8Array(6 * 1024 * 1024);
    await assertFails(
      uploadBytes(
        ref(aliceStorage(), "h1/branding/logo.png"),
        bytes,
        { contentType: "image/png" }
      )
    );
  });

  it("accepts image uploads under 5MB", async () => {
    await assertSucceeds(
      uploadBytes(
        ref(aliceStorage(), "h1/branding/logo.png"),
        SMALL_IMAGE,
        { contentType: "image/png" }
      )
    );
  });
});
