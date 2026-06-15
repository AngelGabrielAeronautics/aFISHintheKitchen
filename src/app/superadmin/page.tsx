"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getFirebaseAuth } from "@/lib/firebase";

interface HouseholdRow {
  id: string;
  name: string;
  ownerId: string;
  memberCount: number;
  accessState: string;
  subscriptionStatus: string;
  plan: string | null;
  trialEndsAt: string | null;
  lapsedAt: string | null;
  createdAt: string | null;
  seatUpgradeRequestedAt: string | null;
}

interface Overview {
  metrics: {
    households: number;
    members: number;
    seatRequests: number;
    byAccessState: Record<string, number>;
    bySubscription: Record<string, number>;
  };
  households: HouseholdRow[];
}

const stateColors: Record<string, string> = {
  active: "text-sage-dark",
  read_only: "text-gold",
  suspended: "text-red-600",
};

export default function SuperAdminPage() {
  const { user, isSuperAdmin, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getFirebaseAuth().currentUser?.getIdToken();
    if (!token) return;
    const res = await fetch("/api/admin/overview", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      setData(await res.json());
      setError("");
    } else {
      setError("Failed to load overview.");
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || !isSuperAdmin) {
      router.push("/");
      return;
    }
    load();
  }, [loading, user, isSuperAdmin, router, load]);

  async function act(householdId: string, action: string, days?: number) {
    setBusy(`${householdId}:${action}`);
    try {
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ householdId, action, days }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading || !user || !isSuperAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-1 font-serif text-3xl font-bold text-charcoal">Super Admin</h1>
      <p className="mb-6 font-sans text-sm text-slate">Platform-wide oversight of every cookbook.</p>

      {error && <p className="mb-4 font-sans text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="font-sans text-sm text-slate">Loading…</p>}

      {data && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Metric label="Cookbooks" value={data.metrics.households} />
            <Metric label="Members" value={data.metrics.members} />
            <Metric label="Active" value={data.metrics.byAccessState.active ?? 0} />
            <Metric label="Suspended" value={data.metrics.byAccessState.suspended ?? 0} />
            <Metric label="Seat requests" value={data.metrics.seatRequests ?? 0} />
          </div>

          {data.households.some((h) => h.seatUpgradeRequestedAt) && (
            <div className="mb-8 rounded-xl border border-terracotta-light/40 bg-terracotta-light/10 p-5">
              <h2 className="mb-1 font-serif text-lg font-semibold text-charcoal">
                More-seats requests
              </h2>
              <p className="mb-4 font-sans text-xs text-slate">
                Owners who hit the seat cap and asked to be notified. Captured demand for the paid
                extra-seats add-on — reach out, then mark handled.
              </p>
              <ul className="divide-y divide-gold-light/50">
                {data.households
                  .filter((h) => h.seatUpgradeRequestedAt)
                  .sort((a, b) => (a.seatUpgradeRequestedAt! < b.seatUpgradeRequestedAt! ? 1 : -1))
                  .map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate font-sans text-sm font-medium text-charcoal">
                          {h.name || h.id}
                        </div>
                        <div className="font-sans text-xs text-slate/70">
                          {h.memberCount} members · requested {formatDate(h.seatUpgradeRequestedAt)}
                        </div>
                      </div>
                      <ActionBtn
                        onClick={() => act(h.id, "clear_seat_request")}
                        busy={busy === `${h.id}:clear_seat_request`}
                      >
                        Mark handled
                      </ActionBtn>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-gold-light bg-white">
            <table className="w-full text-left font-sans text-sm">
              <thead className="border-b border-gold-light bg-cream/40 text-xs uppercase text-slate/60">
                <tr>
                  <th className="px-4 py-3">Cookbook</th>
                  <th className="px-4 py-3">Members</th>
                  <th className="px-4 py-3">Access</th>
                  <th className="px-4 py-3">Subscription</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.households.map((h) => (
                  <tr key={h.id} className="border-b border-gold-light/50 last:border-0">
                    <td className="px-4 py-3 font-medium text-charcoal">{h.name || h.id}</td>
                    <td className="px-4 py-3 text-slate">{h.memberCount}</td>
                    <td className={`px-4 py-3 font-medium ${stateColors[h.accessState] ?? "text-slate"}`}>
                      {h.accessState}
                    </td>
                    <td className="px-4 py-3 text-slate">
                      {h.subscriptionStatus}
                      {h.plan ? ` · ${h.plan}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {h.accessState === "suspended" ? (
                          <ActionBtn onClick={() => act(h.id, "reactivate")} busy={busy === `${h.id}:reactivate`}>
                            Reactivate
                          </ActionBtn>
                        ) : (
                          <ActionBtn onClick={() => act(h.id, "suspend")} busy={busy === `${h.id}:suspend`} danger>
                            Suspend
                          </ActionBtn>
                        )}
                        <ActionBtn onClick={() => act(h.id, "comp")} busy={busy === `${h.id}:comp`}>
                          Comp
                        </ActionBtn>
                        <ActionBtn onClick={() => act(h.id, "extend_trial", 14)} busy={busy === `${h.id}:extend_trial`}>
                          +14d trial
                        </ActionBtn>
                        <ActionBtn onClick={() => act(h.id, "cancel")} busy={busy === `${h.id}:cancel`} danger>
                          Cancel
                        </ActionBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gold-light bg-white p-4">
      <div className="font-serif text-2xl text-charcoal">{value}</div>
      <div className="font-sans text-xs uppercase tracking-wide text-slate/60">{label}</div>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  busy,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer ${
        danger
          ? "bg-red-50 text-red-600 hover:bg-red-100"
          : "bg-cream-dark/30 text-charcoal hover:bg-cream-dark/50"
      }`}
    >
      {busy ? "…" : children}
    </button>
  );
}
