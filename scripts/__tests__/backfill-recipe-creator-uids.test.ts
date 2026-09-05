import { describe, expect, it, vi } from "vitest";

// firebase-admin never has to actually load — the script only imports it at
// module top-level, and we're only exercising the pure matcher functions.
vi.mock("firebase-admin/app", () => ({
  cert: vi.fn(),
  getApps: () => [{}],
  initializeApp: vi.fn(),
}));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(),
}));

import {
  candidateUidsFor,
  decideOutcome,
} from "../backfill-recipe-creator-uids";

const member = (userId: string, householdId: string, displayName: string) => ({
  userId,
  householdId,
  displayName,
});

describe("candidateUidsFor", () => {
  const members = [
    member("uid-alice", "h1", "Alice"),
    member("uid-bob", "h1", "Bob"),
    member("uid-charlie", "h1", "Charlie"),
    member("uid-alice2", "h2", "Alice"),
  ];

  it("returns [] when the recipe has no householdId", () => {
    expect(
      candidateUidsFor({ id: "r", contributedBy: "Alice" }, members)
    ).toEqual([]);
  });

  it("returns [] when contributedBy is missing", () => {
    expect(
      candidateUidsFor({ id: "r", householdId: "h1" }, members)
    ).toEqual([]);
  });

  it("matches on display name inside the same household, case-insensitively", () => {
    expect(
      candidateUidsFor(
        { id: "r", householdId: "h1", contributedBy: "alice" },
        members
      )
    ).toEqual(["uid-alice"]);
  });

  it("trims surrounding whitespace on both sides", () => {
    const withPadding = [member("uid-x", "h1", "  Padded  ")];
    expect(
      candidateUidsFor(
        { id: "r", householdId: "h1", contributedBy: "padded" },
        withPadding
      )
    ).toEqual(["uid-x"]);
  });

  it("does not cross the household boundary", () => {
    expect(
      candidateUidsFor(
        { id: "r", householdId: "h1", contributedBy: "Alice" },
        members
      )
    ).not.toContain("uid-alice2");
  });

  it("returns multiple uids when two members share a display name", () => {
    const twoAlices = [
      member("uid-a1", "h1", "Alice"),
      member("uid-a2", "h1", "Alice"),
    ];
    expect(
      candidateUidsFor(
        { id: "r", householdId: "h1", contributedBy: "Alice" },
        twoAlices
      ).sort()
    ).toEqual(["uid-a1", "uid-a2"]);
  });
});

describe("decideOutcome", () => {
  const members = [
    member("uid-alice", "h1", "Alice"),
    member("uid-bob", "h1", "Bob"),
  ];

  it("skips recipes that already have a createdByUid", () => {
    const out = decideOutcome(
      { id: "r", householdId: "h1", contributedBy: "Alice", createdByUid: "existing" },
      members
    );
    expect(out.outcome).toBe("skipped-has-uid");
    expect(out.matchedUid).toBe("existing");
  });

  it("flags recipes with no householdId as no-household", () => {
    expect(decideOutcome({ id: "r", contributedBy: "Alice" }, members)).toMatchObject({
      outcome: "no-household",
      matchedUid: "",
    });
  });

  it("returns matched with the sole uid when exactly one candidate exists", () => {
    expect(
      decideOutcome(
        { id: "r", householdId: "h1", contributedBy: "Alice" },
        members
      )
    ).toMatchObject({ outcome: "matched", matchedUid: "uid-alice" });
  });

  it("returns no-match when the contributor name resolves nowhere", () => {
    expect(
      decideOutcome(
        { id: "r", householdId: "h1", contributedBy: "Nobody" },
        members
      )
    ).toMatchObject({ outcome: "no-match", matchedUid: "" });
  });

  it("returns ambiguous with every candidate when the name is not unique", () => {
    const twoAlices = [
      member("uid-a1", "h1", "Alice"),
      member("uid-a2", "h1", "alice"),
    ];
    const out = decideOutcome(
      { id: "r", householdId: "h1", contributedBy: "Alice" },
      twoAlices
    );
    expect(out.outcome).toBe("ambiguous");
    expect(out.matchedUid).toBe("");
    expect(out.candidateUids.sort()).toEqual(["uid-a1", "uid-a2"]);
  });
});
