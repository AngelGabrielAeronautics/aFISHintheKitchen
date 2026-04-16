import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "afk-test",
    firestore: {
      rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

function aliceDb() {
  return testEnv.authenticatedContext("alice").firestore();
}
function bobDb() {
  return testEnv.authenticatedContext("bob").firestore();
}
function anonDb() {
  return testEnv.unauthenticatedContext().firestore();
}

// Seed helper that bypasses rules (admin context).
async function seed(
  path: string,
  id: string,
  data: Record<string, unknown>
) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path, id), data);
  });
}

describe("recipes collection", () => {
  it("allows unauthenticated reads (public catalog)", async () => {
    await seed("recipes", "r1", { title: "Bread", householdId: "h1" });
    await assertSucceeds(getDoc(doc(anonDb(), "recipes", "r1")));
  });

  it("denies unauthenticated writes", async () => {
    await assertFails(
      setDoc(doc(anonDb(), "recipes", "r1"), { title: "Hack" })
    );
  });

  it("allows any authenticated user to create a recipe", async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), "recipes", "r1"), { title: "Alice's loaf" })
    );
  });

  it("[known-permissive] lets any authenticated user delete any recipe (no owner check)", async () => {
    await seed("recipes", "r1", { title: "Alice's", contributedBy: "alice" });
    await assertSucceeds(deleteDoc(doc(bobDb(), "recipes", "r1")));
  });
});

describe("userPreferences collection", () => {
  it("lets a user read their own preferences", async () => {
    await seed("userPreferences", "alice", { notifyNewRecipes: true });
    await assertSucceeds(getDoc(doc(aliceDb(), "userPreferences", "alice")));
  });

  it("denies reading another user's preferences", async () => {
    await seed("userPreferences", "alice", { notifyNewRecipes: true });
    await assertFails(getDoc(doc(bobDb(), "userPreferences", "alice")));
  });

  it("denies writing to another user's preferences", async () => {
    await assertFails(
      setDoc(doc(bobDb(), "userPreferences", "alice"), {
        notifyNewRecipes: false,
      })
    );
  });

  it("denies unauthenticated access entirely", async () => {
    await seed("userPreferences", "alice", { notifyNewRecipes: true });
    await assertFails(getDoc(doc(anonDb(), "userPreferences", "alice")));
  });
});

describe("invitedUsers collection", () => {
  it("[known-risk] allows unauthenticated read (email enumeration)", async () => {
    // Documents current posture: anyone can enumerate the invite list.
    // Pinning this so tightening the rule (e.g. auth-only) forces this test to update.
    await seed("invitedUsers", "alice@example.com", {
      role: "member",
      householdId: "h1",
    });
    await assertSucceeds(
      getDoc(doc(anonDb(), "invitedUsers", "alice@example.com"))
    );
  });

  it("denies unauthenticated writes", async () => {
    await assertFails(
      setDoc(doc(anonDb(), "invitedUsers", "eve@example.com"), {
        role: "member",
      })
    );
  });
});

describe("households collection", () => {
  it("denies unauthenticated reads", async () => {
    await seed("households", "h1", { name: "Smith", ownerId: "alice" });
    await assertFails(getDoc(doc(anonDb(), "households", "h1")));
  });

  it("[known-permissive] lets any authenticated user update any household (no owner check)", async () => {
    // Rule only checks request.auth != null; bob can overwrite alice's household.
    await seed("households", "h1", { name: "Smith", ownerId: "alice" });
    await assertSucceeds(
      updateDoc(doc(bobDb(), "households", "h1"), { name: "Hacked" })
    );
  });
});

describe("householdMembers collection", () => {
  it("[known-permissive] lets any authenticated user delete any membership record", async () => {
    await seed("householdMembers", "m1", {
      userId: "alice",
      householdId: "h1",
      role: "member",
    });
    await assertSucceeds(deleteDoc(doc(bobDb(), "householdMembers", "m1")));
  });

  it("denies unauthenticated create", async () => {
    await assertFails(
      setDoc(doc(anonDb(), "householdMembers", "m1"), {
        userId: "alice",
        householdId: "h1",
      })
    );
  });
});

describe("mealPlans collection", () => {
  it("requires authentication for reads", async () => {
    await seed("mealPlans", "p1", { householdId: "h1" });
    await assertFails(getDoc(doc(anonDb(), "mealPlans", "p1")));
    await assertSucceeds(getDoc(doc(aliceDb(), "mealPlans", "p1")));
  });
});

describe("config collection", () => {
  it("allows unauthenticated read", async () => {
    await seed("config", "global", { version: 1 });
    await assertSucceeds(getDoc(doc(anonDb(), "config", "global")));
  });

  it("denies all client writes (even authenticated)", async () => {
    await assertFails(
      setDoc(doc(aliceDb(), "config", "global"), { version: 2 })
    );
  });
});
