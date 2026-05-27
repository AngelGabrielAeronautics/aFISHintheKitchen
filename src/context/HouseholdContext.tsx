"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { getUserHouseholds, getHousehold } from "@/lib/firebase-recipes";
import type { Household, HouseholdMember, HouseholdAccessState } from "@/lib/types";
import { resolveAccess, type Access } from "@/lib/access";

interface HouseholdContextValue {
  household: Household | null;
  householdId: string | null;
  membership: HouseholdMember | null;
  allMemberships: HouseholdMember[];
  loading: boolean;
  accessState: HouseholdAccessState; // active by default / for legacy docs
  access: Access; // what the current user can do here (view/edit/manage)
  switchHousehold: (id: string) => void;
}

const HouseholdContext = createContext<HouseholdContextValue>({
  household: null,
  householdId: null,
  membership: null,
  allMemberships: [],
  loading: true,
  accessState: "active",
  access: { canView: false, canEdit: false, canManage: false, reason: "not_a_member" },
  switchHousehold: () => {},
});

export function useHousehold() {
  return useContext(HouseholdContext);
}

export default function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, isSuperAdmin } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [membership, setMembership] = useState<HouseholdMember | null>(null);
  const [allMemberships, setAllMemberships] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setHousehold(null);
      setMembership(null);
      setAllMemberships([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const memberships = await getUserHouseholds(user!.uid);
        if (cancelled) return;

        setAllMemberships(memberships);

        if (memberships.length === 0) {
          // User has no household yet
          setHousehold(null);
          setMembership(null);
          setLoading(false);
          return;
        }

        // Use stored preference or default to first household
        const stored = localStorage.getItem("activeHouseholdId");
        const targetId = stored && memberships.some((m) => m.householdId === stored)
          ? stored
          : memberships[0].householdId;

        const hh = await getHousehold(targetId);
        if (cancelled) return;

        setHousehold(hh);
        setActiveHouseholdId(targetId);
        setMembership(memberships.find((m) => m.householdId === targetId) ?? null);
      } catch {
        // Silently fail — user will see "no household" state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user, authLoading, activeHouseholdId]);

  function switchHousehold(id: string) {
    localStorage.setItem("activeHouseholdId", id);
    setActiveHouseholdId(id);
    setLoading(true);
  }

  const accessState: HouseholdAccessState = household?.accessState ?? "active";
  const access = resolveAccess({ household, membership, isSuperAdmin });

  return (
    <HouseholdContext.Provider
      value={{
        household,
        householdId: household?.id ?? null,
        membership,
        allMemberships,
        loading,
        accessState,
        access,
        switchHousehold,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}
