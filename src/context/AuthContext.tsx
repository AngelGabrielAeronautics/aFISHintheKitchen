"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { isAdmin as checkIsAdmin, isSuperAdmin as checkIsSuperAdmin } from "@/lib/firebase-recipes";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean; // legacy config/settings.adminEmails (being phased out)
  isSuperAdmin: boolean; // platform staff (config/superAdmins) — separate from cookbook owner
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminStatus, setAdminStatus] = useState(false);
  const [superAdminStatus, setSuperAdminStatus] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser?.email) {
        const [admin, superAdmin] = await Promise.all([
          checkIsAdmin(firebaseUser.email).catch(() => false),
          checkIsSuperAdmin(firebaseUser.email).catch(() => false),
        ]);
        setAdminStatus(admin);
        setSuperAdminStatus(superAdmin);
      } else {
        setAdminStatus(false);
        setSuperAdminStatus(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, isAdmin: adminStatus, isSuperAdmin: superAdminStatus }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { AuthContext };
