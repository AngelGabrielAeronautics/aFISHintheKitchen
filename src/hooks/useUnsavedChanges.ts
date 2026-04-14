"use client";

import { useEffect, useCallback, useState } from "react";

export function useUnsavedChanges(hasChanges: boolean) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  // Browser close/refresh
  const handleBeforeUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      if (!hasChanges) return;
      e.preventDefault();
    },
    [hasChanges]
  );

  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [handleBeforeUnload]);

  // Intercept in-app link clicks
  useEffect(() => {
    if (!hasChanges) return;

    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript")) return;
      // Only intercept internal navigation
      if (anchor.target === "_blank") return;
      if (href.startsWith("http") && !href.startsWith(window.location.origin)) return;

      e.preventDefault();
      e.stopPropagation();
      setPendingUrl(href);
      setShowPrompt(true);
    }

    // Intercept browser back button
    function handlePopState() {
      // Push the current state back to prevent navigation
      window.history.pushState(null, "", window.location.href);
      setShowPrompt(true);
      setPendingUrl("__back__");
    }

    // Push initial state so we can catch popstate
    window.history.pushState(null, "", window.location.href);

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [hasChanges]);

  function confirmLeave() {
    setShowPrompt(false);
    if (pendingUrl === "__back__") {
      window.history.go(-2);
    } else if (pendingUrl) {
      window.location.href = pendingUrl;
    }
    setPendingUrl(null);
  }

  function cancelLeave() {
    setShowPrompt(false);
    setPendingUrl(null);
  }

  return { showPrompt, confirmLeave, cancelLeave };
}
