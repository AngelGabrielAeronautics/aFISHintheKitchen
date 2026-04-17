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

describe("recipes collection — reads", () => {
  it("allows unauthenticated reads (public catalog)", async () => {
    await seed("recipes", "r1", { title: "Bread", householdId: "h1" });
    await assertSucceeds(getDoc(doc(anonDb(), "recipes", "r1")));
  });

  it("denies unauthenticated writes", async () => {
    await assertFails(
      setDoc(doc(anonDb(), "recipes", "r1"), { title: "Hack" })
    );
  });
});

describe("recipes collection — create", () => {
  it("allows creating a recipe with no createdByUid (legacy / seed flow)", async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), "recipes", "r1"), { title: "Alice's loaf" })
    );
  });

  it("allows creating a recipe with createdByUid that matches the caller", async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), "recipes", "r1"), {
        title: "Alice's loaf",
        createdByUid: "alice",
      })
    );
  });

  it("denies creating a recipe that claims someone else's createdByUid", async () => {
    await assertFails(
      setDoc(doc(bobDb(), "recipes", "r1"), {
        title: "Bob's spoof",
        createdByUid: "alice",
      })
    );
  });
});

describe("recipes collection — delete", () => {
  it("allows any auth user to delete a legacy recipe (no createdByUid)", async () => {
    await seed("recipes", "r1", { title: "Legacy", contributedBy: "alice" });
    await assertSucceeds(deleteDoc(doc(bobDb(), "recipes", "r1")));
  });

  it("allows the creator to delete their own recipe", async () => {
    await seed("recipes", "r1", { title: "Alice's", createdByUid: "alice" });
    await assertSucceeds(deleteDoc(doc(aliceDb(), "recipes", "r1")));
  });

  it("denies a non-creator from deleting a post-migration recipe", async () => {
    await seed("recipes", "r1", { title: "Alice's", createdByUid: "alice" });
    await assertFails(deleteDoc(doc(bobDb(), "recipes", "r1")));
  });
});

describe("recipes collection — update", () => {
  it("lets the creator update any field on their recipe", async () => {
    await seed("recipes", "r1", {
      title: "Alice's",
      description: "old",
      createdByUid: "alice",
    });
    await assertSucceeds(
      updateDoc(doc(aliceDb(), "recipes", "r1"), { description: "new" })
    );
  });

  it("denies a non-creator from changing non-social fields", async () => {
    await seed("recipes", "r1", {
      title: "Alice's",
      description: "old",
      createdByUid: "alice",
    });
    await assertFails(
      updateDoc(doc(bobDb(), "recipes", "r1"), { description: "hacked" })
    );
  });

  it("lets any auth user update ONLY social fields (lovedBy/triedBy/...)", async () => {
    await seed("recipes", "r1", {
      title: "Alice's",
      createdByUid: "alice",
      lovedBy: [],
      triedBy: [],
    });
    await assertSucceeds(
      updateDoc(doc(bobDb(), "recipes", "r1"), { lovedBy: ["Bob"] })
    );
  });

  it("denies a non-creator from mixing a non-social field into a social update", async () => {
    await seed("recipes", "r1", {
      title: "Alice's",
      description: "old",
      createdByUid: "alice",
      lovedBy: [],
    });
    await assertFails(
      updateDoc(doc(bobDb(), "recipes", "r1"), {
        lovedBy: ["Bob"],
        description: "hacked",
      })
    );
  });

  it("denies a non-creator from claiming ownership of a legacy recipe via update", async () => {
    // Existing doc has no createdByUid; attacker tries to stamp themselves.
    await seed("recipes", "r1", { title: "Legacy" });
    await assertFails(
      updateDoc(doc(bobDb(), "recipes", "r1"), { createdByUid: "bob" })
    );
  });

  it("denies a non-creator from removing an existing createdByUid", async () => {
    await seed("recipes", "r1", { title: "Alice's", createdByUid: "alice" });
    await assertFails(
      updateDoc(doc(bobDb(), "recipes", "r1"), { createdByUid: null })
    );
  });

  it("lets any auth user update any field on a legacy recipe (stays legacy)", async () => {
    await seed("recipes", "r1", { title: "Legacy", description: "old" });
    await assertSucceeds(
      updateDoc(doc(bobDb(), "recipes", "r1"), { description: "updated" })
    );
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
  it("[deferred] allows unauthenticated read (email enumeration)", async () => {
    // Intentionally deferred: the sign-up flow calls isEmailAllowed() at
    // src/app/auth/page.tsx:129 BEFORE the user authenticates, so the read
    // must be public. Tightening to auth-only breaks onboarding; the
    // proper fix is to replace this lookup with an opaque invite-token
    // flow. Pinned so that when the flow is redesigned, this test updates.
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

  it("lets a user create a household they own", async () => {
    await assertSucceeds(
      setDoc(doc(aliceDb(), "households", "h1"), {
        name: "Smith",
        ownerId: "alice",
      })
    );
  });

  it("denies creating a household owned by someone else", async () => {
    await assertFails(
      setDoc(doc(bobDb(), "households", "h1"), {
        name: "Smith",
        ownerId: "alice",
      })
    );
  });

  it("lets the owner update their household", async () => {
    await seed("households", "h1", { name: "Smith", ownerId: "alice" });
    await assertSucceeds(
      updateDoc(doc(aliceDb(), "households", "h1"), { name: "Smith Family" })
    );
  });

  it("denies update by a non-owner (closes the previous [known-permissive])", async () => {
    await seed("households", "h1", { name: "Smith", ownerId: "alice" });
    await assertFails(
      updateDoc(doc(bobDb(), "households", "h1"), { name: "Hacked" })
    );
  });

  it("denies silent ownership transfer via update", async () => {
    await seed("households", "h1", { name: "Smith", ownerId: "alice" });
    await assertFails(
      updateDoc(doc(aliceDb(), "households", "h1"), { ownerId: "bob" })
    );
  });
});

describe("householdMembers collection", () => {
  it("denies unauthenticated create", async () => {
    await assertFails(
      setDoc(doc(anonDb(), "householdMembers", "m1"), {
        userId: "alice",
        householdId: "h1",
      })
    );
  });

  it("lets a user create their own membership (auto-join from invite)", async () => {
    await seed("households", "h1", { name: "Smith", ownerId: "alice" });
    await assertSucceeds(
      setDoc(doc(aliceDb(), "householdMembers", "m1"), {
        userId: "alice",
        householdId: "h1",
        role: "member",
      })
    );
  });

  it("lets the household owner create a membership for someone else", async () => {
    await seed("households", "h1", { name: "Smith", ownerId: "alice" });
    await assertSucceeds(
      setDoc(doc(aliceDb(), "householdMembers", "m1"), {
        userId: "bob",
        householdId: "h1",
        role: "member",
      })
    );
  });

  it("denies a non-owner from creating a membership for someone else", async () => {
    await seed("households", "h1", { name: "Smith", ownerId: "alice" });
    await assertFails(
      setDoc(doc(bobDb(), "householdMembers", "m1"), {
        userId: "charlie",
        householdId: "h1",
        role: "member",
      })
    );
  });

  it("lets a user delete their own membership (leaving)", async () => {
    await seed("households", "h1", { name: "Smith", ownerId: "alice" });
    await seed("householdMembers", "m1", {
      userId: "bob",
      householdId: "h1",
      role: "member",
    });
    await assertSucceeds(deleteDoc(doc(bobDb(), "householdMembers", "m1")));
  });

  it("lets the household owner remove any member", async () => {
    await seed("households", "h1", { name: "Smith", ownerId: "alice" });
    await seed("householdMembers", "m1", {
      userId: "bob",
      householdId: "h1",
      role: "member",
    });
    await assertSucceeds(deleteDoc(doc(aliceDb(), "householdMembers", "m1")));
  });

  it("denies a non-owner from deleting someone else's membership (closes the previous [known-permissive])", async () => {
    await seed("households", "h1", { name: "Smith", ownerId: "alice" });
    await seed("householdMembers", "m1", {
      userId: "alice",
      householdId: "h1",
      role: "owner",
    });
    await assertFails(deleteDoc(doc(bobDb(), "householdMembers", "m1")));
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
