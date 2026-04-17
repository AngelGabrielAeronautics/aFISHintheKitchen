// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Household, HouseholdMember } from "@/lib/types";

const { getUserHouseholdsMock, getHouseholdMock, useAuthMock } = vi.hoisted(
  () => ({
    getUserHouseholdsMock: vi.fn(),
    getHouseholdMock: vi.fn(),
    useAuthMock: vi.fn(),
  })
);

vi.mock("@/lib/firebase-recipes", () => ({
  getUserHouseholds: getUserHouseholdsMock,
  getHousehold: getHouseholdMock,
}));
vi.mock("../AuthContext", () => ({
  useAuth: useAuthMock,
}));

import HouseholdProvider, { useHousehold } from "../HouseholdContext";

function Consumer() {
  const {
    household,
    householdId,
    membership,
    allMemberships,
    loading,
    switchHousehold,
  } = useHousehold();
  return (
    <div>
      <span data-testid="loading">{loading ? "yes" : "no"}</span>
      <span data-testid="hh-id">{householdId ?? ""}</span>
      <span data-testid="hh-name">{household?.name ?? ""}</span>
      <span data-testid="member-role">{membership?.role ?? ""}</span>
      <span data-testid="memberships-count">{allMemberships.length}</span>
      <button
        type="button"
        onClick={() => switchHousehold("h2")}
        data-testid="switch"
      >
        switch
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <HouseholdProvider>
      <Consumer />
    </HouseholdProvider>
  );
}

function member(
  overrides: Partial<HouseholdMember> & { householdId: string }
): HouseholdMember {
  return {
    id: `m:${overrides.householdId}`,
    userId: "alice",
    displayName: "Alice",
    role: "member",
    joinedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function household(id: string, name: string): Household {
  return {
    id,
    name,
    slug: id,
    ownerId: "alice",
    customisation: { brandName: name, tagline: "" },
    plan: "free",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  localStorage.clear();
  getUserHouseholdsMock.mockReset();
  getHouseholdMock.mockReset();
  useAuthMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("HouseholdContext", () => {
  it("stays loading while auth is still loading", () => {
    useAuthMock.mockReturnValue({ user: null, loading: true, isAdmin: false });
    renderProvider();
    expect(screen.getByTestId("loading").textContent).toBe("yes");
    expect(getUserHouseholdsMock).not.toHaveBeenCalled();
  });

  it("clears household state and stops loading when there is no user", async () => {
    useAuthMock.mockReturnValue({ user: null, loading: false, isAdmin: false });
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("no")
    );
    expect(screen.getByTestId("hh-id").textContent).toBe("");
    expect(screen.getByTestId("memberships-count").textContent).toBe("0");
    expect(getUserHouseholdsMock).not.toHaveBeenCalled();
  });

  it("stops loading with empty state when the user has no memberships", async () => {
    useAuthMock.mockReturnValue({
      user: { uid: "alice" },
      loading: false,
      isAdmin: false,
    });
    getUserHouseholdsMock.mockResolvedValue([]);

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("no")
    );
    expect(screen.getByTestId("memberships-count").textContent).toBe("0");
    expect(screen.getByTestId("hh-id").textContent).toBe("");
    expect(getHouseholdMock).not.toHaveBeenCalled();
  });

  it("selects the first household by default when there is no stored preference", async () => {
    useAuthMock.mockReturnValue({
      user: { uid: "alice" },
      loading: false,
      isAdmin: false,
    });
    getUserHouseholdsMock.mockResolvedValue([
      member({ householdId: "h1", role: "owner" }),
      member({ householdId: "h2", role: "member" }),
    ]);
    getHouseholdMock.mockResolvedValue(household("h1", "Smith"));

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("hh-id").textContent).toBe("h1")
    );
    expect(getHouseholdMock).toHaveBeenCalledWith("h1");
    expect(screen.getByTestId("hh-name").textContent).toBe("Smith");
    expect(screen.getByTestId("member-role").textContent).toBe("owner");
    expect(screen.getByTestId("memberships-count").textContent).toBe("2");
  });

  it("honours a valid stored activeHouseholdId preference", async () => {
    localStorage.setItem("activeHouseholdId", "h2");
    useAuthMock.mockReturnValue({
      user: { uid: "alice" },
      loading: false,
      isAdmin: false,
    });
    getUserHouseholdsMock.mockResolvedValue([
      member({ householdId: "h1", role: "owner" }),
      member({ householdId: "h2", role: "member" }),
    ]);
    getHouseholdMock.mockResolvedValue(household("h2", "Jones"));

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("hh-id").textContent).toBe("h2")
    );
    expect(getHouseholdMock).toHaveBeenCalledWith("h2");
    expect(screen.getByTestId("member-role").textContent).toBe("member");
  });

  it("falls back to the first household when the stored preference is not in the user's memberships", async () => {
    localStorage.setItem("activeHouseholdId", "h-gone");
    useAuthMock.mockReturnValue({
      user: { uid: "alice" },
      loading: false,
      isAdmin: false,
    });
    getUserHouseholdsMock.mockResolvedValue([
      member({ householdId: "h1", role: "owner" }),
    ]);
    getHouseholdMock.mockResolvedValue(household("h1", "Smith"));

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("hh-id").textContent).toBe("h1")
    );
    expect(getHouseholdMock).toHaveBeenCalledWith("h1");
  });

  it("persists the switched household to localStorage and reloads", async () => {
    useAuthMock.mockReturnValue({
      user: { uid: "alice" },
      loading: false,
      isAdmin: false,
    });
    getUserHouseholdsMock.mockResolvedValue([
      member({ householdId: "h1", role: "owner" }),
      member({ householdId: "h2", role: "member" }),
    ]);
    getHouseholdMock.mockImplementation(async (id: string) =>
      id === "h1" ? household("h1", "Smith") : household("h2", "Jones")
    );

    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("hh-id").textContent).toBe("h1")
    );

    await act(async () => {
      screen.getByTestId("switch").click();
    });

    await waitFor(() =>
      expect(screen.getByTestId("hh-id").textContent).toBe("h2")
    );
    expect(localStorage.getItem("activeHouseholdId")).toBe("h2");
    expect(screen.getByTestId("member-role").textContent).toBe("member");
  });

  it("swallows load errors and stops loading", async () => {
    useAuthMock.mockReturnValue({
      user: { uid: "alice" },
      loading: false,
      isAdmin: false,
    });
    getUserHouseholdsMock.mockRejectedValue(new Error("offline"));

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("no")
    );
    expect(screen.getByTestId("hh-id").textContent).toBe("");
  });
});
