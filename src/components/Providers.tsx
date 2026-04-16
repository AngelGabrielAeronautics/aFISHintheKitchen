"use client";

import { AuthProvider } from "@/context/AuthContext";
import HouseholdProvider from "@/context/HouseholdContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <HouseholdProvider>{children}</HouseholdProvider>
    </AuthProvider>
  );
}
