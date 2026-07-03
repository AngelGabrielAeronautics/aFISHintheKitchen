"use client";

import { useEffect, useState } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { getAllMembers } from "@/lib/firebase-recipes";

// Names of the household's family-member profiles. Replaces the old hardcoded
// FAMILY_MEMBERS list (the founder family) so every tenant sees their own
// family in "Contributed by" and assignment dropdowns.
export function useFamilyNames(): string[] {
  const { householdId } = useHousehold();
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    if (!householdId) {
      setNames([]);
      return;
    }
    let cancelled = false;
    getAllMembers(householdId)
      .then((members) => {
        if (cancelled) return;
        setNames(
          members
            .map((m) => m.name)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
        );
      })
      .catch(() => {
        if (!cancelled) setNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, [householdId]);

  return names;
}
