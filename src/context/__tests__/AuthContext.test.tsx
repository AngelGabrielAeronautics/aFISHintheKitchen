// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { User } from "firebase/auth";

const { onAuthStateChangedMock, isAdminMock } = vi.hoisted(() => ({
  onAuthStateChangedMock: vi.fn(),
  isAdminMock: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: onAuthStateChangedMock,
}));
vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: () => ({ __mock: true }),
}));
vi.mock("@/lib/firebase-recipes", () => ({
  isAdmin: isAdminMock,
}));

import { AuthProvider, useAuth } from "../AuthContext";

function Consumer() {
  const { user, loading, isAdmin } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading ? "yes" : "no"}</span>
      <span data-testid="admin">{isAdmin ? "yes" : "no"}</span>
      <span data-testid="email">{user?.email ?? ""}</span>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>
  );
}

type AuthCallback = (user: User | null) => void | Promise<void>;
let lastAuthCallback: AuthCallback | null = null;
let unsubscribeSpy: ReturnType<typeof vi.fn>;

function userWithEmail(email: string): User {
  return { uid: `uid:${email}`, email } as unknown as User;
}

beforeEach(() => {
  lastAuthCallback = null;
  unsubscribeSpy = vi.fn();
  onAuthStateChangedMock.mockReset();
  onAuthStateChangedMock.mockImplementation((_auth, cb: AuthCallback) => {
    lastAuthCallback = cb;
    return unsubscribeSpy;
  });
  isAdminMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function fireAuth(user: User | null) {
  // Consumers may await isAdmin; wrap in act() and flush microtasks.
  await act(async () => {
    await lastAuthCallback?.(user);
  });
}

describe("AuthContext", () => {
  it("initially reports loading=true with no user", () => {
    renderWithProvider();
    expect(screen.getByTestId("loading").textContent).toBe("yes");
    expect(screen.getByTestId("email").textContent).toBe("");
    expect(screen.getByTestId("admin").textContent).toBe("no");
  });

  it("stops loading when auth resolves to no user (signed out)", async () => {
    renderWithProvider();
    await fireAuth(null);
    expect(screen.getByTestId("loading").textContent).toBe("no");
    expect(screen.getByTestId("email").textContent).toBe("");
    expect(screen.getByTestId("admin").textContent).toBe("no");
    expect(isAdminMock).not.toHaveBeenCalled();
  });

  it("checks admin status for a signed-in user with an email", async () => {
    isAdminMock.mockResolvedValueOnce(true);
    renderWithProvider();
    await fireAuth(userWithEmail("alice@example.com"));
    expect(isAdminMock).toHaveBeenCalledWith("alice@example.com");
    expect(screen.getByTestId("email").textContent).toBe("alice@example.com");
    expect(screen.getByTestId("admin").textContent).toBe("yes");
    expect(screen.getByTestId("loading").textContent).toBe("no");
  });

  it("defaults isAdmin to false when the admin check throws", async () => {
    isAdminMock.mockRejectedValueOnce(new Error("network"));
    renderWithProvider();
    await fireAuth(userWithEmail("bob@example.com"));
    expect(screen.getByTestId("admin").textContent).toBe("no");
    expect(screen.getByTestId("loading").textContent).toBe("no");
  });

  it("does not consult isAdmin when the user has no email", async () => {
    renderWithProvider();
    await fireAuth({ uid: "anon", email: null } as unknown as User);
    expect(isAdminMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("admin").textContent).toBe("no");
  });

  it("unsubscribes from auth on unmount", () => {
    const { unmount } = renderWithProvider();
    expect(onAuthStateChangedMock).toHaveBeenCalledTimes(1);
    unmount();
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
  });

  it("clears admin status when a signed-in user signs out", async () => {
    isAdminMock.mockResolvedValueOnce(true);
    renderWithProvider();
    await fireAuth(userWithEmail("alice@example.com"));
    expect(screen.getByTestId("admin").textContent).toBe("yes");

    await fireAuth(null);
    expect(screen.getByTestId("admin").textContent).toBe("no");
    expect(screen.getByTestId("email").textContent).toBe("");
  });
});

describe("useAuth", () => {
  it("throws when used outside an AuthProvider", () => {
    // React 19 still logs the caught error; silence it.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(
      /useAuth must be used within an AuthProvider/
    );
    spy.mockRestore();
  });
});
