// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useUnsavedChanges } from "../useUnsavedChanges";

// Render an anchor into the document and dispatch a bubbling click on it.
// The hook listens at the document level (capture phase) for delegated clicks.
// Wrapped in act() so React flushes any resulting state before we read it.
// Returns a `stopPropagation` spy — jsdom may call preventDefault itself when
// trying to navigate, so we use stopPropagation as a reliable "the hook took
// action" signal.
function dispatchAnchorClick(attrs: Record<string, string>) {
  const a = document.createElement("a");
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  a.textContent = "go";
  document.body.appendChild(a);
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  const stopPropagation = vi.spyOn(event, "stopPropagation");
  act(() => {
    a.dispatchEvent(event);
  });
  return { event, stopPropagation };
}

function dispatchWindowEvent(event: Event): void {
  act(() => {
    window.dispatchEvent(event);
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  // Unmount every hook rendered via renderHook so the hook's useEffect
  // cleanup runs and removes its listeners from the shared jsdom window.
  cleanup();
  vi.restoreAllMocks();
});

describe("useUnsavedChanges — beforeunload", () => {
  it("does not preventDefault when there are no unsaved changes", () => {
    renderHook(() => useUnsavedChanges(false));
    const evt = new Event("beforeunload", { cancelable: true });
    const spy = vi.spyOn(evt, "preventDefault");
    dispatchWindowEvent(evt);
    expect(spy).not.toHaveBeenCalled();
  });

  it("preventDefaults when there are unsaved changes", () => {
    renderHook(() => useUnsavedChanges(true));
    const evt = new Event("beforeunload", { cancelable: true });
    const spy = vi.spyOn(evt, "preventDefault");
    dispatchWindowEvent(evt);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("removes the beforeunload listener on unmount", () => {
    const { unmount } = renderHook(() => useUnsavedChanges(true));
    unmount();
    const evt = new Event("beforeunload", { cancelable: true });
    const spy = vi.spyOn(evt, "preventDefault");
    dispatchWindowEvent(evt);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("useUnsavedChanges — link-click interception", () => {
  it("does not intercept clicks when hasChanges is false", () => {
    const { result } = renderHook(() => useUnsavedChanges(false));
    const { stopPropagation } = dispatchAnchorClick({ href: "/other" });
    expect(stopPropagation).not.toHaveBeenCalled();
    expect(result.current.showPrompt).toBe(false);
  });

  it("intercepts internal link clicks when hasChanges is true", () => {
    const { result } = renderHook(() => useUnsavedChanges(true));
    const { stopPropagation } = dispatchAnchorClick({ href: "/recipes" });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(result.current.showPrompt).toBe(true);
  });

  it("ignores clicks on hash-only links", () => {
    const { result } = renderHook(() => useUnsavedChanges(true));
    const { stopPropagation } = dispatchAnchorClick({ href: "#section" });
    expect(stopPropagation).not.toHaveBeenCalled();
    expect(result.current.showPrompt).toBe(false);
  });

  it("ignores javascript: pseudo-URLs", () => {
    const { result } = renderHook(() => useUnsavedChanges(true));
    const { stopPropagation } = dispatchAnchorClick({
      href: "javascript:void(0)",
    });
    expect(stopPropagation).not.toHaveBeenCalled();
    expect(result.current.showPrompt).toBe(false);
  });

  it("ignores links with target=_blank", () => {
    const { result } = renderHook(() => useUnsavedChanges(true));
    const { stopPropagation } = dispatchAnchorClick({
      href: "/recipes",
      target: "_blank",
    });
    expect(stopPropagation).not.toHaveBeenCalled();
    expect(result.current.showPrompt).toBe(false);
  });

  it("ignores external links to another origin", () => {
    const { result } = renderHook(() => useUnsavedChanges(true));
    const { stopPropagation } = dispatchAnchorClick({
      href: "https://example.com/x",
    });
    expect(stopPropagation).not.toHaveBeenCalled();
    expect(result.current.showPrompt).toBe(false);
  });

  it("intercepts absolute links that match window.location.origin", () => {
    const sameOrigin = `${window.location.origin}/recipes`;
    const { result } = renderHook(() => useUnsavedChanges(true));
    const { stopPropagation } = dispatchAnchorClick({ href: sameOrigin });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(result.current.showPrompt).toBe(true);
  });

  it("ignores anchors with no href attribute", () => {
    const { result } = renderHook(() => useUnsavedChanges(true));
    const { stopPropagation } = dispatchAnchorClick({});
    expect(stopPropagation).not.toHaveBeenCalled();
    expect(result.current.showPrompt).toBe(false);
  });
});

describe("useUnsavedChanges — popstate (back button)", () => {
  it("intercepts popstate, pushes a state back, and raises the prompt", () => {
    const pushSpy = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() => useUnsavedChanges(true));
    const initialPushes = pushSpy.mock.calls.length;

    dispatchWindowEvent(new PopStateEvent("popstate"));

    expect(result.current.showPrompt).toBe(true);
    // One additional pushState to re-pin the URL after the attempted back nav.
    expect(pushSpy.mock.calls.length).toBeGreaterThan(initialPushes);
  });
});

describe("useUnsavedChanges — confirm / cancel", () => {
  it("cancelLeave clears the prompt without navigating", () => {
    const { result } = renderHook(() => useUnsavedChanges(true));
    dispatchAnchorClick({ href: "/elsewhere" });
    expect(result.current.showPrompt).toBe(true);

    act(() => {
      result.current.cancelLeave();
    });
    expect(result.current.showPrompt).toBe(false);
  });

  it("confirmLeave for a back-button prompt calls history.go(-2)", () => {
    const goSpy = vi.spyOn(window.history, "go").mockImplementation(() => {});
    const { result } = renderHook(() => useUnsavedChanges(true));
    dispatchWindowEvent(new PopStateEvent("popstate"));
    expect(result.current.showPrompt).toBe(true);

    act(() => {
      result.current.confirmLeave();
    });
    expect(goSpy).toHaveBeenCalledWith(-2);
    expect(result.current.showPrompt).toBe(false);
  });
});
